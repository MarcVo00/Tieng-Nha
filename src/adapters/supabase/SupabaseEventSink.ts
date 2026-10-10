import type { Db } from "@/adapters/supabase/client";
import type { Json } from "@/adapters/supabase/types.gen";
import { mapError } from "@/adapters/supabase/errors";
import { NotAuthenticatedError } from "@/domain/errors";
import type { AppEvent } from "@/domain/types";
import type { EventSink } from "@/ports";

/** Postgres data exception (22xxx) or integrity violation (23xxx): the row itself is bad, retrying cannot help. */
function isDataError(err: { code?: string | undefined } | null): boolean {
  const code = err?.code ?? "";
  return code.startsWith("22") || code.startsWith("23");
}

export class SupabaseEventSink implements EventSink {
  constructor(private readonly db: Db) {}

  async push(events: AppEvent[]): Promise<{ accepted: string[] }> {
    if (events.length === 0) return { accepted: [] };
    const { data, error: userError } = await this.db.auth.getUser();
    if (userError) throw mapError(userError);
    if (!data.user) throw new NotAuthenticatedError();
    const uid = data.user.id;
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
    if (!isDataError(batch.error)) throw mapError(batch.error);

    // Batch rejected because of a corrupt row: isolate it so it cannot block the outbox forever.
    const accepted: string[] = [];
    for (const row of rows) {
      const one = await this.db.from("events").upsert([row], opts);
      if (!one.error) {
        accepted.push(row.client_id);
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
