import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import type { ExamGateway } from "@/ports";

export class SupabaseExamGateway implements ExamGateway {
  constructor(private readonly db: Db) {}

  async startAttempt(): Promise<{ attemptId: string; remainingToday: number }> {
    const { data, error } = await this.db.rpc("start_exam_attempt");
    if (error) throw mapError(error);
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("invalid_exam_response");
    const attemptId = data["attempt_id"];
    const remaining = data["remaining_today"];
    if (typeof attemptId !== "string" || typeof remaining !== "number") throw new Error("invalid_exam_response");
    return { attemptId, remainingToday: remaining };
  }

  /** No-op: the server-side apply_event trigger scores the attempt from the synced `exam_finished` event. */
  async submitAttempt(): Promise<void> {
    await Promise.resolve();
  }
}
