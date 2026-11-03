import { languageOfId, type LanguageId } from "@/domain/languages";
import type { LeaderboardRow } from "@/domain/types";

/** How many of these content ids belong to `language`. */
export function countInLanguage(ids: readonly string[], language: LanguageId): number {
  return ids.filter((id) => languageOfId(id) === language).length;
}

/**
 * Lessons a leaderboard row has done in `language`. A row cached before 2.0 carries only a total:
 * it was all Vietnamese then.
 */
export function rowLessonsIn(row: Pick<LeaderboardRow, "lessonsDone" | "lessonIds">, language: LanguageId): number {
  if (row.lessonIds) return countInLanguage(row.lessonIds, language);
  return language === "vi" ? row.lessonsDone : 0;
}
