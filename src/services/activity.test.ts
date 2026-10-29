import type { Duel, GachaPull } from "@/domain/types";
import { createActivityService } from "@/services/activity";
import { InMemoryProgressRepository, InMemoryOutbox } from "@/adapters/fakes";
import { createFakeServices } from "@/adapters/fakes";

function setup(now = "2026-10-10T08:00:00.000Z") {
  const progress = new InMemoryProgressRepository();
  const outbox = new InMemoryOutbox();
  const { content } = createFakeServices();
  let t = now;
  const appended: number[] = [];
  const svc = createActivityService({ progress, outbox, content, clock: () => t, onEventAppended: () => appended.push(1) });
  return { svc, progress, outbox, appended, setNow: (v: string) => (t = v) };
}

test("first lesson: xp, event, outbox, vocab introduced, badges", async () => {
  const { svc, progress, outbox, appended } = setup();
  const r = await svc.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 60000, vocabIds: ["v_ly", "v_da"] });
  expect(r.firstTime).toBe(true);
  expect(r.xpGained).toBe(15);
  expect(r.newBadges.map((b) => b.id).sort()).toEqual(["first_lesson", "perfect_lesson"]);
  const events = await progress.listEvents();
  expect(events.map((e) => e.type)).toEqual(["lesson_completed", "badge_unlocked", "badge_unlocked"]);
  expect(await outbox.size()).toBe(3);
  expect(await progress.getVocabProgress("v_ly")).toMatchObject({ box: 1 });
  expect(appended.length).toBeGreaterThan(0);
});

test("replayed lesson gives replay xp and no duplicate badges", async () => {
  const { svc } = setup();
  await svc.completeLesson({ lessonId: "l05", mistakes: 1, durationMs: 1, vocabIds: [] });
  const r = await svc.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
  expect(r.firstTime).toBe(false);
  expect(r.xpGained).toBe(3);
  // A perfect replay unlocks perfect_lesson (first run had a mistake) but earns no +5 bonus (first-time only).
  expect(r.newBadges.map((b) => b.id)).toEqual(["perfect_lesson"]);
});

test("recordAnswer only updates known words", async () => {
  const { svc, progress } = setup();
  await svc.recordAnswer(["v_ly"], true);
  expect(await progress.getVocabProgress("v_ly")).toBeUndefined();
  await svc.introduceVocab(["v_ly"]);
  await svc.recordAnswer(["v_ly"], true);
  expect(await progress.getVocabProgress("v_ly")).toMatchObject({ box: 2, correct: 1 });
});

test("exam xp is the delta over the best score", async () => {
  const { svc } = setup();
  expect((await svc.finishExam({ attemptId: "a", score: 72, noSpeaking: false })).xpGained).toBe(72);
  expect((await svc.finishExam({ attemptId: "b", score: 80, noSpeaking: false })).xpGained).toBe(8);
  expect((await svc.finishExam({ attemptId: "c", score: 50, noSpeaking: false })).xpGained).toBe(0);
});

test("review xp", async () => {
  const { svc } = setup();
  expect((await svc.completeReview({ correctCount: 5, total: 6 })).xpGained).toBe(10);
});

test("finishExam records the boss outcome in the event payload", async () => {
  const { svc, progress } = setup();
  await svc.finishExam({ attemptId: "a1", score: 92, noSpeaking: false, boss: { bossId: "boss_thuy_tinh", won: true, livesLeft: 4, bossHpLeft: 0 } });
  const ev = (await progress.listEvents()).find((e) => e.type === "exam_finished");
  expect(ev?.payload).toEqual({ score: 92, attemptId: "a1", noSpeaking: false, bossId: "boss_thuy_tinh", won: true, livesLeft: 4, bossHpLeft: 0 });
});

test("startSession spends energy in the local journal only, and refuses when there is not enough", async () => {
  const s = createFakeServices({ clock: () => "2026-10-14T08:00:00.000Z" });
  expect(await s.activity.getEnergy()).toEqual({ current: 5, max: 5, nextAt: null });
  const boss = await s.activity.startSession("boss", "boss_thuy_tinh");
  expect(boss).toEqual({ ok: true, energy: { current: 2, max: 5, nextAt: "2026-10-14T11:00:00.000Z" } });
  await s.activity.startSession("lesson", "l05");
  await s.activity.startSession("lesson", "l05");
  const refused = await s.activity.startSession("lesson", "l05");
  expect(refused.ok).toBe(false);
  expect(refused.energy.current).toBe(0);
  const events = await s.progress.listEvents();
  expect(events.filter((e) => e.type === "session_started")).toHaveLength(3);
  expect((await s.outbox.peek(100)).some((e) => e.type === "session_started")).toBe(false);
});

test("a finished review reports the energy it gave back", async () => {
  const s = createFakeServices({ clock: () => "2026-10-14T08:00:00.000Z" });
  await s.activity.startSession("lesson", "l05");
  expect((await s.activity.completeReview({ correctCount: 3, total: 4 })).energyGained).toBe(1);
  expect((await s.activity.completeReview({ correctCount: 3, total: 4 })).energyGained).toBe(0);
});

describe("shop", () => {
  function shopSetup(start = "2026-10-14T08:00:00.000Z") {
    let t = start;
    const progress = new InMemoryProgressRepository();
    const outbox = new InMemoryOutbox();
    const { content } = createFakeServices();
    const activity = createActivityService({ progress, outbox, content, clock: () => t });
    return { s: { activity, progress, outbox }, setNow: (v: string) => (t = v) };
  }

  test("coinsGained on a perfect first lesson is 15 (10 + 5)", async () => {
    const { s } = shopSetup();
    const r = await s.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
    // 15 for the lesson plus 10 per badge unlocked (first_lesson, perfect_lesson).
    expect(r.coinsGained).toBe(15 + 10 * r.newBadges.length);
    expect((await s.activity.getWallet()).coins).toBe(r.coinsGained);
  });

  test("purchase is refused without appending anything when funds are short", async () => {
    const { s } = shopSetup();
    const r = await s.activity.purchase("energy_refill");
    expect(r.ok).toBe(false);
    expect((await s.progress.listEvents()).length).toBe(0);
    expect(await s.outbox.size()).toBe(0);
    expect((await s.activity.purchase("nope")).ok).toBe(false);
  });

  test("an accepted purchase is synced through the outbox and spends the coins", async () => {
    const { s } = shopSetup();
    await s.activity.finishExam({ attemptId: "a", score: 90, noSpeaking: false }); // +50 coins
    const before = (await s.activity.getWallet()).coins;
    const r = await s.activity.purchase("streak_freeze");
    expect(r.ok).toBe(true);
    expect(r.wallet.coins).toBe(before - 50);
    expect(r.wallet.freezes).toBe(1);
    const queued = await s.outbox.peek(100);
    const bought = queued.find((e) => e.type === "item_purchased");
    expect(bought).toMatchObject({ xp: 0, payload: { itemId: "streak_freeze" } });
    expect((await s.activity.purchase("frame_bronze")).ok).toBe(false); // reward-only: no price
  });

  test("equip follows the same rules", async () => {
    const { s } = shopSetup();
    await s.activity.finishExam({ attemptId: "a", score: 90, noSpeaking: false });
    expect((await s.activity.equip("frame", "frame_bronze")).ok).toBe(false);
    expect((await s.activity.purchase("frame_bronze")).ok).toBe(false); // reward-only: cannot be bought
    expect((await s.activity.equip("frame", "frame_bronze")).ok).toBe(false);
    // A reward owned through its badge can be equipped.
    await s.progress.appendEvent({ type: "badge_unlocked", refId: "streak_7", xp: 0, payload: {} }, "2026-10-10T09:00:00.000Z");
    const r = await s.activity.equip("frame", "frame_bronze");
    expect(r.ok).toBe(true);
    expect(r.wallet.equipped.frame).toBe("frame_bronze");
    expect((await s.activity.equip("frame", null)).ok).toBe(true);
  });

  test("an energy refill restores the energy to full", async () => {
    const { s } = shopSetup();
    await s.activity.finishExam({ attemptId: "a", score: 90, noSpeaking: false });
    await s.activity.startSession("boss", "boss_thuy_tinh");
    expect((await s.activity.getEnergy()).current).toBe(2);
    expect((await s.activity.purchase("energy_refill")).ok).toBe(true);
    expect((await s.activity.getEnergy()).current).toBe(5);
  });

  test("a bought streak freeze keeps the streak alive over a missed day", async () => {
    const { s, setNow } = shopSetup("2026-10-10T08:00:00.000Z");
    await s.activity.finishExam({ attemptId: "a", score: 90, noSpeaking: false }); // 50 coins
    await s.activity.completeReview({ correctCount: 1, total: 1 }); // active day 1
    await s.activity.purchase("streak_freeze");
    setNow("2026-10-12T08:00:00.000Z"); // one missed day
    const r = await s.activity.completeReview({ correctCount: 1, total: 1 });
    expect(r.snapshot.streak).toBe(2);
    expect((await s.activity.getWallet()).freezes).toBe(0);
  });
});

describe("claimSettledDuels", () => {
  const run = (reward: number | null, claimed = false) => ({ round1: [], round2: [], damage: 0, timeMs: 0, reward, claimed });
  const duel = (id: string, status: Duel["status"], myRun: Duel["myRun"]): Duel => ({
    id, challenger: "me", opponent: "bot", opponentPseudo: "Bot", opponentAvatar: "x", createdAt: "2026-10-10T08:00:00.000Z",
    expiresAt: "2026-10-13T08:00:00.000Z", status, winner: null, seed: 1, questions: { round1: [], round2: [] }, myRun, theirRun: null,
  });

  test("appends one synced duel_settled per rewarded settled duel and returns the Kim bai added", async () => {
    const { svc, progress, outbox, appended } = setup();
    const added = await svc.claimSettledDuels([
      duel("d1", "settled", run(3)), duel("d2", "settled", run(1)), duel("d3", "open", run(null)),
      duel("d4", "settled", null), duel("d5", "cancelled", null), duel("d6", "settled", run(null)),
    ]);
    expect(added).toBe(4);
    const events = (await progress.listEvents()).filter((e) => e.type === "duel_settled");
    expect(events.map((e) => [e.refId, e.xp, e.payload])).toEqual([["d1", 0, { kimBai: 3, claimed: false }], ["d2", 0, { kimBai: 1, claimed: false }]]);
    expect(await outbox.size()).toBe(2);
    expect(appended.length).toBe(1);
    expect((await svc.getWallet()).kimBai).toBe(4);
  });

  test("device B (empty journal) mirrors a duel the server already credited: wallet shows it, payload says claimed", async () => {
    const a = setup(); // device A: the server has not credited the duel yet
    expect(await a.svc.claimSettledDuels([duel("d1", "settled", run(3, false))])).toBe(3);
    expect((await a.progress.listEvents()).find((e) => e.refId === "d1")?.payload).toEqual({ kimBai: 3, claimed: false });

    const b = setup(); // device B: fresh journal, the list now says claimed
    expect((await b.svc.getWallet()).kimBai).toBe(0);
    expect(await b.svc.claimSettledDuels([duel("d1", "settled", run(3, true))])).toBe(3);
    expect((await b.progress.listEvents()).filter((e) => e.type === "duel_settled").map((e) => [e.refId, e.payload])).toEqual([["d1", { kimBai: 3, claimed: true }]]);
    expect((await b.svc.getWallet()).kimBai).toBe(3);
    expect(await b.svc.claimSettledDuels([duel("d1", "settled", run(3, true))])).toBe(0); // once per device
    expect((await b.svc.getWallet()).kimBai).toBe(3);
  });

  test("is idempotent across calls and overlapping calls", async () => {
    const { svc, progress } = setup();
    const duels = [duel("d1", "settled", run(3))];
    const [a, b] = await Promise.all([svc.claimSettledDuels(duels), svc.claimSettledDuels(duels)]);
    expect(a + b).toBe(3);
    expect(await svc.claimSettledDuels(duels)).toBe(0);
    expect((await progress.listEvents()).filter((e) => e.type === "duel_settled")).toHaveLength(1);
    expect((await svc.getWallet()).kimBai).toBe(3);
  });
});

describe("claimGachaPulls", () => {
  const pull = (id: string, over: Partial<GachaPull> = {}): GachaPull => ({
    id, theme: "legendes_sombres", count: 1, cost: 40, createdAt: "2026-10-24T08:00:00.000Z", claimed: false,
    items: [{ itemId: "acc_giao_tre", rarity: "common", duplicate: false, refund: 0 }], ...over,
  });

  test("appends one synced gacha_pulled per new pull, from the server result, and credits the wallet", async () => {
    const { svc, progress, outbox, appended } = setup();
    await svc.demoGrant(100, 0);
    const added = await svc.claimGachaPulls([
      pull("p1"),
      pull("p2", { count: 10, cost: 360, items: [{ itemId: "hat_mu_chien", rarity: "rare", duplicate: true, refund: 20 }] }),
    ]);
    expect(added.map((p) => p.id)).toEqual(["p1", "p2"]);
    const events = (await progress.listEvents()).filter((e) => e.type === "gacha_pulled");
    expect(events.map((e) => [e.refId, e.xp])).toEqual([["p1", 0], ["p2", 0]]);
    expect(events[0]?.payload).toEqual({ theme: "legendes_sombres", cost: 40, items: [{ itemId: "acc_giao_tre", rarity: "common", duplicate: false, refund: 0 }] });
    expect(await outbox.size()).toBe(2);
    expect(appended.length).toBe(1);
    const w = await svc.getWallet();
    expect(w.coins).toBe(100 - 40 - 360 + 20);
    expect(w.inventory).toContain("acc_giao_tre");
  });

  test("is idempotent across calls and overlapping calls; a pull already claimed elsewhere is mirrored once", async () => {
    const { svc, progress } = setup();
    const [a, b] = await Promise.all([svc.claimGachaPulls([pull("p1", { claimed: true })]), svc.claimGachaPulls([pull("p1", { claimed: true })])]);
    expect(a.length + b.length).toBe(1);
    expect(await svc.claimGachaPulls([pull("p1")])).toEqual([]);
    expect((await progress.listEvents()).filter((e) => e.type === "gacha_pulled")).toHaveLength(1);
  });

  test("nothing to claim appends nothing and does not notify", async () => {
    const { svc, appended } = setup();
    expect(await svc.claimGachaPulls([])).toEqual([]);
    expect(await svc.claimGachaPulls([pull("", {}), pull("p9", { items: [] })])).toEqual([]);
    expect(appended.length).toBe(0);
  });
});

test("demoGrant appends a local-only demo_grant event and credits the wallet", async () => {
  const { svc, progress, outbox } = setup();
  const w = await svc.demoGrant(500, 20);
  expect(w.coins).toBe(500);
  expect(w.kimBai).toBe(20);
  expect((await progress.listEvents()).map((e) => e.type)).toEqual(["demo_grant"]);
  expect(await outbox.size()).toBe(0);
  const same = await svc.demoGrant(-1, 2.5);
  expect(same.coins).toBe(500);
  expect((await progress.listEvents())).toHaveLength(1);
});

test("the daily bonus opens once per Paris day, is synced and never gives XP", async () => {
  const { svc, progress, outbox, appended, setNow } = setup("2026-10-10T08:00:00.000Z");
  const [a, b] = await Promise.all([svc.claimDailyBonus(), svc.claimDailyBonus()]);
  expect(a).toMatchObject({ ok: true, day: 1, coins: 10 });
  expect(b).toMatchObject({ ok: false, coins: 0 });
  expect(a.wallet.coins).toBe(10);
  const events = await progress.listEvents();
  expect(events.map((e) => [e.type, e.refId, e.xp, e.payload])).toEqual([["daily_bonus_claimed", "2026-10-10", 0, { day: 1, coins: 10 }]]);
  expect(await outbox.size()).toBe(1);
  expect(appended.length).toBe(1);
  expect((await svc.getSnapshot()).xpTotal).toBe(0);
  // 23:30 UTC on the 10th is already the 11th in Paris: day 2 of the run
  setNow("2026-10-10T23:30:00.000Z");
  expect(await svc.claimDailyBonus()).toMatchObject({ ok: true, day: 2, coins: 10 });
});
