# Documentation Tiếng Nhà

| Document | Pour qui | Contenu |
|---|---|---|
| [Spec V1](superpowers/specs/2026-10-09-vietlearn-design.md) | tous | le *quoi* : fonctionnalités, données, backend, écrans, erreurs, tests |
| [Spec Progression V2](superpowers/specs/2026-10-14-progression-boss-energy-design.md) | tous | arbre de compétences, boss, énergie, xu et boutique (à implémenter après l'oral) |
| [Plan d'implémentation](superpowers/plans/2026-10-09-vietlearn-v1.md) | orchestrateur + sous-agents | le *comment* : tâches ordonnées, fichiers, critères, vérifications |
| [ADR](adr/) | tous | le *pourquoi* des décisions d'architecture |
| [Conventions](conventions.md) | sous-agents | règles de code, Definition of Done |
| [Design system](design-system.md) | tâches UI | thème « Sơn mài », typographie, motion |
| [Direction artistique des personnages](art-direction.md) | tâches illustration | héros et boss « Đông Hồ simplifié », palette, calques des skins, galerie de boss |
| Skill `vietlearn-design` (`.claude/skills/`) | tâches UI | direction artistique anti « look IA » + checklist |
| [Guide de contenu](content-guide.md) | tâches contenu | règles du vietnamien du Sud, curriculum, exemples JSON |
| [Brief agent](agents/AGENT_BRIEF.md) | chaque sous-agent | contrat de travail, pièges connus, format de rapport |

## Ordre de lecture pour un sous-agent
`CLAUDE.md` → `docs/agents/AGENT_BRIEF.md` → `docs/conventions.md` → sa tâche dans le plan → sections de spec/ADR citées → (UI) skill + design system / (contenu) guide de contenu.

## ADR
| # | Décision |
|---|---|
| [0001](adr/0001-hexagonal-architecture.md) | Architecture hexagonale légère |
| [0002](adr/0002-exercise-plugin-registry.md) | Exercices en plugins |
| [0003](adr/0003-content-as-data.md) | Contenu = données versionnées |
| [0004](adr/0004-event-log-as-source-of-truth.md) | Journal d'événements |
| [0005](adr/0005-supabase-backend.md) | Supabase, logique sensible côté serveur |
| [0006](adr/0006-groups-and-leaderboard-scaling.md) | Groupes et classement à coût constant |
| [0007](adr/0007-feature-boundaries.md) | Frontières entre features |
| [0008](adr/0008-config-and-flags.md) | Configuration et feature flags |
| [0009](adr/0009-quality-gates.md) | Garde-fous qualité |
| [0010](adr/0010-motion-and-fluidity.md) | Fluidité et animations |
| [0011](adr/0011-voice-packs.md) | Packs de voix pré-générés (Sud / Nord) |
