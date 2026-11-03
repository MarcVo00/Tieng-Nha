import { languageOfId, type LanguageId } from "@/domain/languages";
import type { BadgeDef, ProgressSnapshot } from "@/domain/types";
import { examBestIn } from "@/services/exam";

/**
 * A badge tied to content counts the progress of its own language, read from its id (`tl_…` Tagalog, the rest
 * Vietnamese): lessons, dialogues, perfect lessons, the boss. The cross-cutting ones (streak, words reviewed, xp,
 * days) stay shared.
 */
function holds(rule: BadgeDef["rule"], s: ProgressSnapshot, language: LanguageId): boolean {
  const inLanguage = (ids: readonly string[]): number => ids.filter((id) => languageOfId(id) === language).length;
  switch (rule.kind) {
    case "lessons_done": return inLanguage(s.lessonsDone) >= rule.gte;
    case "streak": return s.streak >= rule.gte;
    case "perfect_lesson": return inLanguage(s.perfectLessons) > 0;
    case "perfect_lessons": return inLanguage(s.perfectLessons) >= rule.gte;
    case "vocab_reviewed": return s.vocabReviewed >= rule.gte;
    case "dialogues_done": return inLanguage(s.dialoguesDone) >= rule.gte;
    case "exam_score": return (examBestIn(s, language) ?? 0) >= rule.gte;
    case "xp_total": return s.xpTotal >= rule.gte;
    case "active_days": return s.activeDays.length >= rule.gte;
  }
}

export function evaluateBadges(snapshot: ProgressSnapshot, defs: readonly BadgeDef[]): string[] {
  const owned = new Set(snapshot.badges);
  return defs.filter((d) => !owned.has(d.id) && holds(d.rule, snapshot, languageOfId(d.id))).map((d) => d.id);
}

/**
 * The badges a profile shows: Vietnamese and shared ones always, another language's once the player started it
 * (a lesson of it done, or it is the language being learned), and any badge already won.
 */
export function shownBadges(defs: readonly BadgeDef[], p: { lessonsDone: readonly string[]; badges: readonly string[] }, active?: LanguageId | null): BadgeDef[] {
  const started = new Set<LanguageId>(p.lessonsDone.map(languageOfId));
  if (active) started.add(active);
  const owned = new Set(p.badges);
  return defs.filter((d) => {
    const language = languageOfId(d.id);
    return language === "vi" || started.has(language) || owned.has(d.id);
  });
}
