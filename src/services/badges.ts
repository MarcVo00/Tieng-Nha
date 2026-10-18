import type { BadgeDef, ProgressSnapshot } from "@/domain/types";

function holds(rule: BadgeDef["rule"], s: ProgressSnapshot): boolean {
  switch (rule.kind) {
    case "lessons_done": return s.lessonsDone.length >= rule.gte;
    case "streak": return s.streak >= rule.gte;
    case "perfect_lesson": return s.perfectLessons.length > 0;
    case "perfect_lessons": return s.perfectLessons.length >= rule.gte;
    case "vocab_reviewed": return s.vocabReviewed >= rule.gte;
    case "dialogues_done": return s.dialoguesDone.length >= rule.gte;
    case "exam_score": return (s.examBest ?? 0) >= rule.gte;
  }
}

export function evaluateBadges(snapshot: ProgressSnapshot, defs: readonly BadgeDef[]): string[] {
  const owned = new Set(snapshot.badges);
  return defs.filter((d) => !owned.has(d.id) && holds(d.rule, snapshot)).map((d) => d.id);
}
