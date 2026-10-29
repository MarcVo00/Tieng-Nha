import type { AppEvent } from "@/domain/types";
import { ENERGY, energyAt, formatCountdown, msUntilFull, waitParts } from "@/services/energy";

const H = 3_600_000;
// A third of the refill period: energy timelines below are written in thirds (3 * T = one +1).
const T = ENERGY.refillMs / 3;
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

test("+1 every 10 minutes from the moment it dropped below the maximum, capped at 5", () => {
  expect(ENERGY.refillMs).toBe(10 * 60_000);
  const events = [start("lesson", 0), start("lesson", 1 * T)]; // 5 → 4 at T0 (timer starts), → 3 at T0+T
  expect(energyAt(events, at(2 * T))).toEqual({ current: 3, max: 5, nextAt: at(3 * T) });
  expect(energyAt(events, at(3 * T)).current).toBe(4); // first refill one period after T0
  expect(energyAt(events, at(6 * T))).toEqual({ current: 5, max: 5, nextAt: null });
  expect(energyAt(events, at(50 * T)).current).toBe(5);
});

test("a finished review session gives +1, never above the maximum", () => {
  expect(energyAt([start("boss", 0), ev("review_session_completed", 1)], at(2)).current).toBe(3);
  expect(energyAt([ev("review_session_completed", 0)], at(1)).current).toBe(5);
});

test("when a gain refills to the maximum the refill timer stops, and restarts at the next spend", () => {
  const events = [start("lesson", 0), ev("review_session_completed", 1 * T), start("lesson", 2 * T)];
  // full again at T0+T, then 4 at T0+2h: the next +1 is 3h after T0+2h
  expect(energyAt(events, at(2 * T + 1))).toEqual({ current: 4, max: 5, nextAt: at(5 * T) });
});

test("events are replayed in time order whatever the input order", () => {
  const events = [start("lesson", 1 * T), start("lesson", 0)];
  expect(energyAt(events, at(2 * T)).current).toBe(3);
});

test("waitParts rounds up to the minute and never goes negative", () => {
  expect(waitParts(2 * H + 13 * 60_000 + 1)).toEqual({ hours: 2, minutes: 14 });
  expect(waitParts(59_000)).toEqual({ hours: 0, minutes: 1 });
  expect(waitParts(-10)).toEqual({ hours: 0, minutes: 0 });
});

test("formatCountdown pads, rolls past 24 h and clamps negatives", () => {
  expect(formatCountdown(0)).toBe("00:00:00");
  expect(formatCountdown(9_000)).toBe("00:00:09");
  expect(formatCountdown(2 * H + 41 * 60_000 + 7_000)).toBe("02:41:07");
  expect(formatCountdown(27 * H + 5 * 60_000 + 9_000)).toBe("27:05:09");
  expect(formatCountdown(1_001)).toBe("00:00:02");
  expect(formatCountdown(-5_000)).toBe("00:00:00");
  expect(formatCountdown(Number.NaN)).toBe("00:00:00");
});

test("msUntilFull adds one period per further point needed", () => {
  const e = (current: number) => ({ current, max: ENERGY.max, nextAt: "x" });
  expect(msUntilFull(1_000, e(4))).toBe(1_000);
  expect(msUntilFull(1_000, e(3))).toBe(1_000 + ENERGY.refillMs);
  expect(msUntilFull(1_000, e(0))).toBe(1_000 + 4 * ENERGY.refillMs);
  expect(msUntilFull(-1_000, e(4))).toBe(0);
  expect(msUntilFull(5, { current: 5, max: 5, nextAt: null })).toBe(5);
});


test("an event dated in the future (clock moved back) is treated as happening now", () => {
  expect(energyAt([start("lesson", 2 * T)], at(0))).toEqual({ current: 4, max: 5, nextAt: at(3 * T) });
});

test("a bought refill restores the maximum and the timer stops", () => {
  const events = [start("boss", 0), start("boss", 1)];
  expect(energyAt(events, at(2 * T), [at(T)])).toEqual({ current: 5, max: 5, nextAt: null });
});

test("spending after a refill restarts the timer from that spend", () => {
  const events = [start("boss", 0), start("lesson", 2 * T)];
  const e = energyAt(events, at(2 * T + 1), [at(T)]);
  expect(e.current).toBe(4);
  expect(e.nextAt).toBe(at(5 * T));
});

test("demo_grant stays in the local journal like session_started", async () => {
  const { LOCAL_ONLY_EVENT_TYPES } = await import("@/services/energy");
  expect(LOCAL_ONLY_EVENT_TYPES).toContain("demo_grant");
});
