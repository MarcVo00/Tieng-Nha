# Conventions de code VietLearn

> Règles **non négociables**. Le lint en applique la majorité ; le reste est vérifié en revue.

## 1. Langues
- Code, identifiants, commentaires, messages de commit : **anglais**.
- Textes d'interface : **français**, uniquement dans `src/i18n/fr.ts`. Aucune chaîne visible en dur dans un composant (le lint `no-literal-string` est configuré sur `src/features` et `src/ui`, exception : caractères décoratifs et contenu vietnamien venant du JSON).
- Contenu pédagogique : JSON dans `src/content/` (vietnamien + français).

## 2. TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Interdits : `any` (utiliser `unknown` + garde), `as` sauf `as const` et après validation Zod, `@ts-ignore` (utiliser `@ts-expect-error` avec justification, uniquement dans les tests), `enum` (utiliser des unions de littéraux).
- Alias d'import : `@/` → `src/`. Pas de chemins relatifs remontant de plus d'un niveau (`../../` interdit).
- Les types de contenu sont dérivés des schémas : `export type Lesson = z.infer<typeof LessonSchema>`.
- Fonctions de `services/` : pures, sans `Date.now()` ni `Math.random()` internes — l'horloge et l'aléa sont injectés (`now: string`, `rng: () => number` ou `seed: number`).

## 3. Nommage
| Élément | Convention | Exemple |
|---|---|---|
| Composant React | PascalCase, fichier `.tsx` du même nom | `LessonPlayer.tsx` |
| Hook | `useXxx`, fichier `useXxx.ts` | `useLessonSession.ts` |
| Service / fonction pure | camelCase, fichier camelCase | `leitner.ts` → `nextBox()` |
| Port | PascalCase interface, fichier du même nom | `ProgressRepository.ts` |
| Adaptateur | `<Techno><Port>` | `DexieProgressRepository.ts` |
| Fake | `InMemory<Port>` / `Fake<Port>` | `FakeSpeechRecognizer.ts` |
| Test | à côté du fichier, `.test.ts(x)` | `leitner.test.ts` |
| Ids de contenu | `l01`, `d01`, `v_<slug_ascii>`, `<lessonId>_e01`, `exam_q001` | `v_caphe_sua_da` |
| Tables SQL | snake_case pluriel | `user_stats` |

## 4. React
- Composants fonctionnels uniquement ; props typées par `type XxxProps = {…}` ; pas de `React.FC` sauf pour les plugins d'exercices (contrat ADR 0002).
- État : local (`useState`/`useReducer`) par défaut ; Zustand seulement pour l'état transversal (`sessionStore` : utilisateur, capacités, thème ; `syncStore` : taille outbox). Pas de données serveur dans Zustand.
- Effets : pas de `useEffect` pour dériver des données (calculer pendant le rendu ou `useMemo`). Tout `useEffect` asynchrone gère l'annulation (flag `cancelled` ou `AbortController`).
- Accès aux services uniquement via `useServices()`.
- Chaque écran (route) est enveloppé dans `FeatureErrorBoundary` et `PageTransition`.
- Styles : classes Tailwind avec tokens uniquement (voir `docs/design-system.md`). Pas de `style={{}}` sauf valeurs dynamiques (ex. couleur de ton via variable CSS). Pas de CSS-in-JS.
- Accessibilité : boutons = `<button>`, liens = `<Link>`. `aria-label` FR sur boutons-icônes. `lang="vi"` sur le texte vietnamien.

## 5. Tests
- Vitest + Testing Library. Tester le comportement (rôle, texte), pas l'implémentation.
- `services/` et `exercises/*/grade.ts` : **TDD** — écrire le test qui échoue, le voir échouer, implémenter, le voir passer.
- Composants : utiliser les fakes de `adapters/fakes/` via un `renderWithServices()` (helper dans `src/test/`).
- Dexie en test : `fake-indexeddb/auto` importé dans `src/test/setup.ts`.
- Aucun test ne touche le réseau.

## 6. Git
- Branche `main` protégée par la CI. Travail sur `feat/<tâche>` ou dans un worktree.
- Commits : Conventional Commits en anglais (`feat(lessons): add word_order plugin`), petits et fréquents.
- **Identité : l'auteur des commits est celui de la config git locale (Marc). Ne JAMAIS ajouter de trailer `Co-Authored-By` ni de mention « Generated with Claude » dans les commits ou PR.**
- Jamais de `--no-verify`, jamais de `git push --force` sur `main`.
- Ne jamais committer : `.env*.local`, clés `service_role`, `node_modules`, `dist`, `coverage`.

## 7. Dépendances
- Uniquement la liste de la spec §1. Toute nouvelle dépendance → ADR + validation humaine.
- Versions installées avec `npm install <pkg>@<range de la spec>`.

## 8. Definition of Done (toute tâche)
1. Critères d'acceptation de la tâche tous satisfaits.
2. `npm run verify` vert (typecheck, lint 0 warning, tests, validation contenu, build).
3. Nouveaux tests pour toute logique ajoutée ; couverture `services/` ≥ 90 %.
4. Si UI : skill `vietlearn-design` chargé, `review-checklist.md` rempli dans le rapport, captures 360 px clair + sombre si un navigateur est disponible.
5. Aucun `TODO`, `console.log`, code commenté ou fichier temporaire laissé.
6. Commit(s) Conventional sans attribution Claude.
7. Rapport de fin de tâche au format `docs/agents/AGENT_BRIEF.md §5`.
