import { createRng, shuffle, pickN, seedFromString } from "@/services/random";

test("rng is deterministic per seed", () => {
  const a = createRng(42),
    b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test("rng values are in [0,1)", () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
test("shuffle is a permutation and does not mutate input", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, createRng(7));
  expect([...out].sort()).toEqual(input);
  expect(input).toEqual([1, 2, 3, 4, 5, 6]);
});
test("pickN returns n distinct items", () => {
  expect(new Set(pickN([1, 2, 3, 4, 5], 3, createRng(3))).size).toBe(3);
});
test("seedFromString is stable", () => {
  expect(seedFromString("l05_e01")).toBe(seedFromString("l05_e01"));
  expect(seedFromString("a")).not.toBe(seedFromString("b"));
});
