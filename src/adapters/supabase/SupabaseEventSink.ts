import type { Db } from "@/adapters/supabase/client";
import type { Json } from "@/adapters/supabase/types.gen";
import { mapError } from "@/adapters/supabase/errors";
import { NotAuthenticatedError } from "@/domain/errors";
import type { AppEvent } from "@/domain/types";
import type { EventSink } from "@/ports";

/** FK violation: the profile row is missing (not created yet, or account deleted). Events must stay queued. */
function isMissingProfile(err: { code?: string | undefined } | null): boolean {
  return err?.code === "23503";
}

/** Postgres data exception (22xxx) or integrity violation (23xxx, except FK): the row itself is bad, retrying cannot help. */
function isDataError(err: { code?: string | undefined } | null): boolean {
  const code = err?.code ?? "";
  return code.startsWith("22") || (code.startsWith("23") && code !== "23503");
}

export class SupabaseEventSink implements EventSink {
  constructor(private readonly db: Db) {}

  async push(events: AppEvent[]): Promise<{ accepted: string[] }> {
    if (events.length === 0) return { accepted: [] };
    const { data, error: sessionError } = await this.db.auth.getSession();
    if (sessionError) throw mapError(sessionError);
    if (!data.session) throw new NotAuthenticatedError();
    const uid = data.session.user.id;
    const rows = events.map((e) => ({
      client_id: e.clientId,
      user_id: uid,
      schema_version: e.schemaVersion,
      type: e.type,
      ref_id: e.refId,
      xp: e.xp,
      payload: e.payload as Json,
      client_created_at: e.createdAt,
    }));
    const opts = { onConflict: "client_id", ignoreDuplicates: true } as const;

    const batch = await this.db.from("events").upsert(rows, opts);
    if (!batch.error) return { accepted: events.map((e) => e.clientId) };
    if (isMissingProfile(batch.error)) throw new NotAuthenticatedError();
    if (!isDataError(batch.error)) throw mapError(batch.error);

    // Batch rejected because of a corrupt row: isolate it so it cannot block the outbox forever.
    const accepted: string[] = [];
    for (const row of rows) {
      const one = await this.db.from("events").upsert([row], opts);
      if (!one.error) {
        accepted.push(row.client_id);
      } else if (isMissingProfile(one.error)) {
        throw new NotAuthenticatedError();
      } else if (isDataError(one.error)) {
        console.warn("Dropping event rejected by the server", row.client_id, one.error.code, one.error.message);
        accepted.push(row.client_id);
      } else {
        throw mapError(one.error);
      }
    }
    return { accepted };
  }
}
