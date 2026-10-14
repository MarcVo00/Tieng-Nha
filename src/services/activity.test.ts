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
