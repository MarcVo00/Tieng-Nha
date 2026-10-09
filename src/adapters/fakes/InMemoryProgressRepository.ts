import type { AppEvent, LeaderboardRow, NewEvent, Settings, VocabId, VocabProgress } from "@/domain/types";
import { DEFAULT_SETTINGS, type ProgressRepository } from "@/ports/ProgressRepository";

type Period = "week" | "all";

export class InMemoryProgressRepository implements ProgressRepository {
  private events: AppEvent[] = [];
  private vocab = new Map<VocabId, VocabProgress>();
  private settings: Settings | undefined;
  private boards = new Map<Period, { rows: LeaderboardRow[]; fetchedAt: string }>();

  async appendEvent(e: NewEvent, nowIso: string): Promise<AppEvent> {
    const event: AppEvent = { ...e, clientId: crypto.randomUUID(), createdAt: nowIso, schemaVersion: 1 };
    this.events.push(event);
    return event;
  }

  async listEvents(): Promise<AppEvent[]> {
    return [...this.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getVocabProgress(id: VocabId): Promise<VocabProgress | undefined> {
    return this.vocab.get(id);
  }

  async upsertVocabProgress(p: VocabProgress): Promise<void> {
    this.vocab.set(p.vocabId, p);
  }

  async listDueVocab(nowIso: string, limit: number): Promise<VocabProgress[]> {
    return [...this.vocab.values()]
      .filter((p) => p.dueAt <= nowIso)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, limit);
  }

  async countDueVocab(nowIso: string): Promise<number> {
    return [...this.vocab.values()].filter((p) => p.dueAt <= nowIso).length;
  }

  async getSettings(): Promise<Settings> {
    return this.settings ?? { ...DEFAULT_SETTINGS };
  }

  async saveSettings(s: Settings): Promise<void> {
    this.settings = s;
  }

  async getCachedLeaderboard(period: Period): Promise<{ rows: LeaderboardRow[]; fetchedAt: string } | undefined> {
    return this.boards.get(period);
  }

  async cacheLeaderboard(period: Period, rows: LeaderboardRow[], fetchedAt: string): Promise<void> {
    this.boards.set(period, { rows, fetchedAt });
  }

  async clearAll(): Promise<void> {
    this.events = [];
    this.vocab.clear();
    this.settings = undefined;
    this.boards.clear();
  }
}
