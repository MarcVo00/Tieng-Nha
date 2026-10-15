import type { AppEvent } from "@/domain/types";
import { ENERGY, energyAt, waitParts } from "@/services/energy";

const H = 3_600_000;
const T0 = Date.parse("2026-10-14T08:00:00.000Z");
const at = (ms: number) => new Date(T0 + ms).toISOString();
let n = 0;
const ev = (type: AppEvent["type"], ms: number, payload: Record<string, unknown> = {}): AppEvent => ({
  clientId: `e${n++}`, schemaVersion: 1, type, refId: "x", xp: 0, payload, createdAt: at(ms),
});
const start = (kind: "lesson" | "dialogue" | "boss", ms: number) => ev("session_started", ms, { kind });

test("a new player is full", () => {
  expect(energyAt([], at(0))).toEqual({ current: 5, max: 5, nextAt: null });
});

test("starting a lesson, a dialogue or the boss costs 1, 1 and 3", () => {
  expect(energyAt([start("lesson", 0)], at(1)).current).toBe(4);
  expect(energyAt([start("dialogue", 0)], at(1)).current).toBe(4);
  expect(energyAt([start("boss", 0)], at(1)).current).toBe(2);
});

test("energy never goes below 0 and other events are ignored", () => {
  const events = [start("boss", 0), start("boss", 1), ev("lesson_completed", 2), ev("badge_unlocked", 3)];
  expect(energyAt(events, at(4)).current).toBe(0);
});

test("+1 every 3 hours from the moment it dropped below the maximum, capped at 5", () => {
  const events = [start("lesson", 0), start("lesson", 1 * H)]; // 5 → 4 at T0 (timer starts), → 3 at T0+1h
  expect(energyAt(events, at(2 * H))).toEqual({ current: 3, max: 5, nextAt: at(3 * H) });
  expect(energyAt(events, at(3 * H)).current).toBe(4); // first refill at T0+3h
  expect(energyAt(events, at(6 * H))).toEqual({ current: 5, max: 5, nextAt: null });
  expect(energyAt(events, at(50 * H)).current).toBe(5);
});

test("a finished review session gives +1, never above the maximum", () => {
  expect(energyAt([start("boss", 0), ev("review_session_completed", 1)], at(2)).current).toBe(3);
  expect(energyAt([ev("review_session_completed", 0)], at(1)).current).toBe(5);
});

test("when a gain refills to the maximum the refill timer stops, and restarts at the next spend", () => {
  const events = [start("lesson", 0), ev("review_session_completed", 1 * H), start("lesson", 2 * H)];
  // full again at T0+1h, then 4 at T0+2h: the next +1 is 3h after T0+2h
  expect(energyAt(events, at(2 * H + 1))).toEqual({ current: 4, max: 5, nextAt: at(5 * H) });
});

test("events are replayed in time order whatever the input order", () => {
  const events = [start("lesson", 1 * H), start("lesson", 0)];
  expect(energyAt(events, at(2 * H)).current).toBe(3);
});

test("waitParts rounds up to the minute and never goes negative", () => {
  expect(waitParts(at(0), at(2 * H + 13 * 60_000 + 1))).toEqual({ hours: 2, minutes: 14 });
  expect(waitParts(at(0), at(59_000))).toEqual({ hours: 0, minutes: 1 });
  expect(waitParts(at(10), at(0))).toEqual({ hours: 0, minutes: 0 });
  expect(ENERGY.max).toBe(5);
});

test("an event dated in the future (clock moved back) is treated as happening now", () => {
  expect(energyAt([start("lesson", 2 * H)], at(0))).toEqual({ current: 4, max: 5, nextAt: at(3 * H) });
});

test("a bought refill restores the maximum and the timer stops", () => {
  const events = [start("boss", 0), start("boss", 1)];
  expect(energyAt(events, at(2 * H), [at(H)])).toEqual({ current: 5, max: 5, nextAt: null });
});

test("spending after a refill restarts the timer from that spend", () => {
  const events = [start("boss", 0), start("lesson", 2 * H)];
  const e = energyAt(events, at(2 * H + 1), [at(H)]);
  expect(e.current).toBe(4);
  expect(e.nextAt).toBe(at(5 * H));
});
