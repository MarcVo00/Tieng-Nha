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
