import { buildReviewSession } from "@/services/reviewBuilder";
import { introduce } from "@/services/leitner";
import { createRng } from "@/services/random";
import { lessonFixture } from "@/test/fixtures/lessonFixture";

const NOW = "2026-10-10T08:00:00.000Z";
const pool = lessonFixture.vocab;
const due = pool.slice(0, 5).map((v) => introduce(v.id, NOW));

test("one exercise per due word, max 20", () => {
  const many = pool.map((v) => introduce(v.id, NOW));
  expect(buildReviewSession(due, pool, createRng(1), { hasStt: true })).toHaveLength(5);
  expect(buildReviewSession(many, pool, createRng(1), { hasStt: true, max: 3 })).toHaveLength(3);
});
test("listen_choose includes the answer among 4 distinct choices", () => {
  const ex = buildReviewSession(due, pool, createRng(2), { hasStt: false });
  for (const e of ex) {
    if (e.type === "listen_choose") {
      expect(e.choices).toContain(e.vocabId);
      expect(new Set(e.choices).size).toBe(4);
    }
  }
});
test("no speak exercise without speech recognition", () => {
  const ex = buildReviewSession(due, pool, createRng(3), { hasStt: false });
  expect(ex.every((e) => e.type !== "speak")).toBe(true);
});
test("translate_choose uses the word's French as prompt and 3 other words as distractors", () => {
  const ex = buildReviewSession(due, pool, createRng(4), { hasStt: false }).filter((e) => e.type === "translate_choose");
  for (const e of ex) {
    if (e.type !== "translate_choose") continue;
    const word = pool.find((v) => v.vi === e.answerVi);
    expect(word).toBeDefined();
    expect(e.promptFr).toBe(word?.fr);
    expect(e.distractorsVi).not.toContain(e.answerVi);
    expect(e.distractorsVi).toHaveLength(3);
  }
});
test("deterministic for the same seed", () => {
  expect(buildReviewSession(due, pool, createRng(9), { hasStt: true })).toEqual(buildReviewSession(due, pool, createRng(9), { hasStt: true }));
});
test("distractors never equal the answer text (synonyms)", () => {
  const withSynonym = [...pool, { id: "v_ly_bis", vi: "ly", fr: "verre (bis)", dialect: "south" as const }];
  for (let seed = 0; seed < 20; seed++) {
    for (const e of buildReviewSession(due, withSynonym, createRng(seed), { hasStt: false })) {
      if (e.type === "translate_choose") expect(e.distractorsVi).not.toContain(e.answerVi);
    }
  }
});
test("words missing from the pool are skipped", () => {
  expect(buildReviewSession([introduce("v_unknown", NOW)], pool, createRng(1), { hasStt: true })).toEqual([]);
});
