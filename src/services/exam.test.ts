import { drawExam, examScore, examMention } from "@/services/exam";
import { examPoolFixture } from "@/test/fixtures/examFixture";

test("30 questions with the right layout", () => {
  const q = drawExam(examPoolFixture, 1, true);
  expect(q).toHaveLength(30);
  const count = (s: string) => q.filter((x) => x.section === s).length;
  expect([count("listening"), count("translation"), count("tones"), count("speaking")]).toEqual([10, 8, 6, 6]);
  expect(new Set(q.map((x) => x.id)).size).toBe(30);
});
test("without speech recognition, speaking is replaced by 6 more listening", () => {
  const q = drawExam(examPoolFixture, 1, false);
  expect(q.filter((x) => x.section === "listening")).toHaveLength(16);
  expect(q.filter((x) => x.section === "speaking")).toHaveLength(0);
  expect(q).toHaveLength(30);
});
test("different seeds give different draws, same seed same draw", () => {
  expect(drawExam(examPoolFixture, 1, true)).toEqual(drawExam(examPoolFixture, 1, true));
  expect(drawExam(examPoolFixture, 1, true).map((q) => q.id)).not.toEqual(drawExam(examPoolFixture, 2, true).map((q) => q.id));
});
test("too small pool throws", () => expect(() => drawExam(examPoolFixture.slice(0, 10), 1, true)).toThrow("exam_pool_too_small"));
test("score and mention", () => {
  expect(examScore(Array(30).fill(1))).toBe(100);
  expect(examScore([...Array(21).fill(1), ...Array(9).fill(0)])).toBe(70);
  expect(examScore([0.5, 1])).toBe(75);
  expect(examScore([])).toBe(0);
  expect([examMention(96), examMention(85), examMention(70), examMention(69)]).toEqual(["excellent", "tres_bien", "bien", "presque"]);
});
