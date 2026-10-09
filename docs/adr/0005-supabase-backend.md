# ADR 0005 — Supabase comme backend, logique sensible côté serveur

- Statut : accepté (2026-10-09)

## Contexte
Besoin de comptes, d'un classement partagé et d'un coût nul. Alternatives : Firebase (requêtes d'agrégat moins naturelles, règles de sécurité plus faciles à rater), backend maison (coût, hébergement).

## Décision
- Supabase (plan gratuit) : Auth (OTP e-mail 6 chiffres), Postgres, RLS.
- Pas de serveur applicatif : la logique sensible est en SQL (`security definer` functions, triggers) : `join_group`, `apply_event`, `start_exam_attempt`, `delete_my_account`.
- Le client n'est jamais cru sur parole pour : plafond XP/jour, limite d'examen, XP d'examen (delta sur meilleur score), appartenance au groupe.
- Schéma uniquement via migrations SQL numérotées dans `supabase/migrations/`. Types TS générés (`supabase gen types typescript --local > src/adapters/supabase/types.gen.ts`).
- Deux projets : `vietlearn-dev`, `vietlearn-prod`. Workflow keepalive pour éviter la pause après 7 jours.

## Conséquences
+ 0 €, ~50 000 MAU possibles, passage au plan payant sans changement de code.
+ Sécurité correcte même si l'app devient publique.
− Logique répartie entre TS (projections locales) et SQL (projection serveur) → tests des deux côtés.
