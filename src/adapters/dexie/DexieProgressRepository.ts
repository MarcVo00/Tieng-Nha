import type { ProgressRepository } from "@/ports";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import type { AppEvent, LeaderboardRow, NewEvent, Settings, VocabProgress } from "@/domain/types";
import type { VietLearnDb } from "@/adapters/dexie/db";

export const THEME_STORAGE_KEY = "vl-theme";
const SETTINGS_KEY = "settings";
const lbKey = (p: "week" | "all") => `leaderboard:${p}`;

export class DexieProgressRepository implements ProgressRepository {
  constructor(
    private readonly db: VietLearnDb,
    private readonly storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
  ) {}

  async appendEvent(e: NewEvent, nowIso: string): Promise<AppEvent> {
    const ev: AppEvent = { ...e, clientId: crypto.randomUUID(), schemaVersion: 1, createdAt: nowIso };
    await this.db.events.add(ev);
    return ev;
  }
  listEvents(): Promise<AppEvent[]> {
    return this.db.events.orderBy("createdAt").toArray();
  }
  getVocabProgress(id: string): Promise<VocabProgress | undefined> {
    return this.db.vocab.get(id);
  }
  async upsertVocabProgress(p: VocabProgress): Promise<void> {
    await this.db.vocab.put(p);
  }
  listDueVocab(nowIso: string, limit: number): Promise<VocabProgress[]> {
    // The dueAt index already yields ascending order; limit applies in that order.
    return this.db.vocab.where("dueAt").belowOrEqual(nowIso).limit(limit).toArray();
  }
  countDueVocab(nowIso: string): Promise<number> {
    return this.db.vocab.where("dueAt").belowOrEqual(nowIso).count();
  }
  async getSettings(): Promise<Settings> {
    const row = await this.db.kv.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
  }
  async saveSettings(s: Settings): Promise<void> {
    await this.db.kv.put({ key: SETTINGS_KEY, value: s });
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, s.theme);
    } catch {
      /* private mode: ignore */
    }
  }
  async getCachedLeaderboard(period: "week" | "all"): Promise<{ rows: LeaderboardRow[]; fetchedAt: string } | undefined> {
    const row = await this.db.kv.get(lbKey(period));
    return row?.value as { rows: LeaderboardRow[]; fetchedAt: string } | undefined;
  }
  async cacheLeaderboard(period: "week" | "all", rows: LeaderboardRow[], fetchedAt: string): Promise<void> {
    await this.db.kv.put({ key: lbKey(period), value: { rows, fetchedAt } });
  }
  async clearAll(): Promise<void> {
    await this.db.transaction("rw", [this.db.events, this.db.outbox, this.db.vocab, this.db.kv, this.db.reports], async () => {
      await Promise.all([this.db.events.clear(), this.db.outbox.clear(), this.db.vocab.clear(), this.db.kv.clear(), this.db.reports.clear()]);
    });
  }
}
