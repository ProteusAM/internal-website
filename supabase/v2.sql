-- =====================================================================
--  ProteusBoard — mise à jour v2
--  Accueil (actualités + discussion), espaces projet (équipe, tâches,
--  kanban, Gantt, RACI, documents), page Documents de l'asso,
--  réglages Présidence.
--
--  À exécuter APRÈS schema.sql, dans Supabase > SQL Editor > Run.
--  Ne supprime aucune donnée. Peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Présidence (invisible pour tous les autres comptes)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_president boolean not null default false;

create or replace function public.is_president() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_president from public.profiles
                   where id = auth.uid() and statut <> 'Ancien'), false);
$$;

-- La colonne is_president n'est lisible par aucun compte : on n'expose
-- que les colonnes utiles de la table profiles.
revoke select, update on public.profiles from authenticated;
grant select (id, email, nom, role, pole, promo, cotisation, statut, created_at) on public.profiles to authenticated;
grant update (nom, role, pole, promo, cotisation, statut) on public.profiles to authenticated;

-- Liste des comptes de la présidence : réservée à la présidence.
create or replace function public.presidence_list() returns table(id uuid, nom text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nom, p.email from public.profiles p
  where public.is_president() and p.is_president order by p.nom;
$$;

-- Donner / retirer l'accès présidence : réservé à la présidence.
create or replace function public.set_president(target uuid, value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_president() then raise exception 'Action réservée à la présidence'; end if;
  if target = auth.uid() and value = false
     and (select count(*) from public.profiles where is_president and statut <> 'Ancien') <= 1 then
    raise exception 'Impossible : il doit rester au moins un compte présidence';
  end if;
  update public.profiles set is_president = value where id = target;
end $$;

-- Annuaire léger (noms seulement) pour afficher auteurs et équipes à tous les membres actifs.
create or replace function public.annuaire() returns table(id uuid, nom text, pole text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nom, p.pole from public.profiles p
  where public.my_role() >= 1 and p.statut <> 'Ancien' order by p.nom;
$$;

-- ---------------------------------------------------------------------
-- 2. Projets : identifiant lisible, équipe
-- ---------------------------------------------------------------------
create sequence if not exists public.project_code_seq;
alter table public.projects add column if not exists code text;
alter table public.projects add column if not exists chef_initial uuid references public.profiles(id) on delete set null;

create or replace function public.project_code() returns trigger
language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PRJ-' || lpad(nextval('public.project_code_seq')::text, 3, '0');
  end if;
  return new;
end $$;
drop trigger if exists project_code on public.projects;
create trigger project_code before insert on public.projects
  for each row execute function public.project_code();

-- Identifiants pour les projets existants.
do $$
declare r record;
begin
  for r in select id from public.projects where code is null order by created_at loop
    update public.projects set code = 'PRJ-' || lpad(nextval('public.project_code_seq')::text, 3, '0') where id = r.id;
  end loop;
end $$;
create unique index if not exists projects_code_key on public.projects(code);

create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'Membre' check (role in ('Chef de projet','Membre')),
  added_at    timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and profile_id = auth.uid());
$$;
create or replace function public.is_project_lead(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
                 where project_id = pid and profile_id = auth.uid() and role = 'Chef de projet');
$$;
-- Voir un projet : seul le Board voit tous les projets ; tous les autres
-- (Board ext compris) ne voient que les projets dont ils font partie.
create or replace function public.can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_view('projets') and (public.my_role() = 4 or public.is_project_member(pid));
$$;
-- Gérer un projet (infos, équipe) : Board ou chef de projet.
create or replace function public.can_manage_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 4 or (public.my_role() >= 1 and public.is_project_lead(pid));
$$;
-- Travailler dans un projet (tâches, documents) : gestionnaires + membres du projet.
create or replace function public.can_work_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_project(pid) or (public.my_role() >= 1 and public.is_project_member(pid));
$$;

-- À la création, le créateur désigne le chef de projet (chef_initial),
-- qui peut être une autre personne que lui. Sans choix : le créateur.
create or replace function public.project_initial_chef() returns trigger
language plpgsql security definer set search_path = public as $$
declare chef uuid := coalesce(new.chef_initial, auth.uid());
begin
  if chef is not null and exists (select 1 from public.profiles where id = chef and statut <> 'Ancien') then
    insert into public.project_members (project_id, profile_id, role)
    values (new.id, chef, 'Chef de projet') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists project_creator_lead on public.projects;
drop function if exists public.project_creator_lead();
drop trigger if exists project_initial_chef on public.projects;
create trigger project_initial_chef after insert on public.projects
  for each row execute function public.project_initial_chef();

-- Équipe d'un projet avec les noms (lisible par qui voit le projet).
create or replace function public.project_team(pid uuid) returns table(profile_id uuid, nom text, pole text, role text)
language sql stable security definer set search_path = public as $$
  select m.profile_id, p.nom, p.pole, m.role
  from public.project_members m join public.profiles p on p.id = m.profile_id
  where public.can_see_project(pid) and m.project_id = pid
  order by (m.role = 'Chef de projet') desc, p.nom;
$$;

-- Projets : nouvelles règles (Board : tout ; autres : leurs projets uniquement).
drop policy if exists pr_select on public.projects;
drop policy if exists pr_insert on public.projects;
drop policy if exists pr_update on public.projects;
drop policy if exists pr_delete on public.projects;
create policy pr_select on public.projects for select to authenticated using (public.can_see_project(id));
create policy pr_insert on public.projects for insert to authenticated with check (public.can_edit('projets'));
create policy pr_update on public.projects for update to authenticated using (public.can_manage_project(id)) with check (public.can_manage_project(id));
create policy pr_delete on public.projects for delete to authenticated using (public.my_role() = 4);

alter table public.project_members enable row level security;
drop policy if exists pm_select on public.project_members;
drop policy if exists pm_insert on public.project_members;
drop policy if exists pm_update on public.project_members;
drop policy if exists pm_delete on public.project_members;
create policy pm_select on public.project_members for select to authenticated using (public.can_see_project(project_id));
create policy pm_insert on public.project_members for insert to authenticated with check (public.can_manage_project(project_id));
create policy pm_update on public.project_members for update to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create policy pm_delete on public.project_members for delete to authenticated using (public.can_manage_project(project_id));

-- ---------------------------------------------------------------------
-- 3. Tâches (tableau, kanban, Gantt, RACI)
-- ---------------------------------------------------------------------
create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  titre       text not null,
  description text,
  statut      text not null default 'À faire' check (statut in ('À faire','En cours','Bloqué','Terminé')),
  debut       date,
  fin         date,
  raci        jsonb not null default '{}'::jsonb,   -- { "<profile_id>": "R" | "A" | "C" | "I" }
  ordre       double precision not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  check (fin is null or debut is null or fin >= debut)
);
alter table public.project_tasks enable row level security;
drop policy if exists tk_select on public.project_tasks;
drop policy if exists tk_insert on public.project_tasks;
drop policy if exists tk_update on public.project_tasks;
drop policy if exists tk_delete on public.project_tasks;
create policy tk_select on public.project_tasks for select to authenticated using (public.can_see_project(project_id));
create policy tk_insert on public.project_tasks for insert to authenticated with check (public.can_work_project(project_id));
create policy tk_update on public.project_tasks for update to authenticated using (public.can_work_project(project_id)) with check (public.can_work_project(project_id));
create policy tk_delete on public.project_tasks for delete to authenticated using (public.can_work_project(project_id));

-- ---------------------------------------------------------------------
-- 4. Documents de projet (fichiers dans Supabase Storage, privés)
-- ---------------------------------------------------------------------
create table if not exists public.project_documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  titre       text not null,
  categorie   text not null default 'Autre' check (categorie in ('CR de réunion','Devis','Plan moyen terme','Autre')),
  path        text not null,
  taille      bigint,
  mime        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
alter table public.project_documents enable row level security;
drop policy if exists dc_select on public.project_documents;
drop policy if exists dc_insert on public.project_documents;
drop policy if exists dc_delete on public.project_documents;
create policy dc_select on public.project_documents for select to authenticated using (public.can_see_project(project_id));
create policy dc_insert on public.project_documents for insert to authenticated with check (public.can_work_project(project_id));
create policy dc_delete on public.project_documents for delete to authenticated using (public.can_manage_project(project_id) or created_by = auth.uid());

create or replace function public.safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-docs', 'project-docs', false, 20971520)   -- 20 Mo par fichier
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "docs lecture" on storage.objects;
drop policy if exists "docs envoi" on storage.objects;
drop policy if exists "docs suppression" on storage.objects;
create policy "docs lecture" on storage.objects for select to authenticated
  using (bucket_id = 'project-docs' and public.can_see_project(public.safe_uuid((storage.foldername(name))[1])));
create policy "docs envoi" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-docs' and public.can_work_project(public.safe_uuid((storage.foldername(name))[1])));
create policy "docs suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'project-docs' and (public.can_manage_project(public.safe_uuid((storage.foldername(name))[1])) or owner_id = auth.uid()::text));

-- ---------------------------------------------------------------------
-- 5. Accueil : actualités et discussion
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'discussion' check (kind in ('actu','discussion')),
  titre       text,
  contenu     text not null check (length(contenu) <= 5000),
  parent_id   uuid references public.posts(id) on delete cascade,
  epingle     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null
);
alter table public.posts enable row level security;
drop policy if exists po_select on public.posts;
drop policy if exists po_insert on public.posts;
drop policy if exists po_update on public.posts;
drop policy if exists po_delete on public.posts;
create policy po_select on public.posts for select to authenticated using (public.can_view('accueil'));
create policy po_insert on public.posts for insert to authenticated with check (public.can_edit('accueil') and created_by = auth.uid());
create policy po_update on public.posts for update to authenticated
  using ((created_by = auth.uid() and public.can_edit('accueil')) or public.my_role() = 4)
  with check ((created_by = auth.uid() and public.can_edit('accueil')) or public.my_role() = 4);
create policy po_delete on public.posts for delete to authenticated
  using ((created_by = auth.uid() and public.can_edit('accueil')) or public.my_role() = 4);

-- Niveau d'accès par défaut de la page Accueil : lecture Membre, écriture Board ext.
update public.settings
   set value = value || '{"accueil":{"view":1,"edit":3}}'::jsonb
 where key = 'access' and not (value ? 'accueil');

-- ---------------------------------------------------------------------
-- 5 bis. Documents de l'association (statuts signés, règlement, modèles…)
--        Lecture selon la page « Documents » ; ajout et suppression : Board.
-- ---------------------------------------------------------------------
create table if not exists public.asso_documents (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (length(nom) <= 200),
  path        text not null,
  taille      bigint,
  mime        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
alter table public.asso_documents enable row level security;
drop policy if exists ad_select on public.asso_documents;
drop policy if exists ad_insert on public.asso_documents;
drop policy if exists ad_update on public.asso_documents;
drop policy if exists ad_delete on public.asso_documents;
create policy ad_select on public.asso_documents for select to authenticated using (public.can_view('documents'));
create policy ad_insert on public.asso_documents for insert to authenticated with check (public.my_role() = 4);
create policy ad_update on public.asso_documents for update to authenticated using (public.my_role() = 4) with check (public.my_role() = 4);
create policy ad_delete on public.asso_documents for delete to authenticated using (public.my_role() = 4);

insert into storage.buckets (id, name, public, file_size_limit)
values ('asso-docs', 'asso-docs', false, 52428800)   -- 50 Mo par fichier
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "asso docs lecture" on storage.objects;
drop policy if exists "asso docs envoi" on storage.objects;
drop policy if exists "asso docs suppression" on storage.objects;
create policy "asso docs lecture" on storage.objects for select to authenticated
  using (bucket_id = 'asso-docs' and public.can_view('documents'));
create policy "asso docs envoi" on storage.objects for insert to authenticated
  with check (bucket_id = 'asso-docs' and public.my_role() = 4);
create policy "asso docs suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'asso-docs' and public.my_role() = 4);

-- Niveau d'accès par défaut de la page Documents : lecture Membre, ajout Board.
update public.settings
   set value = value || '{"documents":{"view":1,"edit":4}}'::jsonb
 where key = 'access' and not (value ? 'documents');

-- ---------------------------------------------------------------------
-- 6. Réglages (nom, couleur, logo) : lisibles par tous, y compris sur
--    l'écran de connexion ; modifiables par la présidence uniquement.
-- ---------------------------------------------------------------------
grant select on public.settings to anon;
drop policy if exists st_branding_anon on public.settings;
create policy st_branding_anon on public.settings for select to anon using (key = 'branding');

drop policy if exists st_select on public.settings;
drop policy if exists st_insert on public.settings;
drop policy if exists st_update on public.settings;
create policy st_select on public.settings for select to authenticated using (
     key = 'branding'
  or (key = 'access'  and public.my_role() >= 1)
  or (key = 'legal'   and public.can_view('legal'))
  or (key = 'finance' and public.can_view('finances')));
create policy st_insert on public.settings for insert to authenticated with check (
     (key = 'branding' and public.is_president())
  or (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')));
create policy st_update on public.settings for update to authenticated
  using (
     (key = 'branding' and public.is_president())
  or (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')))
  with check (
     (key = 'branding' and public.is_president())
  or (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')));

-- ---------------------------------------------------------------------
-- 7. Droits, temps réel
-- ---------------------------------------------------------------------
revoke all on public.project_members, public.project_tasks, public.project_documents, public.posts, public.asso_documents from anon;
grant select, insert, update, delete on public.project_members, public.project_tasks, public.project_documents, public.posts, public.asso_documents to authenticated;
grant usage, select on sequence public.project_code_seq to authenticated;
grant execute on function public.is_president(), public.presidence_list(), public.set_president(uuid, boolean),
  public.annuaire(), public.is_project_member(uuid), public.is_project_lead(uuid), public.can_see_project(uuid),
  public.can_manage_project(uuid), public.can_work_project(uuid), public.project_team(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['project_members','project_tasks','project_documents','posts','asso_documents'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. PRÉSIDENCE — à adapter puis exécuter une seule fois.
--    Remplacez l'adresse par celle du compte de la présidence.
-- ---------------------------------------------------------------------
-- update public.profiles set is_president = true where email = 'prenom.nom@exemple.fr';
