# ADR 0008 — Configuration validée et feature flags

- Statut : accepté (2026-10-09)

## Décision
- Toute configuration via `import.meta.env` (préfixe `VITE_`), parsée par Zod dans `src/app/env.ts`. Aucun autre fichier ne lit `import.meta.env`.
- `.env.example` versionné ; `.env*.local` ignorés par git. Aucune clé secrète côté client (la clé anon Supabase est publique par conception ; la `service_role` ne doit **jamais** apparaître dans le dépôt ni dans le client).
- `src/app/flags.ts` : objet constant typé (`{ aiConversation: false, streakFreeze: false, humanAudio: false }`). Les features lisent les flags via `useServices().flags`.

## Conséquences
+ Erreur explicite au démarrage si la config est incomplète.
+ Activer une fonctionnalité future = un booléen + un adaptateur.
