import type { ProgressRepository } from "@/ports";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { VOICE_IDS, type AppEvent, type LeaderboardRow, type NewEvent, type Settings, type VocabProgress } from "@/domain/types";
import { THEME_KEY } from "@/domain/storageKeys";
import type { TiengNhaDb } from "@/adapters/dexie/db";

export const THEME_STORAGE_KEY = THEME_KEY;
const SETTINGS_KEY = "settings";
const lbKey = (p: "week" | "all") => `leaderboard:${p}`;

export class DexieProgressRepository implements ProgressRepository {
  constructor(
    private readonly db: TiengNhaDb,
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
    const merged: Settings = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
    // Rows saved before voice packs have no voice, rows saved before 1.7 no sound; unknown values fall back to the default too.
    const voice = VOICE_IDS.includes(merged.voice) ? merged.voice : DEFAULT_SETTINGS.voice;
    const sound = typeof merged.sound === "boolean" ? merged.sound : DEFAULT_SETTINGS.sound;
    return { ...merged, voice, sound };
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
    const cached = row?.value as { rows: LeaderboardRow[]; fetchedAt: string } | undefined;
    // Rows cached before heroes existed carry no look: they read as the default hero.
    return cached && { ...cached, rows: cached.rows.map((r) => ({ ...r, look: r.look ?? {} })) };
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
