# ADR 0001 — Architecture hexagonale légère (ports & adaptateurs)

- Statut : accepté (2026-10-09)

## Contexte
L'app dépend de plusieurs technologies susceptibles de changer : Supabase (backend), Dexie (stockage local), Web Speech API (TTS/STT, support inégal selon navigateurs), contenu statique, moteur de conversation scénarisé (une IA pourrait le remplacer). Le code est écrit par des sous-agents : il faut des frontières nettes pour éviter le couplage accidentel.

## Décision
- Couches : `features/` (UI) → `services/` (logique pure) → `ports/` (interfaces) ← `adapters/` (implémentations).
- Composition unique dans `src/app/container.ts` ; les composants récupèrent les services via `useServices()`.
- `adapters/fakes/` fournit des implémentations en mémoire de chaque port (tests, E2E, dev sans backend via `VITE_USE_FAKES=true`).
- Frontières vérifiées par `eslint-plugin-boundaries` (règles dans `docs/conventions.md`).

## Conséquences
+ Remplacer une techno = écrire un adaptateur + changer une ligne du container.
+ Logique métier testable sans navigateur ni réseau.
− Un peu plus de fichiers et d'indirection qu'un appel direct à Supabase dans un composant.

## Interdits
- `import ... from "@/adapters/..."` dans `features/`, `ui/`, `exercises/`, `services/`.
- `import { supabase }` ailleurs que dans `adapters/supabase/`.
- `window.speechSynthesis` / `webkitSpeechRecognition` ailleurs que dans `adapters/speech/`.
