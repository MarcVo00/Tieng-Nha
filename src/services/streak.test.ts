import { computeStreak } from "@/services/streak";
test("no activity → 0", () => expect(computeStreak([], "2026-10-10")).toBe(0));
test("active today only → 1", () => expect(computeStreak(["2026-10-10"], "2026-10-10")).toBe(1));
test("active until yesterday keeps the streak", () =>
  expect(computeStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2));
test("gap of a full day breaks it", () => expect(computeStreak(["2026-10-07", "2026-10-08"], "2026-10-10")).toBe(0));
test("counts consecutive days ending today, ignoring older runs", () =>
  expect(computeStreak(["2026-10-01", "2026-10-02", "2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3));
test("duplicates and unsorted input are tolerated", () =>
  expect(computeStreak(["2026-10-10", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(2));

describe("streak freezes", () => {
  const A = ["2026-10-01", "2026-10-02"];
  test("one freeze bridges one missed day", () =>
    expect(computeStreak([...A, "2026-10-04"], "2026-10-04", ["2026-10-01"])).toBe(3));
  test("two freezes bridge two missed days", () =>
    expect(computeStreak([...A, "2026-10-05"], "2026-10-05", ["2026-10-01", "2026-10-02"])).toBe(3));
  test("three missed days with two freezes reset to 1", () =>
    expect(computeStreak([...A, "2026-10-06"], "2026-10-06", ["2026-10-01", "2026-10-02"])).toBe(1));
  test("a freeze bought after the gap does not count", () =>
    expect(computeStreak([...A, "2026-10-04"], "2026-10-04", ["2026-10-05"])).toBe(1));
  test("freezes are consumed, not reused", () =>
    expect(computeStreak([...A, "2026-10-04", "2026-10-06"], "2026-10-06", ["2026-10-01"])).toBe(1));
  test("a streak kept alive by the stock stays visible", () =>
    expect(computeStreak(A, "2026-10-04", ["2026-10-01"])).toBe(2));
  test("not enough stock for the days missed since gives 0", () =>
    expect(computeStreak(A, "2026-10-05", ["2026-10-01"])).toBe(0));
  test("no freeze, same behaviour as before", () => expect(computeStreak([...A, "2026-10-04"], "2026-10-04")).toBe(1));
});
