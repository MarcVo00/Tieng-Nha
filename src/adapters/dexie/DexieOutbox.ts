import type { Outbox } from "@/ports";
import type { AppEvent } from "@/domain/types";
import type { TiengNhaDb } from "@/adapters/dexie/db";

export class DexieOutbox implements Outbox {
  constructor(private readonly db: TiengNhaDb) {}
  async enqueue(e: AppEvent): Promise<void> {
    await this.db.outbox.put(e);
  }
  peek(n: number): Promise<AppEvent[]> {
    return this.db.outbox.orderBy("createdAt").limit(n).toArray();
  }
  async ack(ids: string[]): Promise<void> {
    await this.db.outbox.bulkDelete(ids);
  }
  size(): Promise<number> {
    return this.db.outbox.count();
  }
}
