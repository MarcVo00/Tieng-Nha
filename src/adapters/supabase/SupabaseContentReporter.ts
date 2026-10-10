import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import { NotAuthenticatedError, OfflineError } from "@/domain/errors";
import type { ContentReporter } from "@/ports";

/** Structural port of the local report queue (satisfied by DexieReportQueue; adapters must not import each other). */
export interface ReportQueue {
  add(r: { refId: string; message: string; contentVersion?: number }): Promise<void>;
  all(): Promise<{ id: number; refId: string; message: string; contentVersion?: number }[]>;
  remove(id: number): Promise<void>;
}

export class SupabaseContentReporter implements ContentReporter {
  private flushing: Promise<void> | null = null;

  constructor(private readonly db: Db, private readonly queue: ReportQueue) {}

  async report(r: { refId: string; message: string; contentVersion?: number }): Promise<void> {
    await this.queue.add(r);
    await this.flushReports();
  }

  /** Sends queued reports; stops silently at the first network failure or when signed out (they stay queued). */
  flushReports(): Promise<void> {
    this.flushing ??= this.doFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(): Promise<void> {
    try {
      const { data, error: userError } = await this.db.auth.getUser();
      if (userError) throw mapError(userError);
      if (!data.user) return;
      const uid = data.user.id;
      for (const q of await this.queue.all()) {
        const { error } = await this.db.from("content_reports").insert({
          user_id: uid,
          ref_id: q.refId,
          message: q.message,
          content_version: q.contentVersion ?? null,
        });
        if (error) throw mapError(error);
        await this.queue.remove(q.id);
      }
    } catch (e) {
      if (e instanceof OfflineError || e instanceof NotAuthenticatedError) return;
      throw e;
    }
  }
}
