import type { AppEvent } from "@/domain/types";
export interface EventSink {
  /** Inserts events idempotently (on conflict client_id do nothing). Returns clientIds now stored server-side. Throws OfflineError when unreachable. */
  push(events: AppEvent[]): Promise<{ accepted: string[] }>;
}
