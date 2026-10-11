# Runbook de déploiement Tiếng Nhà

Document destiné à Marc. Toutes les actions qui demandent tes comptes (GitHub, Supabase, Netlify) sont faites **par toi**. Ne copie jamais une clé ou un secret dans ce fichier, dans un commit ou dans une conversation.

Durée estimée : 1 h 30 environ, en une ou deux séances.

> Repère : la branche de travail est `feat/v1`. Le dépôt GitHub s'appellera `MarcVo00/Tieng-Nha`, le projet Supabase `tieng-nha`.

---

## Étape 0 : valider la base de données en local (obligatoire)

Docker Desktop n'a pas démarré sur ton PC pendant le développement. Conséquence : **la migration SQL (`supabase/migrations/20261010000000_init.sql`) et les 37 tests pgTAP (`supabase/tests/`) n'ont jamais été exécutés**. Rien ne doit partir en production avant ça.

1. Lance **Docker Desktop** (menu Démarrer). Accepte les conditions d'utilisation et les mises à jour proposées. Si Docker demande d'activer l'intégration **WSL2**, accepte (au besoin : Settings → General → « Use the WSL 2 based engine », puis redémarre Docker). Attends que Docker indique « Engine running ».
2. Vérifie que Docker répond :
   ```bash
   docker version
   ```
   Les sections Client **et** Server doivent s'afficher.
3. Depuis le dossier du projet :
   ```bash
   npm run db:start
   npx supabase db reset
   npx supabase test db
   ```
   Résultat attendu : **37/37 tests OK** (`Result: PASS`). Le premier `db:start` télécharge plusieurs images et prend quelques minutes.
4. Régénère les types TypeScript (le fichier `src/adapters/supabase/types.gen.ts` est aujourd'hui écrit à la main, comme l'indique son en-tête) :
   ```bash
   npm run db:types
   ```
5. Revalide tout le projet :
   ```bash
   npm run verify
   ```
6. Commit :
   ```bash
   git add src/adapters/supabase/types.gen.ts
   git commit -m "chore(db): regenerate supabase types from local schema"
   ```

**Si un test SQL échoue, ou si `npm run verify` casse après la régénération des types : STOP.** Copie la sortie complète de l'erreur et envoie-la à Claude pour correction. N'avance pas aux étapes suivantes.

Pour arrêter la base locale ensuite : `npx supabase stop`.

---

## Étape 1 : GitHub

1. Sur github.com : **New repository** → nom `Tieng-Nha` → **Private** → ne coche aucune option d'initialisation (pas de README, pas de .gitignore).
2. Dans le dossier du projet :
   ```bash
   git remote add origin https://github.com/MarcVo00/Tieng-Nha.git
   git push -u origin feat/v1
   ```
   Si la branche `main` locale existe, pousse-la aussi : `git push origin main`.
3. Deux options, à ton choix :
   - **Option A (recommandée)** : ouvrir une Pull Request `feat/v1` → `main` sur GitHub. La CI se déclenche sur les PR.
   - **Option B** : fusionner directement :
     ```bash
     git checkout main
     git merge feat/v1
     git push origin main
     ```
     La CI se déclenche aussi sur un push vers `main`.
4. Regarde l'onglet **Actions**. La CI comporte deux jobs :
   - `verify` : typecheck, lint, tests, build, E2E Playwright, Lighthouse ;
   - `database` : démarre Supabase et lance `supabase test db`. **C'est la première exécution côté CI du SQL.** Si l'étape 0 est validée en local, il doit passer au vert.
5. Si un job est rouge, envoie le lien du run (ou le log) à Claude. Ne fusionne pas tant que `database` n'est pas vert.

---

## Étape 2 : Supabase production

1. Sur supabase.com : **New project** → nom `tieng-nha` → région **Europe** (West Europe / Paris ou Frankfurt) → choisis un mot de passe de base de données fort et **range-le dans ton gestionnaire de mots de passe** (jamais dans le dépôt).
2. Récupère la **référence du projet** (Project Settings → General → « Reference ID »).
3. En local :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   `db push` applique la migration `20261010000000_init.sql` sur la base de production. Le fichier `supabase/seed.sql` (groupe de test local) n'est **pas** appliqué en production.
4. Crée le **vrai groupe**. Choisis ton code d'invitation (court, facile à dicter ; tu le partageras avec la famille). Dans le dashboard : **SQL Editor** → exécute :
   ```sql
   insert into public.groups (name, invite_code) values ('Famille', '<CODE-CHOISI>');
   ```
   Vérifie :
   ```sql
   select id, name, invite_code from public.groups;
   ```
   La table `groups` n'est lisible que par un utilisateur connecté membre du groupe ; seul le SQL Editor la lit librement. C'est normal.

---

## Étape 3 : paramètres d'authentification (dashboard Supabase)

L'application utilise la connexion par **code à 6 chiffres reçu par e-mail** (OTP), sans mot de passe.

1. **Authentication → Providers → Email** :
   - Email : **activé** ;
   - **Confirm email : désactivé** ;
   - **Email OTP Length : 6**.
2. **Authentication → Email Templates** : modifie **les deux** modèles :
   - **Magic Link** ;
   - **Confirm signup**.

   Pour chacun, colle le contenu de `supabase/templates/otp.html` et mets le sujet `Ton code Tiếng Nhà`. Le corps **doit contenir `{{ .Token }}`** : c'est lui qui affiche le code à 6 chiffres. Sans lui, l'e-mail ne contient qu'un lien et la connexion échoue.
3. **Authentication → URL Configuration** :
   - **Site URL** = l'URL Netlify (obtenue à l'étape 5, reviens ici ensuite) ;
   - **Redirect URLs** : ajoute la même URL Netlify.

   Si tu renommes le site Netlify plus tard, mets à jour ces deux champs.

---

## Étape 4 : limite d'envoi d'e-mails (SMTP gratuit recommandé)

Le service d'e-mail intégré de Supabase n'envoie que **quelques e-mails par heure** pour tout le projet. C'est suffisant pour tester, mais risqué si toute la famille s'inscrit le jour de l'anniversaire : les codes n'arriveraient plus.

Recommandation (gratuite) : crée un compte **Brevo** ou **Resend**, puis :

1. Chez le fournisseur, génère des identifiants SMTP (hôte, port, utilisateur, mot de passe ou clé SMTP) et valide un expéditeur. Sans domaine à toi, utilise l'expéditeur vérifié ou « sandbox » du fournisseur (par exemple `vietlearn@<domaine ou sandbox du fournisseur>`). Vérifie les quotas du plan gratuit.
2. Supabase → **Authentication → SMTP Settings** → active le SMTP personnalisé et saisis ces identifiants (uniquement dans le dashboard Supabase, nulle part ailleurs).
3. Envoie-toi un code de test (étape 7) et vérifie la boîte de réception **et les spams**.

Si tu ne le fais pas : fais inscrire les personnes **quelques-unes à la fois**, avec une pause entre les groupes.

---

## Étape 5 : Netlify

1. Sur netlify.com : **Add new site → Import an existing project → GitHub** → dépôt `Tieng-Nha` (branche de production : `main`).
2. Les réglages de build viennent de `netlify.toml` (commande `npm run build`, dossier `dist`, Node 20) ; ne les change pas. La redirection SPA (`/* → /index.html`) vient de `public/_redirects`.
3. **Site configuration → Environment variables**, ajoute :

   | Variable | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase → Project Settings → API → **Project URL** |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → clé **anon public** (jamais la `service_role`) |
   | `VITE_WELCOME_MESSAGE` | Le message d'anniversaire affiché à l'accueil (texte libre, emoji autorisés) |
   | `VITE_USE_FAKES` | `false` |
   | `VITE_FAKE_SPEECH` | `false` |

   **Garde-fou :** l'application refuse de démarrer si elle est compilée avec `VITE_USE_FAKES=true` sur un vrai domaine (hors `localhost` / `127.0.0.1`). Si tu vois un écran d'erreur au lieu de l'app, vérifie d'abord ces variables. Elles sont lues au moment du **build** : après toute modification, redéploie (Deploys → Trigger deploy → Clear cache and deploy site).
4. Lance le déploiement. Optionnel : **Site configuration → Change site name** → `tieng-nha.netlify.app`.
5. Copie l'URL finale et retourne à l'**étape 3.3** (Site URL et Redirect URLs de Supabase) si ce n'est pas fait.
6. URL de production, à compléter : `<URL à compléter>`

---

## Étape 6 : secrets GitHub (keep-alive)

Les projets Supabase gratuits sont mis en pause après une semaine d'inactivité. Le workflow `.github/workflows/keepalive.yml` interroge la base tous les 3 jours pour l'éviter.

Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret**, deux secrets :

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | la même Project URL que `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | la clé **anon public** |

Teste : onglet **Actions → Supabase keep-alive → Run workflow**. Il doit finir au vert (la requête renvoie une liste vide pour un visiteur non connecté : c'est normal, seul le code HTTP de succès compte).

---

## Étape 7 : test de fumée

Sur un ordinateur :

1. Ouvre l'URL Netlify. L'application s'affiche (pas d'écran d'erreur).
2. Onboarding : saisis ton e-mail et le **vrai code d'invitation**. Reçois le code à 6 chiffres (en moins d'une minute) et valide-le.
3. Termine la leçon 1.
4. Dans Supabase → SQL Editor, vérifie que ta ligne apparaît dans le classement :
   ```sql
   select * from leaderboard;
   ```
5. Recharge la page : tu restes connecté. Coupe le réseau (DevTools → Network → Offline) : la page se charge encore.

Si une étape échoue, note laquelle, joins une capture ou le message d'erreur, et envoie-le à Claude.

Ensuite, passe à `docs/qa-checklist.md` (tests sur vrais appareils et préparation du cadeau).

---

## Dépannage rapide

| Symptôme | Piste |
|---|---|
| Écran d'erreur au démarrage sur Netlify | `VITE_USE_FAKES` n'est pas `false`, ou `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` manquent. Corrige, puis redéploie. |
| Aucun e-mail de code reçu | Limite du mailer intégré (étape 4), spams, ou gabarit sans `{{ .Token }}`. |
| Le message contient un lien, pas 6 chiffres | Gabarits Magic Link / Confirm signup non remplacés (étape 3.2) ou longueur OTP différente de 6. |
| « Code d'invitation incorrect » | Le groupe n'a pas été inséré, ou le code diffère (casse, espaces). Contrôle avec `select * from public.groups;`. |
| `supabase db push` échoue | Vérifie `supabase link` (bonne référence de projet) ; envoie le message à Claude. |
| Job CI `database` rouge | Lis le log du job ; si c'est vert en local, signale-le à Claude. |
