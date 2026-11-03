import type { LanguageId } from "@/domain/languages";

export interface ExamGateway {
  /** 3 attempts per Paris day and per language. */
  startAttempt(language: LanguageId): Promise<{ attemptId: string; remainingToday: number }>; // ExamLimitError | OfflineError
  submitAttempt(attemptId: string, score: number): Promise<void>;
}
