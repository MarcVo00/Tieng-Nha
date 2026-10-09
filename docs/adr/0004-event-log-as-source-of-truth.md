# ADR 0004 — Journal d'événements comme source de vérité

- Statut : accepté (2026-10-09)

## Contexte
L'app fonctionne hors ligne, synchronise vers un serveur, et ses règles (barème XP, badges, streak) évolueront. Des compteurs modifiés en place seraient difficiles à corriger et à fusionner.

## Décision
- La progression est un journal **append-only** d'`AppEvent` (spec §4.1), un événement par activité terminée.
- XP, streak, badges, leçons terminées = **projections** calculées par des fonctions pures de `services/` à partir du journal.
- Chaque événement a un `clientId` (uuid v4) → idempotence de la synchronisation ; et un `schemaVersion` → évolution du format.
- Côté client : Dexie (`events`, `outbox`). Côté serveur : table `events` + projection `user_stats` maintenue par trigger.
- Exception : la progression par mot (`vocab_progress`, Leitner) est un état local mutable (volumétrie élevée, non synchronisé en V1).

## Conséquences
+ Changer le barème ou ajouter un badge rétroactif = recalcul, pas de migration risquée.
+ Synchronisation simple et sûre (rejouer l'outbox).
− Le serveur maintient une projection redondante (`user_stats`) : elle doit suivre exactement les mêmes règles que `services/xp.ts` — tests SQL dédiés.
