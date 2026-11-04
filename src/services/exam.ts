import { bossLevel, LANGUAGES, languageOfId, type LanguageId } from "@/domain/languages";

export const EXAM_PASS = 70;
export type ExamMention = "excellent" | "tres_bien" | "bien" | "presque";

/** Best score on a language's level 1 boss (null: never fought). Vietnamese falls back to `examBest` for snapshots without `examBests`. */
export function examBestIn(s: { examBest: number | null; examBests?: Partial<Record<LanguageId, number>> }, language: LanguageId): number | null {
  return s.examBests?.[language] ?? (language === "vi" ? s.examBest : null);
}

type Bests = { examBest: number | null; examBests?: Partial<Record<LanguageId, number>>; bossBests?: Record<string, number> };

/** Best score against one boss (null: never fought). */
export function bossBestIn(s: Bests, bossId: string): number | null {
  return bossLevel(bossId) === 1 ? examBestIn(s, languageOfId(bossId)) : (s.bossBests?.[bossId] ?? null);
}

/** Beating a boss opens the next level. */
export function bossWon(s: Bests, bossId: string): boolean {
  const best = bossBestIn(s, bossId);
  return best !== null && best >= EXAM_PASS;
}

/** The highest boss of a language already beaten, or its first boss (`undefined` for a language without one). */
export function topBossId(s: Bests, language: LanguageId): string | undefined {
  const ids = LANGUAGES[language].bossIds;
  return ids.filter((id) => bossWon(s, id)).at(-1) ?? ids[0];
}
