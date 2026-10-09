# ADR 0007 — Organisation par feature et frontières strictes

- Statut : accepté (2026-10-09)

## Décision
- Une feature = un dossier `src/features/<name>/` avec un `index.ts` public (exporte uniquement les routes/composants d'écran).
- Une feature n'importe jamais les fichiers internes d'une autre feature. Partage → `src/ui/` (visuel) ou `src/services/` (logique).
- Matrice d'imports autorisés (appliquée par `eslint-plugin-boundaries`) :

| De \ Vers | app | features | exercises | ui | services | ports | domain | adapters | content | i18n |
|---|---|---|---|---|---|---|---|---|---|---|
| app | ✓ | ✓ (index) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| features | ✗ | même feature | ✓ (registry) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| exercises | ✗ | ✗ | même plugin + registry | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (schema) | ✓ |
| ui | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| services | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ (schema/types) | ✗ |
| adapters | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | même adaptateur | ✓ | ✗ |

Deux éléments partagés complètent la matrice (configuration exacte dans le plan, tâche T01) :
- **`di`** = `src/app/ServicesProvider.tsx`, `src/app/services.ts`, `src/app/appState.ts` : seule partie de `app/` importable par `features/`, `exercises/` et `adapters/` (accès aux services et à l'état global).
- **`exercise-registry`** = `src/exercises/registry.ts`, `types.ts`, `ExerciseHost.tsx` : moteur d'exercices commun à la leçon, à la révision et à l'examen.

## Conséquences
+ Les sous-agents ne peuvent pas créer de dépendance cachée ; le lint échoue.
− Parfois un peu de duplication de présentation entre features (acceptable).
