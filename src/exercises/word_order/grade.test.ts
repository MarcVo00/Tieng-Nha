import { grade } from "./grade";
const ex = { id: "e", type: "word_order" as const, fr: "…", tokensVi: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"], extraTokens: ["đen"] };
test("exact order is correct", () => expect(grade(ex, { tokens: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"] }, { vocabIndex: new Map() }).correct).toBe(true));
test("wrong order", () => expect(grade(ex, { tokens: ["tui", "Cho", "một", "ly", "cà phê", "sữa", "đá"] }, { vocabIndex: new Map() }).correct).toBe(false));
test("extra token makes it wrong", () => expect(grade(ex, { tokens: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá", "đen"] }, { vocabIndex: new Map() }).correct).toBe(false));
test("expected is the sentence", () => expect(grade(ex, { tokens: [] }, { vocabIndex: new Map() }).expected).toBe("Cho tui một ly cà phê sữa đá"));
test("case and punctuation are ignored", () => expect(grade(ex, { tokens: ["cho", "tui", "một", "ly", "cà phê", "sữa", "đá."] }, { vocabIndex: new Map() }).correct).toBe(true));
test("vocabIds are the vocab found in the sentence", () => {
  const vocabIndex = new Map([["v_ca", { id: "v_ca", vi: "cà phê", fr: "café", dialect: "south" as const }]]);
  expect(grade(ex, { tokens: [] }, { vocabIndex }).vocabIds).toEqual(["v_ca"]);
});
test("malformed answer is wrong, never throws", () => expect(grade(ex, undefined, { vocabIndex: new Map() }).correct).toBe(false));
