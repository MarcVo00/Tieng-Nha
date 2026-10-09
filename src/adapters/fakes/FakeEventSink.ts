import { OfflineError } from "@/domain/errors";
import type { AppEvent } from "@/domain/types";
import type { EventSink } from "@/ports";

export class FakeEventSink implements EventSink {
  online = true;
  received: AppEvent[] = [];

  async push(events: AppEvent[]): Promise<{ accepted: string[] }> {
    if (!this.online) throw new OfflineError();
    for (const e of events) {
      if (!this.received.some((r) => r.clientId === e.clientId)) this.received.push(e);
    }
    return { accepted: events.map((e) => e.clientId) };
  }
}
