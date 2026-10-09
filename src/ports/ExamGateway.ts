export interface ExamGateway {
  startAttempt(): Promise<{ attemptId: string; remainingToday: number }>; // ExamLimitError | OfflineError
  submitAttempt(attemptId: string, score: number): Promise<void>;
}
