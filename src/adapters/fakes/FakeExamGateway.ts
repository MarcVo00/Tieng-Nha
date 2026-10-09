import { ExamLimitError, OfflineError } from "@/domain/errors";
import type { ExamGateway } from "@/ports";

const MAX_PER_DAY = 3;

export class FakeExamGateway implements ExamGateway {
  online = true;
  submitted: Array<{ attemptId: string; score: number }> = [];
  private attemptsByDay = new Map<string, number>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  async startAttempt(): Promise<{ attemptId: string; remainingToday: number }> {
    if (!this.online) throw new OfflineError();
    const day = this.clock().slice(0, 10);
    const used = this.attemptsByDay.get(day) ?? 0;
    if (used >= MAX_PER_DAY) throw new ExamLimitError();
    this.attemptsByDay.set(day, used + 1);
    return { attemptId: crypto.randomUUID(), remainingToday: MAX_PER_DAY - used - 1 };
  }

  async submitAttempt(attemptId: string, score: number): Promise<void> {
    if (!this.online) throw new OfflineError();
    this.submitted.push({ attemptId, score });
  }
}
