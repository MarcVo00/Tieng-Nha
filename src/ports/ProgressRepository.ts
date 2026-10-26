import type { AppEvent, NewEvent, Settings, VocabId, VocabProgress, LeaderboardRow } from "@/domain/types";
export interface ProgressRepository {
  appendEvent(e: NewEvent, nowIso: string): Promise<AppEvent>; // assigns clientId (crypto.randomUUID()), createdAt = nowIso, schemaVersion 1
  listEvents(): Promise<AppEvent[]>; // ordered by createdAt asc
  getVocabProgress(id: VocabId): Promise<VocabProgress | undefined>;
  upsertVocabProgress(p: VocabProgress): Promise<void>;
  listDueVocab(nowIso: string, limit: number): Promise<VocabProgress[]>; // dueAt <= now, ordered by dueAt asc
  countDueVocab(nowIso: string): Promise<number>;
  getSettings(): Promise<Settings>; // returns DEFAULT_SETTINGS if none saved
  saveSettings(s: Settings): Promise<void>;
  getCachedLeaderboard(period: "week" | "all"): Promise<{ rows: LeaderboardRow[]; fetchedAt: string } | undefined>;
  cacheLeaderboard(period: "week" | "all", rows: LeaderboardRow[], fetchedAt: string): Promise<void>;
  clearAll(): Promise<void>; // used on account deletion / sign out
}
export const DEFAULT_SETTINGS = { theme: "system", voiceRate: "normal", voice: "south-f", capabilities: null, onboardingDone: false, sound: true } as const;
