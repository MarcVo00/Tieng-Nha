import type { LanguageId } from "@/domain/languages";

export interface ExamGateway {
  /** 3 attempts per Paris day and per boss; `bossId` only above level 1 (level 1 is the language's own count). */
  startAttempt(language: LanguageId, bossId?: string): Promise<{ attemptId: string; remainingToday: number }>; // ExamLimitError | OfflineError
  submitAttempt(attemptId: string, score: number): Promise<void>;
}
