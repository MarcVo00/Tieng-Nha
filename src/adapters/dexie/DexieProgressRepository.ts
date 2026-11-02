import type { ProgressRepository } from "@/ports";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { VOICE_IDS, type AppEvent, type LeaderboardRow, type NewEvent, type Settings, type VocabProgress } from "@/domain/types";
import { LANGUAGE_IDS, languageOfId, type LanguageId } from "@/domain/languages";
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
  listDueVocab(nowIso: string, limit: number, language?: LanguageId): Promise<VocabProgress[]> {
    // The dueAt index already yields ascending order; the language filter and the limit apply in that order.
    const due = this.db.vocab.where("dueAt").belowOrEqual(nowIso);
    return (language ? due.filter((p) => languageOfId(p.vocabId) === language) : due).limit(limit).toArray();
  }
  countDueVocab(nowIso: string, language?: LanguageId): Promise<number> {
    const due = this.db.vocab.where("dueAt").belowOrEqual(nowIso);
    return (language ? due.filter((p) => languageOfId(p.vocabId) === language) : due).count();
  }
  async getSettings(): Promise<Settings> {
    const row = await this.db.kv.get(SETTINGS_KEY);
    const merged: Settings = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
    // Rows saved before voice packs have no voice, rows saved before 1.7 no sound; unknown values fall back to the default too.
    const voice = VOICE_IDS.includes(merged.voice) ? merged.voice : DEFAULT_SETTINGS.voice;
    const sound = typeof merged.sound === "boolean" ? merged.sound : DEFAULT_SETTINGS.sound;
    // Rows saved before 2.0 have no language: not chosen yet.
    const language = LANGUAGE_IDS.includes(merged.language as LanguageId) ? merged.language : DEFAULT_SETTINGS.language;
    return { ...merged, voice, sound, language };
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
