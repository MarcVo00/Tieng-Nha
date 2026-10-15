import { computeStreak, streakAtDay } from "@/services/streak";
test("no activity → 0", () => expect(computeStreak([], "2026-10-10")).toBe(0));
test("active today only → 1", () => expect(computeStreak(["2026-10-10"], "2026-10-10")).toBe(1));
test("active until yesterday keeps the streak", () =>
  expect(computeStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2));
test("gap of a full day breaks it", () => expect(computeStreak(["2026-10-07", "2026-10-08"], "2026-10-10")).toBe(0));
test("counts consecutive days ending today, ignoring older runs", () =>
  expect(computeStreak(["2026-10-01", "2026-10-02", "2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3));
test("duplicates and unsorted input are tolerated", () =>
  expect(computeStreak(["2026-10-10", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(2));

describe("streakAtDay", () => {
  test("no activity gives 0", () => expect(streakAtDay(0, null, 2, "2026-10-10")).toBe(0));
  test("active today or yesterday keeps the streak", () => {
    expect(streakAtDay(3, "2026-10-10", 0, "2026-10-10")).toBe(3);
    expect(streakAtDay(3, "2026-10-09", 0, "2026-10-10")).toBe(3);
  });
  test("missed days covered by the freezes left keep it alive", () => {
    expect(streakAtDay(3, "2026-10-08", 1, "2026-10-10")).toBe(3);
    expect(streakAtDay(3, "2026-10-08", 0, "2026-10-10")).toBe(0);
    expect(streakAtDay(3, "2026-10-07", 1, "2026-10-10")).toBe(0);
  });
});
