import { accuracyOf, createSession, applyResult, currentExercise, progressOf } from "@/services/lessonSession";
import { lessonFixture } from "@/test/fixtures/lessonFixture";

const ok = { correct: true, score: 1, expected: "", vocabIds: [] };
const ko = { correct: false, score: 0, expected: "", vocabIds: [] };
const opts = { hearts: 3, retryWrong: true };
const ex = lessonFixture.exercises.slice(0, 3);

test("all correct → done, no mistakes", () => {
  let s = createSession(ex, opts);
  for (let i = 0; i < 3; i++) s = applyResult(s, opts, ok);
  expect(s).toMatchObject({ status: "done", mistakes: 0, hearts: 3 });
});
test("wrong answer is retried once at the end", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ko);
  expect(s.queue).toHaveLength(4);
  expect(s.queue[3]!.id).toBe(ex[0]!.id);
  s = applyResult(s, opts, ok);
  s = applyResult(s, opts, ok);
  s = applyResult(s, opts, ko); // the retry, wrong again → not re-queued
  expect(s).toMatchObject({ status: "done", mistakes: 2, hearts: 1 });
});
test("three mistakes fail the lesson", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ko);
  s = applyResult(s, opts, ko);
  s = applyResult(s, opts, ko);
  expect(s.status).toBe("failed");
});
test("skipped costs nothing", () => {
  const s = applyResult(createSession(ex, opts), opts, { ...ko, skipped: true });
  expect(s).toMatchObject({ mistakes: 0, hearts: 3, index: 1 });
  expect(s.queue).toHaveLength(3);
});
test("self-assessed ok is counted but is not a mistake; not ok is a mistake", () => {
  let s = applyResult(createSession(ex, opts), opts, { ...ok, selfAssessed: true });
  expect(s).toMatchObject({ selfAssessed: 1, mistakes: 0, hearts: 3 });
  s = applyResult(s, opts, { ...ko, selfAssessed: true });
  expect(s).toMatchObject({ selfAssessed: 2, mistakes: 1, hearts: 2 });
});
test("no hearts mode (review) never fails", () => {
  const o = { hearts: null, retryWrong: false };
  let s = createSession(ex, o);
  for (let i = 0; i < 3; i++) s = applyResult(s, o, ko);
  expect(s).toMatchObject({ status: "done", hearts: null, mistakes: 3 });
});
test("results are recorded and a finished session ignores further results", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ok);
  expect(s.results).toEqual([{ exerciseId: ex[0]!.id, result: ok }]);
  const o = { hearts: null, retryWrong: false };
  let d = createSession(ex.slice(0, 1), o);
  d = applyResult(d, o, ok);
  expect(applyResult(d, o, ko)).toBe(d);
});
test("helpers", () => {
  const s = createSession(ex, opts);
  expect(currentExercise(s)?.id).toBe(ex[0]!.id);
  expect(progressOf(s)).toBe(0);
  expect(currentExercise({ ...s, index: 3 })).toBeUndefined();
});
test("accuracy counts the first presentation of each exercise, ignoring skipped", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ko); // ex0 wrong (first try)
  s = applyResult(s, opts, { ...ko, skipped: true }); // ex1 skipped
  s = applyResult(s, opts, ok); // ex2 right
  s = applyResult(s, opts, ok); // ex0 retried, right (does not count)
  expect(s.status).toBe("done");
  expect(accuracyOf(s)).toBe(0.5);
  expect(accuracyOf(createSession(ex, opts))).toBe(1);
});
