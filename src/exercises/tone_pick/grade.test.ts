import { grade } from "./grade";
const ex = { id: "e", type: "tone_pick" as const, syllable: "đá", answerTone: "sac" as const };
test("correct", () => expect(grade(ex, { tone: "sac" }, { vocabIndex: new Map() })).toMatchObject({ correct: true, expected: "đá" }));
test("wrong", () => expect(grade(ex, { tone: "huyen" }, { vocabIndex: new Map() }).correct).toBe(false));
test("malformed answer is wrong, never throws", () => expect(grade(ex, { tone: "bogus" }, { vocabIndex: new Map() }).correct).toBe(false));
