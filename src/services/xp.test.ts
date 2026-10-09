import { lessonXp, dialogueXp, reviewXp, examXpDelta } from "@/services/xp";
test("lesson xp", () => {
  expect(lessonXp({ firstTime: true, perfect: false })).toBe(10);
  expect(lessonXp({ firstTime: true, perfect: true })).toBe(15);
  expect(lessonXp({ firstTime: false, perfect: true })).toBe(3);
});
test("dialogue xp", () => {
  expect(dialogueXp({ firstTime: true })).toBe(15);
  expect(dialogueXp({ firstTime: false })).toBe(3);
});
test("review xp is 2 per word capped at 40", () => {
  expect(reviewXp(0)).toBe(0);
  expect(reviewXp(7)).toBe(14);
  expect(reviewXp(30)).toBe(40);
});
test("exam xp is the improvement over the best score", () => {
  expect(examXpDelta(72, null)).toBe(72);
  expect(examXpDelta(80, 72)).toBe(8);
  expect(examXpDelta(60, 72)).toBe(0);
});
