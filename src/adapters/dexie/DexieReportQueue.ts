import type { TiengNhaDb } from "@/adapters/dexie/db";

export type QueuedReport = { id: number; refId: string; message: string; contentVersion?: number };

export class DexieReportQueue {
  constructor(private readonly db: TiengNhaDb) {}

  async add(r: { refId: string; message: string; contentVersion?: number }): Promise<void> {
    await this.db.reports.add(r);
  }

  async all(): Promise<QueuedReport[]> {
    const rows = await this.db.reports.toArray();
    const out: QueuedReport[] = [];
    for (const { id, ...rest } of rows) {
      if (id !== undefined) out.push({ id, ...rest });
    }
    return out;
  }

  async remove(id: number): Promise<void> {
    await this.db.reports.delete(id);
  }
}
