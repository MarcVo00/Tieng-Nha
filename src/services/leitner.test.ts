import type { VocabProgress } from "@/domain/types";
import { introduce, record, isDue } from "@/services/leitner";
const NOW = "2026-10-10T08:00:00.000Z";

test("introduce puts a word in box 1 due tomorrow", () => {
  expect(introduce("v_ly", NOW)).toEqual({ vocabId: "v_ly", box: 1, dueAt: "2026-10-11T08:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: NOW });
});
test("correct answer promotes and schedules by box interval", () => {
  let p = introduce("v_ly", NOW);
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 2, dueAt: "2026-10-12T08:00:00.000Z", correct: 1 });
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 3, dueAt: "2026-10-14T08:00:00.000Z" });
});
test("box 5 is the ceiling (16 days)", () => {
  let p: VocabProgress = { ...introduce("v_ly", NOW), box: 5 };
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 5, dueAt: "2026-10-26T08:00:00.000Z" });
});
test("wrong answer resets to box 1", () => {
  const p = record({ ...introduce("v_ly", NOW), box: 4 }, false, NOW);
  expect(p).toMatchObject({ box: 1, wrong: 1, dueAt: "2026-10-11T08:00:00.000Z" });
});
test("isDue compares with now", () => {
  const p = introduce("v_ly", NOW);
  expect(isDue(p, NOW)).toBe(false);
  expect(isDue(p, "2026-10-11T08:00:00.000Z")).toBe(true);
});
