import { grade } from "./grade";
const ex = { id: "e", type: "listen_choose" as const, vocabId: "v_ly", choices: ["v_ly", "v_da", "v_ca_phe", "v_sua"] };
const ctx = { vocabIndex: new Map([["v_ly", { id: "v_ly", vi: "ly", fr: "verre", dialect: "south" as const }]]) };
test("correct", () => expect(grade(ex, { vocabId: "v_ly" }, ctx)).toMatchObject({ correct: true, score: 1, expected: "ly", vocabIds: ["v_ly"] }));
test("wrong", () => expect(grade(ex, { vocabId: "v_da" }, ctx)).toMatchObject({ correct: false, score: 0 }));
test("malformed answer is wrong, never throws", () => expect(grade(ex, 42, ctx).correct).toBe(false));
