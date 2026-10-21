# Brief commun aux sous-agents d'implémentation

Tu es un sous-agent chargé d'**une seule tâche** du plan `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Lis ce brief entièrement avant de commencer.

## 1. Lectures obligatoires (dans cet ordre)
1. `CLAUDE.md` (racine) — règles globales.
2. `docs/conventions.md` — règles de code et Definition of Done.
3. La section de la **spec** (`docs/superpowers/specs/2026-10-09-vietlearn-design.md`) citée par ta tâche — et seulement ce qui est utile.
4. Les ADR cités par ta tâche.
5. Si ta tâche touche l'UI (`src/features`, `src/ui`, `src/exercises/*/Component.tsx`, CSS) : charge le skill **`vietlearn-design`** et lis `docs/design-system.md`.
6. Si ta tâche produit du contenu (`src/content/*.json`) : lis `docs/content-guide.md` en entier.

## 2. Périmètre
- Ne modifie **que** les fichiers listés dans ta tâche (section « Fichiers »). Si un autre fichier doit changer, arrête-toi et signale-le dans ton rapport (statut `BLOCKED` ou `NEEDS_CONTEXT`) au lieu d'improviser.
- N'ajoute aucune dépendance non listée dans la spec §1.
- Ne refactorise pas du code hors de ta tâche, même s'il te semble améliorable : note-le dans le rapport.
- Ne modifie jamais un port (`src/ports/`) ou un schéma de contenu (`src/content/schema.ts`) sauf si ta tâche le demande explicitement — d'autres agents en dépendent.

## 3. Méthode
1. Lis les fichiers existants que tu vas toucher ou utiliser (types, ports, fakes).
2. Logique (`services/`, `grade.ts`, adaptateurs) : **TDD** — test d'abord, le voir échouer (`npx vitest run <fichier>`), implémenter, le voir passer.
3. UI : construire avec `src/ui/`, tokens uniquement, animations du catalogue.
4. Lance `npm run verify` avant de conclure. S'il échoue, corrige ; ne désactive jamais une règle de lint, un test ou une vérification de type pour le faire passer.
5. Commit(s) Conventional en anglais. **Pas de `Co-Authored-By`, pas de mention de Claude.**

## 4. Pièges connus (lis-les, ils arrivent souvent)
- Vietnamien : toujours `normalize("NFC")` avant de comparer ; ne pas utiliser `normalize("NFD")` + suppression des diacritiques pour retirer les tons (ça détruit aussi ă â ê ô ơ ư đ) — utiliser `stripTones` de `services/pronunciation.ts`.
- Dates : jours civils en `Europe/Paris` via `services/time.ts` (`parisDay(iso)`), jamais `getDate()`/`toDateString()`.
- Pas de `Date.now()`/`Math.random()` dans `services/` : injecter `now` et `rng`/`seed`.
- Web Speech : `speechSynthesis.getVoices()` est vide au premier appel sur Chrome → attendre l'événement `voiceschanged` (timeout 1,5 s). `webkitSpeechRecognition` peut ne pas exister (`typeof window.webkitSpeechRecognition === "undefined"`).
- iOS : le TTS ne démarre qu'après un geste utilisateur — toujours déclencher depuis un handler de clic la première fois.
- `motion` s'importe depuis `"motion/react"` (pas `framer-motion`).
- `react-router-dom` v6 data router : `createBrowserRouter` + `RouterProvider`, `useNavigate`, `<Link>` ; pas d'API v7.
- Tailwind : la palette par défaut est désactivée ; `bg-white`, `text-gray-500` n'existent pas → utiliser `bg-surface`, `text-ink-muted`.
- Supabase : n'utilise que les fonctions RPC et tables décrites spec §5 ; jamais la clé `service_role` côté client.
- Dexie v4 : schéma déclaré dans `adapters/dexie/db.ts` uniquement ; toute modification = nouvelle `version(n)`.
- **Shell : le chemin du dépôt contient une espace (`…/IT Projects/VietLearn`).** Toujours mettre les chemins et variables entre guillemets (`mkdir -p "$S"`, jamais `mkdir -p $S`) : sinon la commande coupe le chemin en deux et agit sur `…/Downloads/IT` (incident du 2026-10-21 : un `rm -rf` non quoté a supprimé un dossier de l'utilisateur hors du dépôt). **Jamais de `rm -rf` sur un chemin hors du dépôt ou du dossier de travail `.superpowers/`**, et toujours `ls` la cible avant de supprimer. Préférer des chemins relatifs au dépôt.

## 5. Rapport de fin de tâche (format obligatoire)
```
## Rapport — <ID tâche> <titre>
Statut : DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Fichiers modifiés : <liste>
Tests ajoutés : <liste + nombre>
Vérification : sortie résumée de `npm run verify` (dernières lignes)
Critères d'acceptation : <chaque critère → ✓ / ✗ + preuve>
Checklist design (si UI) : <review-checklist.md rempli>
Écarts / remarques : <décisions prises, problèmes vus hors périmètre>
Commits : <hash + message>
```
