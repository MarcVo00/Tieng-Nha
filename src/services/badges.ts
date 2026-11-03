import { languageOfId } from "@/domain/languages";
import type { BadgeDef, ProgressSnapshot } from "@/domain/types";

/** The badges tied to content only count Vietnamese ids in 2.0; the cross-cutting ones (streak, xp, days) stay shared. */
const vietnamese = (ids: readonly string[]): number => ids.filter((id) => languageOfId(id) === "vi").length;

function holds(rule: BadgeDef["rule"], s: ProgressSnapshot): boolean {
  switch (rule.kind) {
    case "lessons_done": return vietnamese(s.lessonsDone) >= rule.gte;
    case "streak": return s.streak >= rule.gte;
    case "perfect_lesson": return vietnamese(s.perfectLessons) > 0;
    case "perfect_lessons": return vietnamese(s.perfectLessons) >= rule.gte;
    case "vocab_reviewed": return s.vocabReviewed >= rule.gte;
    case "dialogues_done": return vietnamese(s.dialoguesDone) >= rule.gte;
    case "exam_score": return (s.examBest ?? 0) >= rule.gte;
    case "xp_total": return s.xpTotal >= rule.gte;
    case "active_days": return s.activeDays.length >= rule.gte;
  }
}

export function evaluateBadges(snapshot: ProgressSnapshot, defs: readonly BadgeDef[]): string[] {
  const owned = new Set(snapshot.badges);
  return defs.filter((d) => !owned.has(d.id) && holds(d.rule, snapshot)).map((d) => d.id);
}
