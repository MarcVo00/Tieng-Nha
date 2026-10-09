import type { AppEvent } from "@/domain/types";
import type { Outbox } from "@/ports";

export class InMemoryOutbox implements Outbox {
  private items: AppEvent[] = [];

  async enqueue(e: AppEvent): Promise<void> {
    this.items.push(e);
  }

  async peek(n: number): Promise<AppEvent[]> {
    return this.items.slice(0, n);
  }

  async ack(clientIds: string[]): Promise<void> {
    const ids = new Set(clientIds);
    this.items = this.items.filter((e) => !ids.has(e.clientId));
  }

  async size(): Promise<number> {
    return this.items.length;
  }
}
