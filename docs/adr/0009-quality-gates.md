# ADR 0009 — Garde-fous qualité automatisés

- Statut : accepté (2026-10-09)

## Contexte
Le code est produit par des sous-agents (Sonnet 5.5). Le seul moyen fiable de garantir la cohérence est l'automatisation : un agent ne peut pas déclarer une tâche terminée si les vérifications échouent.

## Décision
Scripts npm (définis à la tâche de scaffolding, noms figés) :
| Script | Commande |
|---|---|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | `eslint . --max-warnings 0` |
| `format` | `prettier --write .` |
| `test` | `vitest run && tsx scripts/validate-content.ts` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |
| `test:e2e` | `playwright test` |
| `verify` | `npm run typecheck && npm run lint && npm test && npm run build` |

- `.github/workflows/ci.yml` : sur chaque push/PR → `npm ci`, `npm run verify`, Playwright, Lighthouse CI.
- **Definition of Done** (voir `docs/conventions.md`) : `npm run verify` vert + tests ajoutés + checklist design si UI.
- TDD obligatoire pour `services/` et `exercises/*/grade.ts`.

## Conséquences
+ Les erreurs des agents sont détectées immédiatement, avant revue.
− Temps de CI ~3–5 min.
