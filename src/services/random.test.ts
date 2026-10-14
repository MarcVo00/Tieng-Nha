import { createRng, shuffle, shuffleWithinGroups, pickN, seedFromString } from "@/services/random";

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

test("shuffleWithinGroups keeps the groups in order and only mixes items inside each group", () => {
  const items = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "c1", "c2", "c3", "c4"];
  const group = (s: string) => s[0] ?? "";
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const out = shuffleWithinGroups(items, group, createRng(seed));
    expect([...out].sort()).toEqual([...items].sort());
    expect(out.map(group).join("")).toBe("aaaabbbcccc");
    seen.add(out.join(","));
  }
  expect(seen.size).toBeGreaterThan(10); // the order really changes from one run to the next
});

test("shuffleWithinGroups orders groups by their first appearance", () => {
  const out = shuffleWithinGroups(["b1", "a1", "b2", "a2"], (s) => s[0] ?? "", createRng(3));
  expect(out.map((s) => s[0]).join("")).toBe("bbaa");
});
