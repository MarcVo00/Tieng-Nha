# VietLearn

PWA pour apprendre le vietnamien du Sud (francophones débutants). Cadeau d'anniversaire — deadline V1 : 2026-11-09. Budget 0 €.

## Documentation (source de vérité)
- `docs/README.md` — index et ordre de lecture.
- Spec : `docs/superpowers/specs/2026-10-09-vietlearn-design.md`
- Plan : `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`
- ADR : `docs/adr/`
- Conventions + Definition of Done : `docs/conventions.md`
- Design system : `docs/design-system.md` — skill projet `vietlearn-design` à charger pour tout travail UI
- Contenu : `docs/content-guide.md`
- Brief sous-agents : `docs/agents/AGENT_BRIEF.md`

## Règles globales
- Stack figée (spec §1) : Vite 5, React 18, TS strict, Tailwind 3.4 (tokens uniquement), motion 11, Zustand 5, Dexie 4, Supabase JS 2, Zod 3, Vitest, Playwright. Aucune autre dépendance sans ADR.
- Architecture hexagonale (ADR 0001) : les composants n'importent jamais `src/adapters/`. Frontières vérifiées par ESLint.
- Code et commits en anglais ; textes d'interface en français dans `src/i18n/fr.ts`.
- `npm run verify` doit être vert avant de déclarer une tâche terminée.
- **Git : les commits sont signés uniquement par l'utilisateur (config git locale). Ne jamais ajouter `Co-Authored-By: Claude` ni « Generated with Claude Code » dans les commits ou les PR.**
- Ne jamais committer de secrets (`.env*.local`, clé `service_role`).

## Commandes
`npm run dev` · `npm run verify` · `npm test` · `npm run test:e2e` · `npx supabase start` (backend local, Docker requis)
