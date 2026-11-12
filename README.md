# ProteusBoard — Antenne Arts et Métiers

Interface de pilotage de l'antenne : tableau de bord, finances, projets, calendrier, membres, partenaires, cadre légal et niveaux d'accès.

- **Site** : GitHub Pages (gratuit, aucun serveur à gérer)
- **Données et connexion** : Supabase (gratuit à votre échelle)
- **Sécurité** : chaque page a un niveau de confidentialité, vérifié par la base de données elle-même. Un Membre ne reçoit jamais les finances, même en inspectant le site.

Comptez environ 30 minutes pour la mise en place.

---

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | La page du site |
| `app.js` | Le fonctionnement de l'interface |
| `config.js` | **À remplir** : adresse et clé publique de votre projet Supabase |
| `supabase/schema.sql` | Tables, règles d'accès et invitations (à exécuter une fois dans Supabase) |
| `robots.txt`, `.nojekyll` | Non-référencement et compatibilité GitHub Pages |
| `.github/workflows/keepalive.yml` | Empêche la mise en pause du projet Supabase gratuit (facultatif) |

---

## Étape 1 — Créer le projet Supabase (10 min)

1. Créez un compte sur [supabase.com](https://supabase.com), de préférence avec l'adresse de l'antenne plutôt qu'une adresse personnelle.
2. **New project** :
   - Nom : `proteusboard`
   - Mot de passe de base de données : générez-le et gardez-le dans le gestionnaire de mots de passe du Board.
   - **Région : Europe (Paris — `eu-west-3`)**, pour que les données restent dans l'UE (RGPD).
3. Une fois le projet prêt, ouvrez **SQL Editor → New query**.
4. Collez tout le contenu de `supabase/schema.sql`, puis cliquez **Run**.
5. Toujours dans le SQL Editor, créez **votre propre invitation Board** (remplacez l'adresse et le nom) :
   ```sql
   insert into public.invitations (email, nom, role, pole)
   values ('prenom.nom@exemple.fr', 'Prénom Nom', 4, 'Présidence');
   ```

## Étape 2 — Régler la connexion (5 min)

Dans **Authentication** :

1. **Sign In / Providers → Email** : laissez **Email** activé et **Allow new users to sign up** activé.
   Ce n'est pas risqué : la base refuse toute adresse qui n'a pas été invitée.
2. **URL Configuration** :
   - **Site URL** : l'adresse de votre site GitHub Pages (étape 4), par exemple `https://proteus-am.github.io/proteusboard/`
   - **Redirect URLs** : ajoutez la même adresse.
3. **E-mails (important)** : l'envoi d'e-mails inclus dans Supabase est limité à quelques messages par heure. Avant d'inviter toute l'équipe, configurez un envoi d'e-mails dédié dans **Authentication → Emails → SMTP Settings**. Par exemple Brevo (300 e-mails par jour gratuits) : créez un compte, récupérez les identifiants SMTP et collez-les ici.
4. *(Facultatif)* Dans **Emails → Templates**, traduisez en français le message « Magic Link ».

## Étape 3 — Relier le site à Supabase (2 min)

1. Dans Supabase : **Project Settings → API**.
2. Copiez **Project URL** et la clé **anon public** dans `config.js` :
   ```js
   window.PROTEUS_CONFIG = {
     supabaseUrl: "https://abcdefgh.supabase.co",
     supabaseAnonKey: "eyJhbGciOi..."
   };
   ```
   La clé *anon* est faite pour être publique. **Ne copiez jamais la clé `service_role`**, ni dans ce fichier ni ailleurs dans le dépôt.

## Étape 4 — Publier sur GitHub Pages (5 min)

1. Créez un compte GitHub pour l'antenne et activez la double authentification.
   *(Avec un e-mail étudiant, demandez le [GitHub Student Developer Pack](https://education.github.com/pack) : il donne GitHub Pro, et donc la possibilité d'utiliser un dépôt privé avec Pages.)*
2. **New repository** → nom `proteusboard`.
   - Compte gratuit : dépôt **Public**. Le code est visible, mais vos données ne le sont pas : elles restent dans Supabase, derrière la connexion.
   - Avec GitHub Pro : dépôt **Private**.
3. Envoyez les fichiers de ce dossier, au choix :
   - **Sans ligne de commande** : sur la page du dépôt, cliquez **Add file → Upload files** et glissez-y tout le contenu du dossier (y compris `.nojekyll` et le dossier `.github`), puis **Commit changes**.
   - **Avec git** :
     ```bash
     git init && git add . && git commit -m "ProteusBoard"
     ```
     ```bash
     git branch -M main && git remote add origin https://github.com/VOTRE-COMPTE/proteusboard.git && git push -u origin main
     ```
4. **Settings → Pages → Build and deployment** : *Source* = **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
5. Au bout d'une minute, le site est en ligne à `https://VOTRE-COMPTE.github.io/proteusboard/`. Reportez cette adresse dans Supabase (étape 2.2) si ce n'est pas déjà fait.

## Étape 5 — Première connexion et invitations

1. Ouvrez le site, saisissez votre adresse et cliquez **Recevoir un lien de connexion**.
2. Ouvrez le lien reçu : vous êtes connecté·e en tant que **Board**.
3. *(Conseillé)* **Mot de passe** dans le menu : définissez un mot de passe pour ne plus dépendre des e-mails.
4. Page **Membres → + Inviter un membre** : adresse, nom, profil et pôle. La personne reçoit un lien, et son compte est créé avec le bon profil dès sa première connexion.
5. Si la base est vide, un bouton **Charger les exemples** permet de découvrir l'outil, puis **Supprimer les exemples** nettoie tout.

## Étape 6 (facultative) — Éviter la mise en pause

Un projet Supabase gratuit **se met en pause après 7 jours sans activité** (on le relance d'un clic dans le tableau de bord, sans perte de données). Pour l'éviter :

1. GitHub → **Settings → Secrets and variables → Actions → New repository secret**
2. Ajoutez `SUPABASE_URL` et `SUPABASE_ANON_KEY` (mêmes valeurs que `config.js`).
3. Le fichier `.github/workflows/keepalive.yml` contacte alors Supabase tous les 3 jours. Vérifiez sa première exécution dans l'onglet **Actions** (bouton **Run workflow** pour tester).

---

## Profils et niveaux d'accès

| Profil | Code |
|---|---|
| Membre | 1 |
| Resp. projet | 2 |
| Board ext | 3 |
| Board | 4 |

Niveaux par défaut, modifiables par le Board depuis la page **Accès** :

| Page | Lecture à partir de | Modification à partir de |
|---|---|---|
| ProteusBoard | Membre | Board |
| Finances | Board ext | Board |
| Projets | Membre | Resp. projet |
| Calendrier | Membre | Resp. projet |
| Membres | Board ext | Board |
| Partenaires | Board ext | Board ext |
| Légal | Membre | Board |
| Accès | Board | Board |

**Ce que garantit la base :**
- Seules les adresses invitées peuvent créer un compte.
- Chaque lecture et chaque écriture est vérifiée selon le profil et la page.
- Seul le Board peut changer le profil d'une personne ou les niveaux d'accès.
- On ne peut pas inviter quelqu'un avec un profil supérieur au sien.
- Le statut **« Ancien »** coupe immédiatement tous les accès.
- Les visiteurs non connectés n'ont accès à rien.
- La page d'accueil indique seulement des totaux (nombre de membres, de projets, d'actions), jamais le détail.

**Ce que vous devez faire :**
- **Ne jamais saisir** d'IBAN, de mots de passe, de pièces d'identité ou de données de santé.
- Activer la double authentification sur les comptes GitHub et Supabase du Board.
- À chaque changement de Board : passer les sortants en « Ancien », transmettre les accès GitHub et Supabase, changer le mot de passe de la base.
- Exporter les finances chaque mois (bouton **Exporter (CSV)** de la page Finances). L'offre gratuite de Supabase ne fournit pas de sauvegarde téléchargeable.
- Informer les membres des données conservées (nom, e-mail, pôle, promo, cotisation) et de leur finalité (RGPD).

## Non-référencement

- La page contient `<meta name="robots" content="noindex, nofollow">`.
- `robots.txt` interdit l'exploration, mais il ne s'applique que s'il est à la racine du domaine (dépôt `VOTRE-COMPTE.github.io` ou domaine personnalisé).
- Sans connexion, un visiteur ne voit que l'écran de connexion.

## Problèmes fréquents

| Symptôme | Solution |
|---|---|
| « Site pas encore relié » | `config.js` n'est pas rempli. |
| « Cette adresse n'a pas été invitée » | Invitez-la depuis la page Membres (ou en SQL pour le premier compte). |
| Le lien de connexion renvoie vers une mauvaise page | Vérifiez **Site URL** et **Redirect URLs** dans Supabase. |
| « Trop de demandes d'e-mail » | Configurez un SMTP dédié (étape 2.3) ou utilisez un mot de passe. |
| Données qui ne chargent plus | Le projet Supabase est peut-être en pause : relancez-le dans le tableau de bord. |

## Modifier le site

Les listes (pôles, catégories techniques, types d'événements, catégories de dépenses) sont en haut de `app.js`, dans la partie « constantes ». Après une modification, renvoyez le fichier sur GitHub : le site se met à jour en une minute.
