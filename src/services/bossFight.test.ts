import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { answer, bossMention, buildDeck, fightScore, livesFromScore, maxQuestions, outOfQuestions, startFight, type Fight } from "@/services/bossFight";

const play = (results: boolean[]): Fight => results.reduce((f, ok, i) => answer(f, `q${i}`, ok), startFight(bossFixture));

test("15 HP and 5 lives: at most 19 questions, drawn without repeats, rotating through the sections", () => {
  expect(maxQuestions(bossFixture)).toBe(19);
  const deck = buildDeck(examPoolFixture, bossFixture, 42, true);
  expect(deck).toHaveLength(19);
  expect(new Set(deck.map((q) => q.id)).size).toBe(19);
  expect(deck.slice(0, 4).map((q) => q.section)).toEqual(["listening", "translation", "tones", "speaking"]);
  expect(buildDeck(examPoolFixture, bossFixture, 42, true)).toEqual(deck); // same seed, same deck
});

test("without speech recognition, no speaking question is drawn", () => {
  expect(buildDeck(examPoolFixture, bossFixture, 7, false).some((q) => q.section === "speaking")).toBe(false);
});

test("a right answer hits the boss, a wrong one costs a life, and the fight ends at 0", () => {
  const f = play([true, false, true]);
  expect(f).toMatchObject({ bossHp: 13, lives: 4, status: "fighting" });
  expect(play(Array(15).fill(true)).status).toBe("won");
  expect(play(Array(5).fill(false)).status).toBe("lost");
  const over = play(Array(5).fill(false));
  expect(answer(over, "late", true)).toBe(over); // a finished fight ignores answers
});

test("score: victory by lives left, defeat by damage dealt", () => {
  const win = (wrong: number) => play([...Array(wrong).fill(false), ...Array(15).fill(true)]);
  expect([0, 1, 2, 3, 4].map((w) => fightScore(win(w), bossFixture))).toEqual([100, 92, 85, 78, 70]);
  expect(fightScore(play([...Array(9).fill(true), ...Array(5).fill(false)]), bossFixture)).toBe(36); // round(60 * 9 / 15)
  expect(fightScore(play(Array(5).fill(false)), bossFixture)).toBe(0);
});

test("running out of questions while fighting is a defeat", () => {
  expect(outOfQuestions(play([true])).status).toBe("lost");
  expect(outOfQuestions(play(Array(15).fill(true))).status).toBe("won");
});

test("mention and lives read back from a score", () => {
  expect([100, 92, 85, 78, 70, 36].map(bossMention)).toEqual(["excellent", "excellent", "tres_bien", "bien", "bien", "presque"]);
  expect([100, 92, 85, 78, 70].map((s) => livesFromScore(s, 5))).toEqual([5, 4, 3, 2, 1]);
  expect(livesFromScore(36, 5)).toBeNull();
});
