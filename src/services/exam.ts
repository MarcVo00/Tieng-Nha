import type { LanguageId } from "@/domain/languages";

export const EXAM_PASS = 70;
export type ExamMention = "excellent" | "tres_bien" | "bien" | "presque";

/** Best boss score of a language (null: never fought). Vietnamese falls back to `examBest` for snapshots without `examBests`. */
export function examBestIn(s: { examBest: number | null; examBests?: Partial<Record<LanguageId, number>> }, language: LanguageId): number | null {
  return s.examBests?.[language] ?? (language === "vi" ? s.examBest : null);
}
