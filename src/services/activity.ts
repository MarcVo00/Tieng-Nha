import type { AppEvent, AppEventType, BadgeDef, DialogueId, EnergyState, ItemSlot, LessonId, NewEvent, ProgressSnapshot, SessionKind, VocabId, Wallet } from "@/domain/types";
import type { ContentSource, Outbox, ProgressRepository } from "@/ports";
import { computeProgress } from "@/services/progress";
import { evaluateBadges } from "@/services/badges";
import { dialogueXp, examXpDelta, lessonXp, reviewXp } from "@/services/xp";
import { introduce, record } from "@/services/leitner";
import { ENERGY, energyAt } from "@/services/energy";
import { equippable, purchasable, walletAt } from "@/services/wallet";

export type ActivityResult = { xpGained: number; newBadges: BadgeDef[]; snapshot: ProgressSnapshot; firstTime: boolean; energyGained?: number; coinsGained: number };
export type ActivityService = {
  getSnapshot(): Promise<ProgressSnapshot>;
  getEnergy(): Promise<EnergyState>;
  getWallet(): Promise<Wallet>;
  purchase(itemId: string): Promise<{ ok: boolean; wallet: Wallet }>;
  equip(slot: ItemSlot, itemId: string | null): Promise<{ ok: boolean; wallet: Wallet }>;
  startSession(kind: SessionKind, refId: string): Promise<{ ok: boolean; energy: EnergyState }>;
  introduceVocab(vocabIds: readonly VocabId[]): Promise<void>;
  recordAnswer(vocabIds: readonly VocabId[], correct: boolean): Promise<void>;
  completeLesson(i: { lessonId: LessonId; mistakes: number; durationMs: number; vocabIds: readonly VocabId[] }): Promise<ActivityResult>;
  completeDialogue(i: { dialogueId: DialogueId; durationMs: number }): Promise<ActivityResult>;
  completeReview(i: { correctCount: number; total: number }): Promise<ActivityResult>;
  finishExam(i: { attemptId: string; score: number; noSpeaking: boolean; boss?: BossOutcome }): Promise<ActivityResult>;
};

export type BossOutcome = { bossId: string; won: boolean; livesLeft: number; bossHpLeft: number };

export function createActivityService(deps: {
  progress: ProgressRepository; outbox: Outbox; content: ContentSource; clock: () => string; onEventAppended?: () => void;
}): ActivityService {
  const { progress, outbox, content, clock } = deps;
  const load = async (): Promise<{ events: AppEvent[]; wallet: Wallet }> => {
    const [events, shop] = await Promise.all([progress.listEvents(), content.getShop()]);
    return { events, wallet: walletAt(events, shop) };
  };
  const snapshot = async () => {
    const { events, wallet } = await load();
    return computeProgress(events, clock(), { streak: wallet.streak, lastActiveDay: wallet.lastActiveDay, freezes: wallet.freezes });
  };
  const energy = async () => {
    const { events, wallet } = await load();
    return energyAt(events, clock(), wallet.refills);
  };
  const wallet = async () => (await load()).wallet;

  async function append(e: NewEvent) {
    const saved = await progress.appendEvent(e, clock());
    await outbox.enqueue(saved);
  }

  async function commit(e: NewEvent, firstTime: boolean): Promise<ActivityResult> {
    const before = await snapshot();
    const coinsBefore = (await wallet()).coins;
    await append(e);
    const mid = await snapshot();
    const defs = await content.getBadges();
    const newIds = evaluateBadges(mid, defs);
    for (const id of newIds) await append({ type: "badge_unlocked", refId: id, xp: 0, payload: {} });
    deps.onEventAppended?.();
    const after = newIds.length ? await snapshot() : mid;
    const coinsGained = (await wallet()).coins - coinsBefore;
    return { xpGained: after.xpTotal - before.xpTotal, newBadges: defs.filter((d) => newIds.includes(d.id)), snapshot: after, firstTime, coinsGained };
  }

  const ev = (type: AppEventType, refId: string, xp: number, payload: Record<string, unknown>): NewEvent => ({ type, refId, xp, payload });

  async function introduceVocab(ids: readonly VocabId[]) {
    const now = clock();
    for (const id of ids) if (!(await progress.getVocabProgress(id))) await progress.upsertVocabProgress(introduce(id, now));
  }

  return {
    getSnapshot: snapshot,
    async getEnergy() {
      return energy();
    },
    getWallet: wallet,
    async purchase(itemId) {
      const { wallet: w } = await load();
      if (!purchasable(w, await content.getShop(), itemId)) return { ok: false, wallet: w };
      await append(ev("item_purchased", itemId, 0, { itemId }));
      deps.onEventAppended?.();
      return { ok: true, wallet: await wallet() };
    },
    async equip(slot, itemId) {
      const { wallet: w } = await load();
      if (!equippable(w, await content.getShop(), slot, itemId)) return { ok: false, wallet: w };
      await append(ev("item_equipped", slot, 0, { slot, itemId }));
      deps.onEventAppended?.();
      return { ok: true, wallet: await wallet() };
    },
    async startSession(kind, refId) {
      const before = await energy();
      if (before.current < ENERGY.cost[kind]) return { ok: false, energy: before };
      await progress.appendEvent({ type: "session_started", refId, xp: 0, payload: { kind } }, clock()); // local only: never enqueued
      return { ok: true, energy: await energy() };
    },
    introduceVocab,
    async recordAnswer(ids, correct) {
      const now = clock();
      for (const id of ids) {
        const p = await progress.getVocabProgress(id);
        if (p) await progress.upsertVocabProgress(record(p, correct, now));
      }
    },
    async completeLesson({ lessonId, mistakes, durationMs, vocabIds }) {
      const firstTime = !(await snapshot()).lessonsDone.includes(lessonId);
      await introduceVocab(vocabIds);
      const perfect = mistakes === 0;
      return commit(ev("lesson_completed", lessonId, lessonXp({ firstTime, perfect }), { mistakes, durationMs, perfect }), firstTime);
    },
    async completeDialogue({ dialogueId, durationMs }) {
      const firstTime = !(await snapshot()).dialoguesDone.includes(dialogueId);
      return commit(ev("dialogue_completed", dialogueId, dialogueXp({ firstTime }), { durationMs }), firstTime);
    },
    async completeReview({ correctCount, total }) {
      const before = (await energy()).current;
      const result = await commit(ev("review_session_completed", "review", reviewXp(correctCount), { correctCount, total }), false);
      return { ...result, energyGained: (await energy()).current - before };
    },
    async finishExam({ attemptId, score, noSpeaking, boss }) {
      const best = (await snapshot()).examBest;
      return commit(ev("exam_finished", "exam", examXpDelta(score, best), { score, attemptId, noSpeaking, ...(boss ?? {}) }), best === null);
    },
  };
}
