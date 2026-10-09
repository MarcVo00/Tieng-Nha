# ADR 0002 — Exercices extensibles par registre de plugins

- Statut : accepté (2026-10-09)

## Contexte
Cinq types d'exercices en V1, d'autres probables (association par paires, dictée…). Ils sont utilisés par trois moteurs : leçon, révision, examen. Les sous-agents doivent pouvoir les développer en parallèle.

## Décision
- Chaque type vit dans `src/exercises/<type>/` avec : `schema.ts` (Zod), `Component.tsx`, `grade.ts` (pur), `index.ts` (exporte le plugin), tests.
- `src/exercises/registry.ts` exporte `getPlugin(type)` et la liste des plugins enregistrés. Les moteurs ne connaissent **aucun** type concret : ils appellent `getPlugin(ex.type)`.
- Le schéma `Exercise` global (`content/schema.ts`) est l'union discriminée des schémas de plugins.
- Contrat : voir spec §6.4 (`ExercisePlugin`, `ExerciseProps`, `GradeResult`).

```ts
export interface ExerciseProps<E> {
  exercise: E;
  disabled: boolean;               // true après validation
  onAnswer: (answer: unknown) => void; // appelé quand l'utilisateur valide
  services: { speech: SpeechSynthesizer; recognizer: SpeechRecognizer; recorder: VoiceRecorder; content: ContentSource };
  capabilities: { tts: boolean; stt: boolean; recorder: boolean };
}
```

## Conséquences
+ Ajouter un exercice ne touche ni le moteur de leçon, ni la révision, ni l'examen.
+ Un sous-agent par plugin, sans conflit de fichiers.
− `answer: unknown` : chaque `grade` doit valider sa propre forme de réponse (via Zod ou garde de type).
