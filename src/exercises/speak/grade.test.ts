import { grade } from "./grade";

const ex = { id: "e", type: "speak" as const, vi: "Cho tui một ly trà đá.", fr: "…", vocabIds: ["v_tra_da"] };
const ctx = { vocabIndex: new Map() };

test("good speech passes", () =>
  expect(grade(ex, { kind: "speech", alternatives: ["cho tui một ly trà đá"] }, ctx)).toMatchObject({
    correct: true,
    score: 1,
    vocabIds: ["v_tra_da"],
    expected: "Cho tui một ly trà đá.",
  }));
test("one wrong tone still passes (0.92)", () => expect(grade(ex, { kind: "speech", alternatives: ["cho tui một ly trà đà"] }, ctx).correct).toBe(true));
test("bad speech fails", () => expect(grade(ex, { kind: "speech", alternatives: ["xin chào"] }, ctx).correct).toBe(false));
test("detail carries the diff and the top alternative when nothing scored", () => {
  const r = grade(ex, { kind: "speech", alternatives: ["xin chào"] }, ctx);
  expect(r.detail).toMatchObject({ heard: "xin chào", diff: expect.any(Array) });
});
test("self-assessed", () => expect(grade(ex, { kind: "self", ok: true }, ctx)).toMatchObject({ correct: true, selfAssessed: true }));
test("self-assessed not ok", () => expect(grade(ex, { kind: "self", ok: false }, ctx)).toMatchObject({ correct: false, score: 0, selfAssessed: true }));
test("skip", () => expect(grade(ex, { kind: "skip" }, ctx)).toMatchObject({ skipped: true, correct: false, score: 0 }));
test("a malformed answer is treated as a skip", () => expect(grade(ex, { nope: 1 }, ctx)).toMatchObject({ skipped: true, correct: false }));
