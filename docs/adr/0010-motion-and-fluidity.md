# ADR 0010 — Fluidité : bibliothèque `motion` et catalogue d'animations

- Statut : accepté (2026-10-09)

## Contexte
Marc veut une app « fluide, avec des transitions, agréable à utiliser ». Sans cadre, chaque sous-agent inventerait ses propres durées/effets → incohérence et saccades.

## Décision
- Bibliothèque `motion` v11 (`motion/react`) : `AnimatePresence` (transitions de route), `layout`/`layoutId` (tuiles, onglets), springs, `whileTap`.
- Tokens uniques dans `src/ui/motion.ts` ; catalogue exhaustif dans `docs/design-system.md §6.2`. Une animation absente du catalogue nécessite de l'y ajouter d'abord.
- Seules `transform` et `opacity` sont animées. `MotionConfig reducedMotion="user"` à la racine.
- Perçu de rapidité : contenu de leçon préchargé (`import()` de la leçon suivante pendant la leçon courante), squelettes plutôt que spinners, UI optimiste (XP affiché immédiatement, synchro en arrière-plan).
- Pas d'API View Transitions en V1 (support Safari incomplet / incohérent avec motion).

## Conséquences
+ Cohérence de mouvement sur tout l'app ; 60 fps sur mobile milieu de gamme.
− ~35 kB gzip pour `motion` (acceptable).
