-- =====================================================================
--  ProteusBoard — Antenne Arts et Métiers
--  Schéma Supabase : tables, règles d'accès par profil (RLS), invitations
--
--  À exécuter dans Supabase > SQL Editor > New query > Run.
--  Le script peut être relancé sans casser les données existantes.
--
--  Profils : 1 = Membre · 2 = Resp. projet · 3 = Board ext · 4 = Board
--  Un membre au statut « Ancien » perd tout accès (profil 0).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- Invitations : seules les adresses invitées peuvent créer un compte.
create table if not exists public.invitations (
  email       text primary key,
  nom         text,
  role        int  not null default 1 check (role between 1 and 4),
  pole        text,
  invited_at  timestamptz not null default now(),
  invited_by  uuid default auth.uid()
);

-- Profils : une ligne par compte, créée automatiquement à la 1re connexion.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nom         text,
  role        int  not null default 1 check (role between 1 and 4),
  pole        text,
  promo       text,
  cotisation  text not null default 'En attente',
  statut      text not null default 'Actif',
  created_at  timestamptz not null default now()
);

-- Réglages partagés : 'access' (niveaux par page), 'legal', 'finance'.
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  pilote      text,
  lancement   date,
  budget      numeric(12,2),
  categorie   text,
  statut      text default 'En cours',
  lien        text,
  description text,
  exemple     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  sens        text not null check (sens in ('entree','sortie')),
  libelle     text not null,
  montant     numeric(12,2) not null check (montant >= 0),
  categorie   text,
  tiers       text,
  projet      uuid references public.projects(id) on delete set null,
  note        text,
  exemple     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  type        text,
  date        date not null,
  heure       text,
  lieu        text,
  lien        text,
  description text,
  exemple     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  type        text,
  statut      text default 'Prospect',
  contact     text,
  montant     numeric(12,2),
  relance     date,
  note        text,
  exemple     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

-- Niveaux d'accès par défaut (modifiables ensuite depuis la page « Accès »).
insert into public.settings (key, value) values ('access', '{
  "board":       {"view":1,"edit":4},
  "finances":    {"view":3,"edit":4},
  "projets":     {"view":1,"edit":2},
  "calendrier":  {"view":1,"edit":2},
  "membres":     {"view":3,"edit":4},
  "partenaires": {"view":3,"edit":3},
  "legal":       {"view":1,"edit":4},
  "acces":       {"view":4,"edit":4}
}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Fonctions d'accès
-- ---------------------------------------------------------------------

-- Profil de la personne connectée (0 si inconnue ou « Ancien »).
create or replace function public.my_role() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and statut <> 'Ancien'),
    0);
$$;

-- Niveau minimum d'une page pour 'view' ou 'edit' (4 = Board si non défini).
create or replace function public.page_level(p text, k text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value -> p ->> k)::int from public.settings where key = 'access'), 4);
$$;

create or replace function public.can_view(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and public.my_role() >= greatest(1, public.page_level(p, 'view'));
$$;

create or replace function public.can_edit(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and public.my_role() >= greatest(1, public.page_level(p, 'edit'));
$$;

-- Chiffres du tableau de bord, visibles par tous les membres actifs
-- (des totaux seulement, jamais le détail).
create or replace function public.dashboard_stats() returns json
language sql stable security definer set search_path = public as $$
  select case when public.my_role() < 1 then null else json_build_object(
    'membres',             (select count(*) from public.profiles where statut <> 'Ancien'),
    'cotisations_attente', (select count(*) from public.profiles where statut <> 'Ancien'
                              and cotisation not in ('Payée','Exonéré')),
    'projets_en_cours',    (select count(*) from public.projects where statut = 'En cours'),
    'projets_total',       (select count(*) from public.projects),
    'actions_30j',         (select count(*) from public.events
                              where date between current_date and current_date + 30),
    'prochaine_action',    (select min(date) from public.events where date >= current_date)
  ) end;
$$;

-- ---------------------------------------------------------------------
-- 3. Déclencheurs
-- ---------------------------------------------------------------------

-- Création de compte : refusée si l'adresse n'a pas été invitée.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where email = lower(new.email);
  if not found then
    raise exception 'Inscription refusée : % n''a pas été invité·e', new.email;
  end if;
  insert into public.profiles (id, email, nom, role, pole)
  values (new.id, lower(new.email),
          coalesce(nullif(inv.nom, ''), split_part(new.email, '@', 1)),
          inv.role, inv.pole);
  delete from public.invitations where email = inv.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils : e-mail non modifiable ; seul le Board change un profil d'accès.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL Editor / admin
  if new.id <> old.id or new.email is distinct from old.email then
    raise exception 'Ce champ ne peut pas être modifié';
  end if;
  if new.role <> old.role and public.my_role() < 4 then
    raise exception 'Seul le Board peut changer un profil d''accès';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile();

-- La page « Accès » reste toujours réservée au Board.
create or replace function public.guard_access() returns trigger
language plpgsql as $$
begin
  if new.key = 'access' then
    new.value := jsonb_set(new.value, '{acces}', '{"view":4,"edit":4}'::jsonb, true);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_access on public.settings;
create trigger guard_access
  before insert or update on public.settings
  for each row execute function public.guard_access();

-- ---------------------------------------------------------------------
-- 4. Règles d'accès (Row Level Security)
--    Appliquées par la base : impossible à contourner depuis le navigateur.
-- ---------------------------------------------------------------------

alter table public.invitations  enable row level security;
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.projects     enable row level security;
alter table public.transactions enable row level security;
alter table public.events       enable row level security;
alter table public.partners     enable row level security;

-- Finances
drop policy if exists tx_select on public.transactions;
drop policy if exists tx_insert on public.transactions;
drop policy if exists tx_update on public.transactions;
drop policy if exists tx_delete on public.transactions;
create policy tx_select on public.transactions for select to authenticated using (public.can_view('finances'));
create policy tx_insert on public.transactions for insert to authenticated with check (public.can_edit('finances'));
create policy tx_update on public.transactions for update to authenticated using (public.can_edit('finances')) with check (public.can_edit('finances'));
create policy tx_delete on public.transactions for delete to authenticated using (public.can_edit('finances'));

-- Projets
drop policy if exists pr_select on public.projects;
drop policy if exists pr_insert on public.projects;
drop policy if exists pr_update on public.projects;
drop policy if exists pr_delete on public.projects;
create policy pr_select on public.projects for select to authenticated using (public.can_view('projets') or public.can_view('finances'));
create policy pr_insert on public.projects for insert to authenticated with check (public.can_edit('projets'));
create policy pr_update on public.projects for update to authenticated using (public.can_edit('projets')) with check (public.can_edit('projets'));
create policy pr_delete on public.projects for delete to authenticated using (public.can_edit('projets'));

-- Calendrier
drop policy if exists ev_select on public.events;
drop policy if exists ev_insert on public.events;
drop policy if exists ev_update on public.events;
drop policy if exists ev_delete on public.events;
create policy ev_select on public.events for select to authenticated using (public.can_view('calendrier') or public.can_view('board'));
create policy ev_insert on public.events for insert to authenticated with check (public.can_edit('calendrier'));
create policy ev_update on public.events for update to authenticated using (public.can_edit('calendrier')) with check (public.can_edit('calendrier'));
create policy ev_delete on public.events for delete to authenticated using (public.can_edit('calendrier'));

-- Partenaires
drop policy if exists pa_select on public.partners;
drop policy if exists pa_insert on public.partners;
drop policy if exists pa_update on public.partners;
drop policy if exists pa_delete on public.partners;
create policy pa_select on public.partners for select to authenticated using (public.can_view('partenaires'));
create policy pa_insert on public.partners for insert to authenticated with check (public.can_edit('partenaires'));
create policy pa_update on public.partners for update to authenticated using (public.can_edit('partenaires')) with check (public.can_edit('partenaires'));
create policy pa_delete on public.partners for delete to authenticated using (public.can_edit('partenaires'));

-- Membres (profils) : chacun voit sa propre fiche ; l'annuaire selon la page « Membres ».
drop policy if exists pf_select on public.profiles;
drop policy if exists pf_update on public.profiles;
drop policy if exists pf_delete on public.profiles;
create policy pf_select on public.profiles for select to authenticated using (id = auth.uid() or public.can_view('membres'));
create policy pf_update on public.profiles for update to authenticated using (public.can_edit('membres')) with check (public.can_edit('membres'));
create policy pf_delete on public.profiles for delete to authenticated using (public.can_edit('membres') and id <> auth.uid());

-- Invitations : gérées par ceux qui éditent « Membres », sans pouvoir inviter au-dessus de leur profil.
drop policy if exists in_select on public.invitations;
drop policy if exists in_insert on public.invitations;
drop policy if exists in_delete on public.invitations;
create policy in_select on public.invitations for select to authenticated using (public.can_edit('membres'));
create policy in_insert on public.invitations for insert to authenticated with check (public.can_edit('membres') and role <= public.my_role());
create policy in_delete on public.invitations for delete to authenticated using (public.can_edit('membres'));

-- Réglages
drop policy if exists st_select on public.settings;
drop policy if exists st_insert on public.settings;
drop policy if exists st_update on public.settings;
create policy st_select on public.settings for select to authenticated using (
     (key = 'access'  and public.my_role() >= 1)
  or (key = 'legal'   and public.can_view('legal'))
  or (key = 'finance' and public.can_view('finances')));
create policy st_insert on public.settings for insert to authenticated with check (
     (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')));
create policy st_update on public.settings for update to authenticated
  using (
     (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')))
  with check (
     (key = 'access'  and public.my_role() = 4)
  or (key = 'legal'   and public.can_edit('legal'))
  or (key = 'finance' and public.can_edit('finances')));

-- Les visiteurs non connectés n'ont accès à rien.
revoke all on all tables in schema public from anon;

-- Les personnes connectées passent par les règles ci-dessus (nécessaire si
-- « Automatically expose new tables » a été décoché à la création du projet).
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.invitations, public.profiles, public.settings, public.projects,
  public.transactions, public.events, public.partners
  to authenticated;
grant execute on function public.my_role(), public.page_level(text, text),
  public.can_view(text), public.can_edit(text), public.dashboard_stats()
  to authenticated;

-- ---------------------------------------------------------------------
-- 5. Temps réel (mises à jour en direct entre membres)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['transactions','projects','events','partners','profiles','settings','invitations'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. PREMIER COMPTE BOARD — à adapter puis exécuter une seule fois
--    Remplacez l'adresse et le nom, puis connectez-vous sur le site.
-- ---------------------------------------------------------------------
-- insert into public.invitations (email, nom, role, pole)
-- values ('prenom.nom@exemple.fr', 'Prénom Nom', 4, 'Présidence');
