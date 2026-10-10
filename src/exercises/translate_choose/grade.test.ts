import { grade } from "./grade";
const ex = { id: "e", type: "translate_choose" as const, promptFr: "L'addition !", answerVi: "Tính tiền!", distractorsVi: ["Ngon quá!", "Cho tui nước.", "Cà phê đen."] };
const ctx = { vocabIndex: new Map() };
test("correct even with different punctuation/case/NFD", () => expect(grade(ex, { vi: "tính tiền".normalize("NFD") }, ctx).correct).toBe(true));
test("wrong", () => expect(grade(ex, { vi: "Ngon quá!" }, ctx)).toMatchObject({ correct: false, expected: "Tính tiền!" }));
test("vocabIds are the words found as whole word sequences in the answer", () => {
  const vocabIndex = new Map([
    ["v_tinh_tien", { id: "v_tinh_tien", vi: "tính tiền", fr: "l'addition", dialect: "south" as const }],
    ["v_tien", { id: "v_tien", vi: "tiền tệ", fr: "monnaie", dialect: "south" as const }],
  ]);
  expect(grade(ex, { vi: "Tính tiền!" }, { vocabIndex }).vocabIds).toEqual(["v_tinh_tien"]);
});
test("malformed answer is wrong, never throws", () => expect(grade(ex, null, ctx).correct).toBe(false));
