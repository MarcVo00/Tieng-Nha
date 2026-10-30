import type { AppEvent, AppEventType, BadgeDef, DialogueId, Duel, EnergyState, GachaPull, ItemSlot, LessonId, NewEvent, ProgressSnapshot, SessionKind, VocabId, Wallet } from "@/domain/types";
import type { ContentSource, Outbox, ProgressRepository } from "@/ports";
import { computeProgress } from "@/services/progress";
import { evaluateBadges } from "@/services/badges";
import { dialogueXp, examXpDelta, lessonXp, reviewXp } from "@/services/xp";
import { introduce, record } from "@/services/leitner";
import { ENERGY, energyAt } from "@/services/energy";
import { equippable, nextDailyBonus, purchasable, walletAt } from "@/services/wallet";
import { parisDay } from "@/services/time";
import { struggleAt, type Struggle } from "@/services/struggle";

export type ActivityResult = { xpGained: number; newBadges: BadgeDef[]; snapshot: ProgressSnapshot; firstTime: boolean; energyGained?: number; coinsGained: number };
export type ActivityService = {
  getSnapshot(): Promise<ProgressSnapshot>;
  getEnergy(): Promise<EnergyState>;
  getWallet(): Promise<Wallet>;
  purchase(itemId: string): Promise<{ ok: boolean; wallet: Wallet }>;
  equip(slot: ItemSlot, itemId: string | null): Promise<{ ok: boolean; wallet: Wallet }>;
  /** `free`: the attempt after a training (spec 2026-10-30) spends no energy. */
  startSession(kind: SessionKind, refId: string, opts?: { free?: boolean }): Promise<{ ok: boolean; energy: EnergyState }>;
  /** Where the learner stands on a lesson: failures since its last completion, missed words, talisman. */
  getStruggle(lessonId: LessonId): Promise<Struggle>;
  /** Notes a lost lesson (local journal only) with the words and exercises missed in that attempt. */
  recordLessonFailure(lessonId: LessonId, missed: { vocabIds: readonly VocabId[]; exerciseIds: readonly string[] }): Promise<void>;
  /** Notes a finished training (local journal only): the next attempt of the lesson gets the talisman. */
  completeTraining(lessonId: LessonId): Promise<void>;
  introduceVocab(vocabIds: readonly VocabId[]): Promise<void>;
  recordAnswer(vocabIds: readonly VocabId[], correct: boolean): Promise<void>;
  completeLesson(i: { lessonId: LessonId; mistakes: number; durationMs: number; vocabIds: readonly VocabId[] }): Promise<ActivityResult>;
  completeDialogue(i: { dialogueId: DialogueId; durationMs: number }): Promise<ActivityResult>;
  completeReview(i: { correctCount: number; total: number }): Promise<ActivityResult>;
  finishExam(i: { attemptId: string; score: number; noSpeaking: boolean; boss?: BossOutcome }): Promise<ActivityResult>;
  /**
   * Mirrors settled duels into the local journal: one `duel_settled` per rewarded duel not yet in it (ADR 0004).
   * Returns the Kim bài added to the local wallet.
   */
  claimSettledDuels(duels: readonly Duel[]): Promise<number>;
  /**
   * Mirrors gacha pulls into the local journal: one `gacha_pulled` per pull not yet in it, built from the SERVER result.
   * Idempotent and serialised. Returns the pulls newly appended (in the given order).
   */
  claimGachaPulls(pulls: readonly GachaPull[]): Promise<GachaPull[]>;
  /** Opens today's daily bonus (once per Paris day, serialised). `coins` is what the local wallet credited (0 when refused). */
  claimDailyBonus(): Promise<{ ok: boolean; day: number; coins: number; wallet: Wallet }>;
  /** Demo mode only: credits xu / Kim bài in the local journal (never synced). Non-negative integers. */
  demoGrant(coins: number, kimBai: number): Promise<Wallet>;
};

export type BossOutcome = { bossId: string; won: boolean; livesLeft: number; bossHpLeft: number };

export function createActivityService(deps: {
  progress: ProgressRepository; outbox: Outbox; content: ContentSource; clock: () => string; onEventAppended?: () => void;
}): ActivityService {
  const { progress, outbox, content, clock } = deps;
  const load = async (): Promise<{ events: AppEvent[]; wallet: Wallet }> => {
    const [events, shop, badges] = await Promise.all([progress.listEvents(), content.getShop(), content.getBadges()]);
    return { events, wallet: walletAt(events, shop, badges) };
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

  // Rule (ADR 0004): the wallet is a projection of the LOCAL journal, the server balance a projection of the SERVER journal.
  // Each device mirrors every rewarded settled duel exactly once into its own journal, whether or not the server already
  // credited it (`myRun.claimed`, set when any device's `duel_settled` was applied). The server credits `duel_runs.reward`
  // only while `claimed` is false and ignores later events of the same duel, so a second device or a reinstall shows the
  // reward locally without ever crediting it twice on the server. `claimed` is recorded in the payload for traceability.
  // Serialises claims so two overlapping calls cannot both see a duel as unclaimed.
  let claiming: Promise<unknown> = Promise.resolve();
  async function claim(duels: readonly Duel[]): Promise<number> {
    const claimed = new Set((await progress.listEvents()).filter((e) => e.type === "duel_settled").map((e) => e.refId));
    let added = 0;
    let appended = 0;
    for (const d of duels) {
      const reward = d.status === "settled" ? d.myRun?.reward : null;
      if (reward === null || reward === undefined || claimed.has(d.id)) continue;
      await append(ev("duel_settled", d.id, 0, { kimBai: reward, claimed: d.myRun?.claimed ?? false }));
      claimed.add(d.id);
      added += reward;
      appended += 1;
    }
    if (appended > 0) deps.onEventAppended?.();
    return added;
  }

  // Same rule as the duels: the server already debited/credited, the journal only mirrors each pull once.
  // A pull the server already marks `claimed` was applied to the xu by another device (or an earlier install): the
  // journal of this device, which starts empty, only learns its items (cost 0, no refund), else its balance goes negative.
  let claimingPulls: Promise<unknown> = Promise.resolve();
  async function claimPulls(pulls: readonly GachaPull[]): Promise<GachaPull[]> {
    const claimed = new Set((await progress.listEvents()).filter((e) => e.type === "gacha_pulled").map((e) => e.refId));
    const added: GachaPull[] = [];
    for (const p of pulls) {
      if (claimed.has(p.id) || p.id === "" || p.items.length === 0) continue;
      await append(ev("gacha_pulled", p.id, 0, { theme: p.theme, cost: p.claimed ? 0 : p.cost, items: p.items.map((i) => ({ itemId: i.itemId, rarity: i.rarity, duplicate: i.duplicate, refund: p.claimed ? 0 : i.refund })) }));
      claimed.add(p.id);
      added.push(p);
    }
    if (added.length > 0) deps.onEventAppended?.();
    return added;
  }

  let claimingBonus: Promise<unknown> = Promise.resolve();

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
    async startSession(kind, refId, opts) {
      const before = await energy();
      const free = opts?.free === true;
      if (!free && before.current < ENERGY.cost[kind]) return { ok: false, energy: before };
      await progress.appendEvent({ type: "session_started", refId, xp: 0, payload: free ? { kind, free } : { kind } }, clock()); // local only: never enqueued
      return { ok: true, energy: await energy() };
    },
    async getStruggle(lessonId) {
      return struggleAt(await progress.listEvents(), lessonId);
    },
    async recordLessonFailure(lessonId, { vocabIds, exerciseIds }) {
      await progress.appendEvent({ type: "lesson_failed", refId: lessonId, xp: 0, payload: { vocabIds: [...vocabIds], exerciseIds: [...exerciseIds] } }, clock()); // local only
    },
    async completeTraining(lessonId) {
      await progress.appendEvent({ type: "training_done", refId: lessonId, xp: 0, payload: {} }, clock()); // local only
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
    claimSettledDuels(duels) {
      const run = claiming.then(() => claim(duels));
      claiming = run.catch(() => undefined);
      return run;
    },
    claimGachaPulls(pulls) {
      const run = claimingPulls.then(() => claimPulls(pulls));
      claimingPulls = run.catch(() => undefined);
      return run;
    },
    claimDailyBonus() {
      const run = claimingBonus.then(async () => {
        const today = parisDay(clock());
        const next = nextDailyBonus(await wallet(), today);
        if (!next) return { ok: false, day: 0, coins: 0, wallet: await wallet() };
        await append(ev("daily_bonus_claimed", today, 0, next));
        deps.onEventAppended?.();
        return { ok: true, ...next, wallet: await wallet() };
      });
      claimingBonus = run.catch(() => undefined);
      return run;
    },
    async demoGrant(coins, kimBai) {
      const ok = (n: number) => Number.isInteger(n) && n >= 0;
      if (!ok(coins) || !ok(kimBai)) return wallet();
      await progress.appendEvent({ type: "demo_grant", refId: "demo", xp: 0, payload: { coins, kimBai } }, clock()); // local only: never enqueued
      return wallet();
    },
    async finishExam({ attemptId, score, noSpeaking, boss }) {
      const best = (await snapshot()).examBest;
      return commit(ev("exam_finished", "exam", examXpDelta(score, best), { score, attemptId, noSpeaking, ...(boss ?? {}) }), best === null);
    },
  };
}
