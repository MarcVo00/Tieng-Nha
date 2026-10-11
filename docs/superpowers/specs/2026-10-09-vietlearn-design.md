# VietLearn — Spécification de design (V1)

> Nom final de l'app : Tiếng Nhà (anciennement VietLearn)

> Statut : **validé** par Marc le 2026-10-09. Toute déviation doit faire l'objet d'un nouvel ADR (`docs/adr/`).
> Langue des docs : français. Langue du code (identifiants, commentaires, commits) : anglais.

## 0. Contexte et objectifs

- **Quoi** : une PWA pour apprendre le **vietnamien du Sud (Sài Gòn)** destinée à des **francophones débutants**.
- **Pour qui** : cadeau d'anniversaire ; l'apprenant principal + son entourage (cercle privé, < 50 personnes).
- **Deadline** : V1 utilisable **avant le 2026-11-09**.
- **Budget** : 0 €. Aucun service payant, aucune API LLM payante.
- **Différenciants** : oral (écoute + prononciation), conversations scénarisées, test final noté, **compétition** entre membres du cercle (XP, classement, streak, badges).

### Critères de succès V1
1. 10 leçons jouables de bout en bout, hors ligne, sur iPhone, Android et PC.
2. Exercices de prononciation fonctionnels là où la reconnaissance vocale existe, repli propre ailleurs.
3. 10 dialogues scénarisés jouables à l'oral ou au toucher.
4. Test final (30 questions) avec certificat ≥ 70/100.
5. Classement hebdo/total, profils, streak, 12 badges, synchronisés via Supabase.
6. Écran Révision (Leitner), mode sombre, transitions fluides.
7. CI verte : typecheck, lint, tests, validation contenu, build, Lighthouse PWA ≥ 90.

### Hors périmètre V1
IA conversationnelle, enregistrements humains, notifications push, gel de streak, admin de contenu, analytics, monétisation, écriture manuscrite, interface autre que française. (Les points d'extension existent — voir §11.)

## 1. Stack (versions figées)

| Rôle | Paquet | Version |
|---|---|---|
| Build | `vite` | `^5.4` |
| UI | `react`, `react-dom` | `^18.3` |
| Langage | `typescript` | `^5.6` (strict) |
| Routing | `react-router-dom` | `^6.26` (data router : `createBrowserRouter`) |
| Style | `tailwindcss` | `^3.4` (+ `postcss`, `autoprefixer`) |
| Animations | `motion` | `^11` (import depuis `motion/react`) |
| PWA | `vite-plugin-pwa` | `^0.20` (mode `generateSW`, `registerType: 'prompt'`) |
| État | `zustand` | `^5` |
| Stockage local | `dexie` | `^4` |
| Backend | `@supabase/supabase-js` | `^2.45` |
| Validation | `zod` | `^3.23` |
| Tests unitaires | `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `fake-indexeddb` | `^2.1` / dernières compatibles |
| Scripts TS | `tsx` | `^4` |
| E2E | `@playwright/test` | `^1.48` |
| Lint | `eslint` (flat config), `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-boundaries`, `eslint-plugin-i18next`, `globals` | `^9` (eslint) / dernières compatibles |
| Format | `prettier` | `^3` |
| Police | `@fontsource/be-vietnam-pro` | latest (auto-hébergée) |

Gestionnaire de paquets : **npm**. Node : **20 LTS**. Ne jamais ajouter une dépendance hors de cette liste sans ADR.

## 2. Architecture (voir ADR 0001–0010)

### 2.1 Couches
```
features/*  (UI React, hooks d'écran)
    │ appelle
services/   (logique métier PURE : pas de React, pas d'I/O direct)
    │ dépend de
ports/      (interfaces TypeScript)
    ▲ implémentées par
adapters/   (supabase, dexie, webspeech, mediarecorder, staticContent, scripted)
```
- Règle d'or : **un composant React n'importe jamais `adapters/`**. Il obtient les services via `useServices()` (contexte fourni par `src/app/container.ts`).
- `services/` n'importe que `ports/`, `domain/` et d'autres `services/`.
- Ces règles sont vérifiées par `eslint-plugin-boundaries` (voir `docs/conventions.md`).

### 2.2 Arborescence cible
```
src/
  main.tsx                     # bootstrap : container, router, SW
  app/
    container.ts               # composition root : ports → adapters
    ServicesProvider.tsx       # contexte + hook useServices()
    router.tsx                 # routes + transitions de page
    env.ts                     # validation Zod de import.meta.env
    flags.ts                   # feature flags statiques
  domain/                      # types métier partagés (Lesson, Exercise, Event, Badge…)
  ports/                       # interfaces (ContentSource, ProgressRepository, …)
  services/                    # time.ts (parisDay, startOfParisWeek), xp.ts, streak.ts, leitner.ts, badges.ts, pronunciation.ts, examDraw.ts, reviewBuilder.ts, sync.ts, progress.ts (projections)
  adapters/
    supabase/                  # client.ts, SupabaseAuth.ts, SupabaseLeaderboard.ts, SupabaseEventSink.ts, types.gen.ts
    dexie/                     # db.ts, DexieProgressRepository.ts, DexieOutbox.ts
    speech/                    # WebSpeechSynthesizer.ts, WebSpeechRecognizer.ts, MediaRecorderFallback.ts, capabilities.ts
    content/                   # StaticContentSource.ts (import() dynamiques)
    conversation/              # ScriptedConversationEngine.ts
    fakes/                     # implémentations en mémoire pour tests et E2E
  content/
    schema.ts                  # schémas Zod du contenu
    lessons/l01.json … l10.json
    dialogues/d01.json … d10.json
    exam.json
    badges.json
  exercises/                   # registre de plugins d'exercices (ADR 0002)
    registry.ts
    listen_choose/  translate_choose/  tone_pick/  word_order/  speak/
  features/
    onboarding/ home/ lessons/ review/ conversation/ exam/ leaderboard/ profile/ settings/
  ui/                          # design system : Button, Card, Sheet, ProgressBar, Avatar, ToneMark, Toast, Skeleton, PageTransition…
  i18n/fr.ts                   # TOUS les textes d'interface
  styles/tokens.css            # variables CSS du thème (voir docs/design-system.md)
supabase/
  migrations/0001_init.sql …
  tests/*.sql                  # tests pgTAP
e2e/*.spec.ts
scripts/validate-content.ts
```

### 2.3 Ports (contrats)

> Les signatures **définitives** (méthodes ajoutées pendant la planification : `getVocabIndex`, `countDueVocab`, cache du classement, `getMyProfile`, `onCapabilityLost`…) font foi dans le plan, tâche **T03** (`docs/superpowers/plans/v1/phase-0-foundation.md`). Ce bloc donne la vue d'ensemble.
```ts
// ports/ContentSource.ts
export interface ContentSource {
  listLessons(): Promise<LessonSummary[]>;          // ordre l01..l10
  getLesson(id: LessonId): Promise<Lesson>;
  getDialogue(id: DialogueId): Promise<Dialogue>;
  getExamPool(): Promise<ExamQuestion[]>;
  getBadges(): Promise<BadgeDef[]>;
  getVocab(id: VocabId): Promise<VocabItem>;         // index global construit à partir des leçons
}

// ports/ProgressRepository.ts (local, source de vérité côté client)
export interface ProgressRepository {
  appendEvent(e: NewEvent): Promise<AppEvent>;       // génère client_id (uuid v4) + created_at ISO
  listEvents(): Promise<AppEvent[]>;
  getVocabProgress(id: VocabId): Promise<VocabProgress | undefined>;
  upsertVocabProgress(p: VocabProgress): Promise<void>;
  listDueVocab(nowIso: string, limit: number): Promise<VocabProgress[]>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}

// ports/EventSink.ts (distant)
export interface EventSink { push(events: AppEvent[]): Promise<{ accepted: string[] /* client_ids */ }>; }

// ports/Outbox.ts
export interface Outbox { enqueue(e: AppEvent): Promise<void>; peek(n: number): Promise<AppEvent[]>; ack(clientIds: string[]): Promise<void>; size(): Promise<number>; }

// ports/LeaderboardRepository.ts
export interface LeaderboardRepository {
  list(period: "week" | "all"): Promise<LeaderboardRow[]>;
  getPublicProfile(userId: string): Promise<PublicProfile>;
}

// ports/AuthService.ts
export interface AuthService {
  getSession(): Promise<Session | null>;
  requestOtp(email: string): Promise<void>;                       // signInWithOtp({ email, options: { shouldCreateUser: true } })
  verifyOtp(email: string, token: string): Promise<Session>;      // verifyOtp({ email, token, type: "email" })
  joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void>; // rpc join_group ; rejette InvalidInviteError
  hasProfile(): Promise<boolean>;
  onChange(cb: (s: Session | null) => void): () => void;
  updateProfile(p: { pseudo: string; avatarEmoji: string }): Promise<void>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}

// ports/ExamGateway.ts
export interface ExamGateway {
  startAttempt(): Promise<{ attemptId: string; remainingToday: number }>; // rejette ExamLimitError si 3 déjà faites
  submitAttempt(attemptId: string, score: number): Promise<void>;
}

// ports/Speech.ts
export interface SpeechSynthesizer { isAvailable(): boolean; speak(text: string, opts?: { rate?: number; audioUrl?: string }): Promise<void>; cancel(): void; }
export interface SpeechRecognizer { isAvailable(): boolean; listen(opts: { lang: "vi-VN"; timeoutMs: number }): Promise<string[] /* alternatives */>; abort(): void; }
export interface VoiceRecorder { isAvailable(): boolean; record(maxMs: number): Promise<Blob>; }

// ports/ConversationEngine.ts
export interface ConversationEngine {
  start(dialogueId: DialogueId): Promise<ConversationState>;
  answer(state: ConversationState, input: { kind: "speech"; alternatives: string[] } | { kind: "choice"; optionId: string }): Promise<ConversationState>;
}

// ports/ContentReporter.ts
export interface ContentReporter { report(r: { refId: string; message: string }): Promise<void>; }
```
Les types (`Lesson`, `AppEvent`, etc.) vivent dans `src/domain/` et sont **dérivés des schémas Zod** (`z.infer`) quand ils décrivent du contenu.

## 3. Modèle de contenu

Voir `docs/content-guide.md` pour les règles rédactionnelles et un exemple complet. Résumé des schémas :

```ts
VocabItem   = { id: `v_${string}`, vi: string /* NFC, avec diacritiques */, fr: string, note?: string, audio?: string, dialect: "south" }
Exercise    = ListenChoose | TranslateChoose | TonePick | WordOrder | Speak   // union discriminée sur `type`
  ListenChoose    = { id, type: "listen_choose",    vocabId, choices: [vocabId x4] }          // contient vocabId
  TranslateChoose = { id, type: "translate_choose", promptFr, answerVi, distractorsVi: [x3] }
  TonePick        = { id, type: "tone_pick",        syllable, answerTone: Tone }              // Tone = "ngang"|"huyen"|"sac"|"hoi"|"nga"|"nang" ; `syllable` = syllabe COMPLÈTE avec son ton (ex. "má", lue par le TTS) ; l'UI affiche `stripTones(syllable)` ("ma") ; `answerTone` doit être cohérent avec `syllable` (vérifié par validate-content)
  WordOrder       = { id, type: "word_order",       fr, tokensVi: string[] /* ordre correct */, extraTokens?: string[] }
  Speak           = { id, type: "speak",            vi, fr, vocabIds: VocabId[] }
Lesson      = { id: "l01".."l10", contentVersion: number, title, description, emoji, vocab: VocabItem[12..18], exercises: Exercise[8..12], dialogueId }
Dialogue    = { id: "d01".."d10", contentVersion, title, scene, turns: Turn[] }
  Turn      = { id, speaker: "npc", vi, fr, next: TurnId | null }
            | { id, speaker: "user", options: { id, vi, fr, next: TurnId | null }[2..3] }
ExamQuestion = { id: `exam_q${number}`, section: "listening" | "translation" | "tones" | "speaking", exercise: Exercise }   // pool ≥ 60
BadgeDef    = { id, title, description, icon /* emoji */, rule: BadgeRule }
  BadgeRule = { kind: "lessons_done", gte } | { kind: "streak", gte } | { kind: "perfect_lesson" }
            | { kind: "vocab_reviewed", gte } | { kind: "dialogues_done", gte } | { kind: "exam_score", gte }
```
- Les identifiants sont **immuables**. Un élément retiré reçoit `deprecated: true`, il n'est jamais supprimé.
- Le contenu est chargé à la demande : `import(\`../content/lessons/${id}.json\`)`.
- `scripts/validate-content.ts` (lancé en CI et en `npm test`) vérifie : schémas Zod, unicité des ids, références (`vocabId`, `dialogueId`, `next`), NFC, pool d'examen (≥ 60, ≥ 20 listening, ≥ 16 translation, ≥ 12 tones, ≥ 12 speaking), graphe de dialogue sans cycle et terminant par `next: null`.

## 4. Événements, progression, synchronisation (ADR 0004)

### 4.1 Types d'événements
```ts
AppEvent = {
  clientId: string;          // uuid v4, clé d'idempotence
  schemaVersion: 1;
  type: "lesson_completed" | "dialogue_completed" | "review_session_completed" | "exam_finished" | "badge_unlocked";
  refId: string;             // l03, d02, exam, badge id…
  xp: number;                // calculé par services/xp.ts
  payload: Record<string, unknown>; // ex. { mistakes: 0, durationMs: 81234 } ; { score: 84, attemptId }
  createdAt: string;         // ISO UTC
}
```
On n'émet **pas** un événement par exercice (trop de volume, inutile) : un événement par activité terminée.

### 4.2 Barème XP (`services/xp.ts`, fonctions pures)
| Activité | XP |
|---|---|
| Leçon terminée (première fois) | 10 |
| Leçon terminée sans erreur (bonus) | +5 |
| Leçon rejouée | 3 |
| Mot révisé correctement (révision) | 2 / mot (max 40 par session) |
| Dialogue terminé (première fois / rejoué) | 15 / 3 |
| Exercice `speak` validé en auto-évaluation | XP de la leçon inchangé, mais `speak` auto-évalué ne compte pas pour le bonus « sans erreur » |
| Test final | `score` XP (0–100), **une seule fois**, sur le meilleur score (le delta est versé si on améliore) |

Plafond serveur : **200 XP / utilisateur / jour (Europe/Paris)** — l'excédent est ignoré par le trigger.

### 4.3 Streak (`services/streak.ts`)
- Jour actif = au moins un événement `lesson_completed`, `dialogue_completed` ou `review_session_completed` ce jour civil `Europe/Paris`.
- Streak = nombre de jours actifs consécutifs se terminant aujourd'hui **ou hier** (on ne perd pas son streak avant la fin de la journée).
- Utiliser `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' })` pour dériver la date civile. Ne jamais utiliser `Date#getDate()` directement.

### 4.4 Leitner (`services/leitner.ts`)
- 5 boîtes. Intervalles : boîte 1 → 1 j, 2 → 2 j, 3 → 4 j, 4 → 8 j, 5 → 16 j.
- Réponse correcte : `box = min(box + 1, 5)` ; incorrecte : `box = 1`. `dueAt = now + interval(box)`.
- Un mot entre dans le système (boîte 1, dû demain) la première fois qu'il apparaît dans une leçon terminée.
- Session de révision : jusqu'à 20 mots dus, triés par `dueAt` croissant ; types tirés parmi `listen_choose`, `translate_choose`, `speak` (générés dynamiquement à partir du `VocabItem`, distracteurs pris dans le même ensemble de leçons débloquées).

### 4.5 Badges (`services/badges.ts`)
`evaluateBadges(events, badgeDefs, alreadyUnlocked) → BadgeId[]` (nouveaux). Appelé après chaque événement ; chaque nouveau badge produit un événement `badge_unlocked` (xp 0) et un toast animé.

Liste V1 (`content/badges.json`) : `first_lesson`, `five_lessons`, `ten_lessons`, `streak_3`, `streak_7`, `streak_30`, `perfect_lesson`, `vocab_100`, `first_dialogue`, `all_dialogues`, `exam_passed` (≥ 70), `exam_excellent` (≥ 90).

### 4.6 Synchronisation (`services/sync.ts`)
1. `appendEvent` écrit dans Dexie **et** `Outbox.enqueue`.
2. `SyncService.flush()` est appelé : au démarrage, à l'événement `online`, après chaque `appendEvent`, et toutes les 60 s si l'outbox n'est pas vide.
3. `flush` envoie par lots de 50 via `EventSink.push` (insert `on conflict (client_id) do nothing`), puis `ack` des `accepted`.
4. Échec réseau → backoff exponentiel (2 s, 4 s, 8 s… max 5 min), aucune erreur affichée ; un petit indicateur « ⟳ N en attente » apparaît dans le header si `size() > 0` depuis plus de 30 s.
5. Les projections locales (XP, streak, badges) sont recalculées depuis Dexie, **jamais** depuis le serveur. Le serveur fait foi uniquement pour le classement.

## 5. Backend Supabase (ADR 0005, 0006)

### 5.1 Tables (migration `0001_init.sql`)
```sql
create table groups (id uuid primary key default gen_random_uuid(), name text not null, invite_code text unique not null, created_at timestamptz default now());

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  group_id uuid not null references groups,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  avatar_emoji text not null default '🐉',
  created_at timestamptz default now(),
  unique (group_id, pseudo)
);

create table events (
  id bigint generated always as identity primary key,
  client_id uuid unique not null,
  user_id uuid not null references profiles on delete cascade,
  schema_version int not null default 1,
  type text not null check (type in ('lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked')),
  ref_id text not null,
  xp int not null check (xp between 0 and 100),
  payload jsonb not null default '{}',
  client_created_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index events_user_created on events (user_id, created_at);

create table user_stats (
  user_id uuid primary key references profiles on delete cascade,
  group_id uuid not null,
  xp_total int not null default 0,
  xp_week int not null default 0,
  week_start date not null default date_trunc('week', now() at time zone 'Europe/Paris')::date,
  xp_today int not null default 0,
  today date not null default (now() at time zone 'Europe/Paris')::date,
  streak int not null default 0,
  last_active_day date,
  lessons_done text[] not null default '{}',
  dialogues_done text[] not null default '{}',
  badges text[] not null default '{}',
  exam_best int,
  updated_at timestamptz default now()
);
create index user_stats_group_week on user_stats (group_id, xp_week desc);
create index user_stats_group_total on user_stats (group_id, xp_total desc);

create table exam_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade, started_at timestamptz default now(), score int check (score between 0 and 100));

create table content_reports (id bigint generated always as identity primary key, user_id uuid references profiles on delete set null, ref_id text not null, message text not null check (char_length(message) <= 500), content_version int, created_at timestamptz default now());
```

### 5.2 Fonctions et triggers
- `join_group(p_invite_code text, p_pseudo text, p_avatar text)` — `security definer` ; crée `profiles` + `user_stats` pour `auth.uid()` si le code existe, sinon `raise exception 'invalid_invite'`.
- `apply_event()` trigger `after insert on events` : met à jour `user_stats` (reset `xp_week` si nouvelle semaine, reset `xp_today` si nouveau jour, plafond 200/jour, streak, ajout à `lessons_done`/`dialogues_done`/`badges` sans doublon, `exam_best = greatest(...)`). Pour `exam_finished`, le trigger **ignore `xp` envoyé par le client** et crédite `max(0, payload.score - coalesce(exam_best,0))` ; le client calcule le même delta pour l'affichage local.
- `start_exam_attempt()` — `security definer` ; compte les tentatives de `auth.uid()` depuis minuit Europe/Paris ; si ≥ 3 → `raise exception 'exam_limit'` ; sinon insère et renvoie `{attempt_id, remaining_today}`.
- `delete_my_account()` — `security definer` ; supprime `auth.users` de l'appelant (cascade).
- Vue `leaderboard_week` : recalcule `xp_week` à 0 à la lecture si `week_start` < semaine courante (évite les classements périmés pour les inactifs).

### 5.3 RLS (activée sur toutes les tables)
| Table | select | insert | update | delete |
|---|---|---|---|---|
| groups | membres du groupe | — | — | — |
| profiles | même `group_id` | via `join_group` uniquement | `id = auth.uid()` (pseudo, avatar) | via `delete_my_account` |
| events | `user_id = auth.uid()` | `user_id = auth.uid()` | — | — |
| user_stats | même `group_id` | trigger uniquement | trigger uniquement | cascade |
| exam_attempts | `user_id = auth.uid()` | via fonction | `user_id = auth.uid()` et `score is null` | — |
| content_reports | — | utilisateur authentifié | — | — |

Helper SQL : `create function my_group_id() returns uuid language sql stable security definer as $$ select group_id from profiles where id = auth.uid() $$;`

### 5.4 Tests SQL (pgTAP, `supabase/tests/`)
RLS (un utilisateur ne lit pas les events d'un autre ; ne voit pas un autre groupe), idempotence `client_id`, plafond 200 XP, reset hebdo, limite examen 3/jour, XP d'examen delta.

### 5.5 Garder le projet actif
`.github/workflows/keepalive.yml` : cron tous les 3 jours, `curl` sur `${SUPABASE_URL}/rest/v1/groups?select=id&limit=1` avec la clé anon (secret GitHub).

## 6. Fonctionnalités (écrans)

Routes (`app/router.tsx`) :
| Route | Écran | Auth requise |
|---|---|---|
| `/welcome` | Onboarding (5 étapes) | non |
| `/auth/callback` | Retour si l'utilisateur clique le lien de l'e-mail au lieu de taper le code (message d'aide) | non |
| `/` | Accueil : carte des leçons, XP, streak, CTA révision | oui |
| `/lesson/:id` | Lecteur de leçon | oui |
| `/lesson/:id/done` | Résultat de leçon | oui |
| `/review` | Session de révision | oui |
| `/dialogue/:id` | Conversation | oui |
| `/exam` | Intro / règles / tentatives restantes | oui |
| `/exam/run` | Passage du test | oui |
| `/exam/result` | Correction + certificat | oui |
| `/leaderboard` | Classement semaine / total | oui |
| `/u/:userId` | Profil public d'un joueur | oui |
| `/me` | Mon profil, badges, réglages, suppression compte | oui |

Navigation : barre d'onglets en bas (Apprendre `/`, Révision `/review`, Classement `/leaderboard`, Moi `/me`). Masquée pendant leçon / dialogue / examen (mode focus, bouton ✕ avec confirmation).

> **Hors ligne sans session** : si l'utilisateur a déjà un profil en cache Dexie, l'app fonctionne ; seule la première connexion nécessite le réseau.

### 6.1 Onboarding (`features/onboarding`)
1. **Bienvenue** — « Chào bạn! » + message personnalisable (`VITE_WELCOME_MESSAGE`).
2. **Invitation** — code d'invitation + e-mail → `requestOtp(email)` ; écran suivant : saisie du **code à 6 chiffres** reçu par e-mail → `verifyOtp`. Si `hasProfile()` est faux, l'étape 3 appelle `joinGroup(inviteCode, pseudo, avatar)` (le code d'invitation est gardé en mémoire de l'écran, pas besoin de localStorage).
3. **Profil** — pseudo (2–20 caractères) + avatar emoji (grille de 16 : 🐉🐯🐼🦊🐸🐙🦄🐢🐧🦋🌸🍜🥭🛵🏮⭐).
4. **Test de l'appareil** — bouton « Écouter » (TTS « Xin chào ») + « Parler » (STT) ; résultat stocké dans `settings.capabilities = { tts: boolean, stt: boolean, recorder: boolean }` ; textes d'aide si une capacité manque (installer la voix vietnamienne : iOS Réglages → Accessibilité → Contenu énoncé → Voix → Tiếng Việt ; Android : Paramètres → Synthèse vocale → Google → Installer données vocales → Vietnamien).
5. **Installer l'app** — détection plateforme ; iOS : illustration Partager → « Sur l'écran d'accueil » ; autres : `beforeinstallprompt`. Bouton « Plus tard ».

### 6.2 Accueil (`features/home`)
- Header : avatar, XP total (compteur animé), streak 🔥 N, indicateur de sync.
- Carte « Révision du jour (N mots) » si N > 0.
- Chemin de leçons vertical (pas de grille de cartes génériques — voir skill design) : 10 étapes reliées par un tracé, états `locked` / `available` / `done` (+ ✓ et étoile si sans faute). Le dialogue associé apparaît comme une étape secondaire après chaque leçon terminée.
- Étape finale « Bài kiểm tra » (test), verrouillée tant que 10 leçons non terminées.

### 6.3 Lecteur de leçon (`features/lessons`)
- Phase 1 **Découverte** : cartes vocabulaire en pile horizontale (swipe ou boutons), 🔊 auto à l'apparition, bouton 🐢 lent, note Sud en encart.
- Phase 2 **Exercices** : ordre du JSON ; barre de progression ; 3 cœurs.
  - Valider → feuille de feedback qui monte du bas (vert jade « Đúng rồi! » / orange « Pas tout à fait » + bonne réponse + 🔊) → bouton Continuer.
  - Exercice raté → remis en fin de file (une seule fois).
  - 0 cœur → écran « Réessayer la leçon » (aucun XP, mots quand même ajoutés au Leitner).
- Phase 3 **Résultat** (`/lesson/:id/done`) : XP gagnés (compteur), précision, badges débloqués, CTA « Dialogue » / « Continuer ».
- Chaque réponse appelle `leitner.record(vocabIds, correct)`.

### 6.4 Plugins d'exercices (`src/exercises/`, ADR 0002)
```ts
export interface ExercisePlugin<E extends Exercise> {
  type: E["type"];
  schema: z.ZodType<E>;
  Component: React.FC<ExerciseProps<E>>;   // affiche l'exercice, appelle onAnswer(answer)
  grade(ex: E, answer: unknown, ctx: GradeContext): GradeResult; // pur
}
export type GradeResult = { correct: boolean; score: number /*0..1*/; expected: string; vocabIds: VocabId[]; selfAssessed?: boolean };
```
| Type | UI | Correction |
|---|---|---|
| `listen_choose` | 🔊 grand bouton + 4 cartes (sens FR) | égalité d'id |
| `translate_choose` | phrase FR + 4 choix VI (mélangés, seed stable) | égalité de chaîne normalisée |
| `tone_pick` | syllabe sans ton + 🔊 + 6 boutons de ton (couleur + signe + nom) | égalité |
| `word_order` | tuiles à toucher pour former la phrase | séquence exacte des tokens |
| `speak` | phrase + 🔊 + 🎤 maintenir/toucher pour parler | `services/pronunciation.ts` score ≥ 0.7 ; repli recorder → auto-évaluation `selfAssessed: true` ; micro refusé → `skipped` (ni juste ni faux) |

### 6.5 Prononciation (`services/pronunciation.ts`)
```
normalize(s) = s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim()
stripTones(syl) = retire les marques de ton mais garde les voyelles modifiées (ă â ê ô ơ ư đ) — table explicite, pas de NFD global
score(expected, heard[]) = max sur les alternatives de :
   alignement syllabe par syllabe (distance d'édition sur les syllabes, Levenshtein) où
   coût(syllabe identique) = 0, coût(même base, ton différent) = 0.5, sinon 1
   score = 1 - coûtTotal / nbSyllabesAttendues  (borné à [0,1])
```
Retourne aussi la liste des syllabes en erreur pour les surligner (ton faux = soulignement couleur du ton attendu).

### 6.6 Révision (`features/review`)
Identique au lecteur de leçon (mêmes plugins, même feuille de feedback), sans cœurs. Événement `review_session_completed` avec `payload.correctCount`. Écran vide si rien à réviser : « Rien à réviser aujourd'hui — reviens demain ».

### 6.7 Conversation (`features/conversation`)
- Mise en scène type messagerie : en-tête avec la scène (« Au café — Quán cà phê ») ; bulles PNJ à gauche, utilisateur à droite.
- Tour PNJ : bulle apparaît (indicateur « … » 600 ms), TTS joue, traduction FR repliée (toucher pour révéler).
- Tour utilisateur : 2–3 options affichées avec traduction ; si STT dispo, bouton 🎤 : `ScriptedConversationEngine` choisit l'option de meilleur score ≥ 0.6 ; sinon message « Je n'ai pas compris, réessaie ou choisis » ; option toujours sélectionnable au toucher.
- Fin : `dialogue_completed`, XP, retour accueil.

### 6.8 Test final (`features/exam`)
- `/exam` : règles, tentatives restantes aujourd'hui (via `startAttempt` seulement au clic « Commencer »), meilleur score. Hors ligne → bouton désactivé + explication.
- Tirage `services/examDraw.ts(pool, seed, hasStt)` : 10 listening, 8 translation, 6 tones, 6 speaking ; si `!hasStt`, les 6 speaking sont remplacés par 6 listening supplémentaires et `payload.noSpeaking = true`.
- Pas de feedback pendant le test ; pas de cœurs ; chrono affiché mais non limitant.
- Score = round(100 × Σscore / 30) (speak : score continu 0..1).
- Résultat : score animé, mention (≥ 95 Excellent / ≥ 85 Très bien / ≥ 70 Bien / sinon « Presque ! »), correction question par question, certificat si ≥ 70.
- Certificat : composant HTML imprimable (`@media print`) + export PNG via `<canvas>` (dessin manuel : fond, bordure motif, pseudo, date FR, score, mention, mention « sans oral » si applicable). Pas de librairie html2canvas.

### 6.9 Classement et profils (`features/leaderboard`, `features/profile`)
- Onglets Semaine / Total (transition de soulignement partagée `layoutId`).
- Lignes : rang (médailles 🥇🥈🥉 top 3), avatar, pseudo, XP, 🔥 streak, leçons N/10 ; ma ligne surlignée et « collée » en bas si hors écran.
- Pull-to-refresh + bouton rafraîchir ; cache Dexie du dernier classement + « Mis à jour il y a X min ».
- `/u/:userId` : avatar, pseudo, XP, streak, 10 pastilles de leçons, badges, meilleur score examen.
- `/me` : idem + édition pseudo/avatar, réglages (thème Système/Clair/Sombre, vitesse voix normale/lente, re-tester l'appareil), « Signaler un problème », déconnexion, suppression du compte (double confirmation, tape « SUPPRIMER »).

### 6.10 Signalement d'erreur
Bouton discret « ⚠︎ » sur chaque carte vocabulaire, feedback d'exercice et bulle de dialogue → feuille avec textarea (500 car. max) → `ContentReporter.report({ refId, message })`. Hors ligne : mis en file dans l'outbox dédiée.

## 7. Design visuel et mouvement

Référence obligatoire : **`docs/design-system.md`** (thème de couleurs, typographie, espacements, composants, motion) et le skill **`.claude/skills/vietlearn-design`** (à charger avant tout travail UI). Résumé :
- Thème « **Sơn mài** » (laque vietnamienne) : rouge laque, or, crème papier dó, noir laque en mode sombre ; 6 couleurs de tons dédiées.
- Police Be Vietnam Pro (400/500/700/800).
- Transitions de page, feedback d'exercice en feuille, compteurs animés, confettis en fin de leçon ; **uniquement `transform` et `opacity`** ; `prefers-reduced-motion` respecté.

## 8. PWA

- `vite-plugin-pwa` : `registerType: 'prompt'`, `workbox.globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}']`, `navigateFallback: '/index.html'`, runtime caching `NetworkOnly` pour `*.supabase.co`.
- Bannière « Nouvelle version disponible — Mettre à jour » (composant `UpdatePrompt`), jamais de rechargement forcé pendant une leçon.
- Manifest : `name: "VietLearn"`, `short_name: "VietLearn"`, `lang: "fr"`, `display: "standalone"`, `theme_color` = `--color-primary` clair, `background_color` = `--color-bg` clair, icônes 192/512 + maskable 512 + `apple-touch-icon` 180.
- Meta iOS : `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, gestion des `safe-area-inset-*`.

## 9. Gestion des erreurs

| Cas | Comportement |
|---|---|
| Exception React dans une feature | `FeatureErrorBoundary` : message FR + « Réessayer » (remonte le composant) + lien accueil |
| Réseau absent | Apprentissage normal ; outbox ; badge sync ; examen et classement en lecture cache |
| Session expirée | `supabase.auth` refresh auto ; si échec → `/welcome` étape 2, l'outbox est conservée et vidée après reconnexion |
| Lien magique ouvert dans un autre navigateur (iOS PWA ≠ Safari) | Afficher sur `/auth/callback` : « Connexion réussie dans ce navigateur. Ouvre l'app et saisis le code à 6 chiffres reçu par e-mail » → **utiliser OTP e-mail** (`signInWithOtp` + `verifyOtp` type `email`) comme méthode principale ; le lien reste un bonus |
| `invalid_invite` | Message « Code d'invitation incorrect » sous le champ |
| `exam_limit` | « Tu as utilisé tes 3 essais aujourd'hui. Reviens demain ! » |
| STT : `no-speech`, `aborted`, timeout 8 s | « Je n'ai rien entendu » + réessayer ; après 2 échecs, proposer l'auto-évaluation |
| STT : `not-allowed` | Passer en mode sans micro pour la session, message explicatif |
| TTS sans voix vi | Bouton 🔊 désactivé avec info-bulle + lien vers l'aide |
| Contenu introuvable (id inconnu) | 404 interne « Leçon introuvable » |

> **Important (iOS)** : une PWA installée sur iOS a un stockage séparé de Safari ; un lien magique s'ouvrirait dans Safari. D'où **OTP à 6 chiffres** comme flux principal (le template e-mail Supabase doit inclure `{{ .Token }}`).

## 10. Tests et qualité (ADR 0009)

- `npm run typecheck` (tsc --noEmit), `npm run lint`, `npm test` (vitest run + validate-content), `npm run test:e2e` (Playwright sur le build avec `VITE_USE_FAKES=true` et `VITE_FAKE_SPEECH=true` : pas de Docker requis), `npm run build`, `npx supabase test db` (pgTAP, Docker requis, aussi en CI).
- Couverture `services/` ≥ 90 % lignes.
- Chaque plugin d'exercice : test de rendu + test `grade`.
- E2E minimum : (1) onboarding avec fakes → leçon 1 → XP visible au classement ; (2) hors ligne : terminer une leçon, repasser en ligne, l'outbox se vide.
- CI GitHub Actions `ci.yml` : install, typecheck, lint, test, build, Lighthouse CI (PWA ≥ 90, a11y ≥ 95, perf ≥ 85 mobile).

## 11. Points d'extension (préparés, non implémentés)

| Futur | Point d'ancrage |
|---|---|
| Audio humain (accent du Sud) | `VocabItem.audio` / `Turn.audio` → `SpeechSynthesizer.speak({ audioUrl })` |
| Conversation IA | nouvel adaptateur `ConversationEngine` + flag `aiConversation` |
| Contenu distant | nouvel adaptateur `ContentSource` (Supabase Storage / CDN) |
| Multi-groupes | déjà en base ; UI de création de groupe à ajouter |
| Dialecte du Nord | `dialect` dans le contenu + filtre |
| Autres langues d'interface | `i18n/fr.ts` → ajouter `en.ts` + sélecteur |
| Gel de streak | règle isolée dans `services/streak.ts` |
| Nouveaux exercices | nouveau plugin dans `src/exercises/` |

## 12. Variables d'environnement
```
VITE_SUPABASE_URL=            # obligatoire
VITE_SUPABASE_ANON_KEY=       # obligatoire
VITE_WELCOME_MESSAGE=         # optionnel, message d'anniversaire
VITE_USE_FAKES=false          # true → fakes pour auth, sync, classement, examen, signalements (dev sans backend, E2E)
VITE_FAKE_SPEECH=false        # true → fakes TTS/STT/enregistreur (E2E, navigateurs sans voix)
```
Validées dans `src/app/env.ts` (Zod) ; erreur claire au démarrage si manquantes et `VITE_USE_FAKES !== "true"`.

## 13. Risques connus
| Risque | Mitigation |
|---|---|
| Voix TTS vi-VN du Nord | Assumé (choix de Marc) ; champ `audio` prêt pour des enregistrements |
| Reconnaissance vocale indisponible (Firefox, certains iOS) | Repli enregistreur + auto-évaluation ; examen sans oral |
| Contenu généré non relu | Vocabulaire très fréquent, règles strictes dans `content-guide.md`, bouton signalement |
| Pause Supabase après 7 j | workflow keepalive |
| Délai < 1 mois | Plan découpé en lots parallélisables ; MVP prioritaire (voir plan) |
