import {
  LessonSchema, ExerciseSchema, DialogueSchema, VocabItemSchema, VocabIdSchema, LessonIdSchema, DialogueIdSchema, PronSchema, BossesFileSchema, TurnSchema,
} from "@/content/schema";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";

test("fixture lesson is valid", () => expect(LessonSchema.safeParse(lessonFixture).success).toBe(true));
test("fixture dialogue is valid", () => expect(DialogueSchema.safeParse(dialogueFixture).success).toBe(true));
test("unknown exercise type is rejected", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "dance" }).success).toBe(false));
test("extra keys are rejected (strict)", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "tone_pick", syllable: "má", answerTone: "sac", extra: 1 }).success).toBe(false));

test("content ids accept the tl_ prefix and reject any other", () => {
  expect(LessonIdSchema.safeParse("tl_l01").success).toBe(true);
  expect(DialogueIdSchema.safeParse("tl_d03").success).toBe(true);
  expect(VocabIdSchema.safeParse("tl_v_salamat").success).toBe(true);
  expect(LessonIdSchema.safeParse("l01").success).toBe(true);
  expect(LessonIdSchema.safeParse("xx_l01").success).toBe(false);
  expect(VocabIdSchema.safeParse("xx_v_salamat").success).toBe(false);
});

test("pron needs dotted syllables with a stressed (upper-case) one per word", () => {
  expect(PronSchema.safeParse("sa·LA·mat").success).toBe(true);
  expect(PronSchema.safeParse("ma·RA·ming sa·LA·mat").success).toBe(true);
  expect(PronSchema.safeParse("po").success).toBe(false); // no stress
  expect(PronSchema.safeParse("PO").success).toBe(true);
  expect(PronSchema.safeParse("salamat").success).toBe(false);
  expect(PronSchema.safeParse("sa.LA.mat").success).toBe(false);
  expect(PronSchema.safeParse("sa·LA·mat po").success).toBe(false); // second word has no stress
  expect(PronSchema.safeParse("saLAmat").success).toBe(false);
});

test("a Tagalog vocab item with a pron is valid; dialect is south or manila", () => {
  const item = { id: "tl_v_salamat", vi: "Salamat", fr: "Merci", dialect: "manila", pron: "sa·LA·mat" };
  expect(VocabItemSchema.safeParse(item).success).toBe(true);
  expect(VocabItemSchema.safeParse({ ...item, pron: "salamat" }).success).toBe(false);
  expect(VocabItemSchema.safeParse({ ...item, dialect: "north" }).success).toBe(false);
  expect(VocabItemSchema.safeParse({ ...item, dialect: "south" }).success).toBe(true);
});

test("pron is accepted on speak exercises, npc turns and user options", () => {
  const speak = { id: "x", type: "speak", vi: "Salamat po", fr: "Merci", vocabIds: [], pron: "sa·LA·mat PO" };
  expect(ExerciseSchema.safeParse(speak).success).toBe(true);
  expect(ExerciseSchema.safeParse({ ...speak, pron: "salamat" }).success).toBe(false);
});

test("a bosses file may be empty (Tagalog has none)", () =>
  expect(BossesFileSchema.safeParse({ contentVersion: 1, bosses: [] }).success).toBe(true));

test("pron is accepted on dialogue lines", () => {
  const npc = { id: "t1", speaker: "npc", vi: "Kumusta", fr: "Salut", next: null, pron: "ku·MUS·ta" };
  const user = { id: "t2", speaker: "user", options: [{ id: "o1", vi: "Mabuti", fr: "Bien", next: null, pron: "ma·BU·ti" }, { id: "o2", vi: "Hindi", fr: "Non", next: null }] };
  expect(TurnSchema.safeParse(npc).success).toBe(true);
  expect(TurnSchema.safeParse({ ...npc, pron: "kumusta" }).success).toBe(false);
  expect(TurnSchema.safeParse(user).success).toBe(true);
});
