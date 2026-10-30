import type { AppEvent } from "@/domain/types";
import { struggleAt } from "@/services/struggle";
import { energyAt } from "@/services/energy";

let n = 0;
const ev = (type: AppEvent["type"], refId: string, minute: number, payload: Record<string, unknown> = {}): AppEvent => ({
  clientId: `e${n++}`, schemaVersion: 1, type, refId, xp: 0, payload,
  createdAt: new Date(Date.UTC(2026, 9, 30, 8, minute)).toISOString(),
});
const start = (m: number, free = false) => ev("session_started", "l01", m, free ? { kind: "lesson", free: true } : { kind: "lesson" });
const failed = (m: number, vocabIds: string[], exerciseIds: string[] = []) => ev("lesson_failed", "l01", m, { vocabIds, exerciseIds });

test("nothing for a lesson never failed", () => {
  expect(struggleAt([], "l01")).toEqual({ failures: 0, missedVocab: [], missedExercises: [], talisman: false });
});

test("counts failures of this lesson only, since its last completion", () => {
  const events = [
    start(0), failed(1, ["v_a"]),
    ev("lesson_completed", "l01", 2), start(3), failed(4, ["v_b"]),
    start(5), failed(6, ["v_c"]),
    ev("lesson_failed", "l02", 7, { vocabIds: ["v_x"], exerciseIds: [] }),
  ];
  expect(struggleAt(events, "l01")).toMatchObject({ failures: 2, missedVocab: ["v_b", "v_c"] });
});

test("words most missed first, ties in first-missed order, at most 5; exercises without duplicates", () => {
  const events = [
    failed(1, ["v_a", "v_b", "v_c"], ["x1", "x2"]),
    failed(2, ["v_c", "v_d", "v_e", "v_f", "v_g"], ["x2", "x3"]),
    failed(3, ["v_c", "v_e"], ["x4"]),
  ];
  expect(struggleAt(events, "l01")).toEqual({
    failures: 3,
    missedVocab: ["v_c", "v_e", "v_a", "v_b", "v_d"],
    missedExercises: ["x1", "x2", "x3", "x4"],
    talisman: false,
  });
});

test("malformed payloads count the failure but no words", () => {
  const events = [ev("lesson_failed", "l01", 1, { vocabIds: "v_a", exerciseIds: [3, "x1"] })];
  expect(struggleAt(events, "l01")).toEqual({ failures: 1, missedVocab: [], missedExercises: ["x1"], talisman: false });
});

test("a training gives a talisman, used up by the next start of the lesson", () => {
  const trained = [start(0), failed(1, ["v_a"]), ev("training_done", "l01", 2)];
  expect(struggleAt(trained, "l01").talisman).toBe(true);
  expect(struggleAt([...trained, ev("session_started", "l02", 3, { kind: "lesson" })], "l01").talisman).toBe(true);
  expect(struggleAt([...trained, start(3, true)], "l01").talisman).toBe(false);
  expect(struggleAt([...trained, ev("lesson_completed", "l01", 3)], "l01").talisman).toBe(false);
});

test("a free start spends no energy", () => {
  const now = new Date(Date.UTC(2026, 9, 30, 8, 5)).toISOString();
  expect(energyAt([start(0, true), start(1, true)], now).current).toBe(5);
  expect(energyAt([start(0, true), start(1)], now).current).toBe(4);
});
