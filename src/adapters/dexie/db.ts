import Dexie, { type Table } from "dexie";
import type { AppEvent, VocabProgress } from "@/domain/types";

export type KvRow = { key: string; value: unknown };
export type ReportRow = { id?: number; refId: string; message: string; contentVersion?: number };

export class VietLearnDb extends Dexie {
  events!: Table<AppEvent, string>;
  outbox!: Table<AppEvent, string>;
  vocab!: Table<VocabProgress, string>;
  kv!: Table<KvRow, string>;
  reports!: Table<ReportRow, number>;

  constructor(name = "vietlearn") {
    super(name);
    // Never edit version(1) once shipped: add version(2) with an upgrade() instead.
    this.version(1).stores({
      events: "clientId, createdAt, type",
      outbox: "clientId, createdAt",
      vocab: "vocabId, dueAt",
      kv: "key",
      reports: "++id",
    });
  }
}
