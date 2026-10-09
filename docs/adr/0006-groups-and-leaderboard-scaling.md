# ADR 0006 — Groupes et classement à coût constant

- Statut : accepté (2026-10-09)

## Contexte
V1 : un seul cercle (famille/amis). Demain : plusieurs cercles. Le classement doit rester rapide quel que soit le volume d'événements.

## Décision
- Table `groups` avec `invite_code` ; chaque profil appartient à un groupe ; RLS filtrée par `my_group_id()`.
- Le classement lit **uniquement** `user_stats` (projection), jamais d'agrégat sur `events` à la lecture.
- Index `(group_id, xp_week desc)` et `(group_id, xp_total desc)`.
- Pas de temps réel (Realtime) : rafraîchissement à l'ouverture / pull-to-refresh.

## Conséquences
+ Lecture O(taille du groupe), indépendante de l'historique.
+ Multi-groupes = UI à ajouter, aucune migration.
− `xp_week` des inactifs doit être remis à zéro à la lecture (vue `leaderboard_week`).
