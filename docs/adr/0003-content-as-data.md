# ADR 0003 — Le contenu est de la donnée versionnée

- Statut : accepté (2026-10-09)

## Contexte
Le contenu (leçons, dialogues, examen, badges) est généré par Claude sans relecture et sera corrigé au fil des signalements. Il doit être modifiable sans toucher au code, et sa structure doit être garantie.

## Décision
- JSON dans `src/content/`, un fichier par leçon/dialogue ; schémas Zod dans `src/content/schema.ts`.
- `scripts/validate-content.ts` valide schémas + intégrité référentielle + NFC ; exécuté par `npm test` et en CI. Contenu invalide = build rouge.
- Chargement à la demande (`import()` dynamique par leçon) via l'adaptateur `StaticContentSource`.
- Identifiants immuables (`l01`, `v_caphe`, `d03`…). Suppression = `deprecated: true`. Chaque fichier a un `contentVersion` incrémenté à chaque modification.

## Conséquences
+ Corriger un mot = modifier un JSON + push.
+ Le jour où l'on veut du contenu distant : nouvel adaptateur `ContentSource`, aucune UI modifiée.
− Pas d'édition depuis l'app (acceptable V1).
