# ADR 0002 — Exercices extensibles par registre de plugins

- Statut : accepté (2026-10-09)

## Contexte
Cinq types d'exercices en V1, d'autres probables (association par paires, dictée…). Ils sont utilisés par trois moteurs : leçon, révision, examen. Les sous-agents doivent pouvoir les développer en parallèle.

## Décision
- Chaque type vit dans `src/exercises/<type>/` avec : `Component.tsx`, `grade.ts` (pur), `index.ts` (exporte le plugin), tests. Le schéma Zod du type est défini **une seule fois** dans `src/content/schema.ts` (pour éviter une dépendance circulaire contenu ↔ plugins) ; le plugin le référence via son champ `schema`.
- `src/exercises/registry.ts` exporte `getPlugin(type)` et la liste des plugins enregistrés. Les moteurs ne connaissent **aucun** type concret : ils appellent `getPlugin(ex.type)`.
- Le schéma `Exercise` global (`content/schema.ts`) est l'union discriminée des 5 schémas de type. Ajouter un type = ajouter son schéma à l'union + créer son dossier plugin.
- Contrat définitif : plan, tâche T03, fichier `src/exercises/types.ts` (`ExercisePlugin`, `ExerciseProps`, `GradeResult`). L'extrait ci-dessous est indicatif.

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
