import { computeProgress } from "@/services/progress";
import type { AppEvent } from "@/domain/types";

let n = 0;
const ev = (p: Partial<AppEvent> & Pick<AppEvent, "type" | "refId" | "xp" | "createdAt">): AppEvent => ({
  clientId: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, schemaVersion: 1, payload: {}, ...p,
});
const NOW = "2026-10-10T10:00:00.000Z"; // Saturday, week starts 2026-10-05

test("empty log", () => {
  const s = computeProgress([], NOW);
  expect(s).toMatchObject({ xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone: [], badges: [], examBest: null });
});

test("aggregates lessons, dialogues, reviews, exam and badges", () => {
  const s = computeProgress([
    ev({ type: "lesson_completed", refId: "l01", xp: 15, createdAt: "2026-10-09T09:00:00.000Z", payload: { mistakes: 0, durationMs: 1, perfect: true } }),
    ev({ type: "lesson_completed", refId: "l01", xp: 3, createdAt: "2026-10-10T08:00:00.000Z", payload: { mistakes: 2, durationMs: 1, perfect: false } }),
    ev({ type: "dialogue_completed", refId: "d01", xp: 15, createdAt: "2026-10-10T08:10:00.000Z" }),
    ev({ type: "review_session_completed", refId: "review", xp: 8, createdAt: "2026-10-10T08:20:00.000Z", payload: { correctCount: 4, total: 5 } }),
    ev({ type: "exam_finished", refId: "exam", xp: 72, createdAt: "2026-10-10T08:30:00.000Z", payload: { score: 72, attemptId: "a", noSpeaking: false } }),
    ev({ type: "badge_unlocked", refId: "first_lesson", xp: 0, createdAt: "2026-10-09T09:00:01.000Z" }),
  ], NOW);
  expect(s.xpTotal).toBe(113);
  expect(s.xpToday).toBe(98);
  expect(s.xpWeek).toBe(113);
  expect(s.lessonsDone).toEqual(["l01"]);
  expect(s.perfectLessons).toEqual(["l01"]);
  expect(s.dialoguesDone).toEqual(["d01"]);
  expect(s.vocabReviewed).toBe(4);
  expect(s.examBest).toBe(72);
  expect(s.badges).toEqual(["first_lesson"]);
  expect(s.activeDays).toEqual(["2026-10-09", "2026-10-10"]);
  expect(s.streak).toBe(2);
});

test("xp from previous weeks is not in xpWeek", () => {
  const s = computeProgress([ev({ type: "lesson_completed", refId: "l01", xp: 10, createdAt: "2026-10-04T10:00:00.000Z" })], NOW);
  expect(s.xpTotal).toBe(10);
  expect(s.xpWeek).toBe(0);
});

test("daily cap of 200 xp per Paris day", () => {
  const events = Array.from({ length: 25 }, (_, i) =>
    ev({ type: "lesson_completed", refId: `l${String(i).padStart(2, "0")}`, xp: 10, createdAt: `2026-10-10T0${i % 10}:00:00.000Z` }));
  expect(computeProgress(events, NOW).xpToday).toBe(200);
});

test("badge_unlocked does not count as an active day", () => {
  const s = computeProgress([ev({ type: "badge_unlocked", refId: "x", xp: 0, createdAt: NOW })], NOW);
  expect(s.activeDays).toEqual([]);
});

test("a wallet streak state keeps the streak alive across missed days", () => {
  const events = [
    ev({ type: "lesson_completed", refId: "l01", xp: 10, createdAt: "2026-10-10T10:00:00.000Z" }),
    ev({ type: "lesson_completed", refId: "l02", xp: 10, createdAt: "2026-10-12T10:00:00.000Z" }),
  ];
  expect(computeProgress(events, "2026-10-12T12:00:00.000Z").streak).toBe(1);
  expect(computeProgress(events, "2026-10-14T12:00:00.000Z", { streak: 2, lastActiveDay: "2026-10-12", freezes: 1 }).streak).toBe(2);
  expect(computeProgress(events, "2026-10-14T12:00:00.000Z", { streak: 2, lastActiveDay: "2026-10-12", freezes: 0 }).streak).toBe(0);
});
