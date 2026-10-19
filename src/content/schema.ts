import { z } from "zod";

const isNfc = (s: string) => s === s.normalize("NFC");
export const ViTextSchema = z.string().min(1).refine(isNfc, { message: "Vietnamese text must be Unicode NFC" });

export const ToneSchema = z.enum(["ngang", "huyen", "sac", "hoi", "nga", "nang"]);
export const VocabIdSchema = z.string().regex(/^v_[a-z0-9_]+$/);
export const LessonIdSchema = z.string().regex(/^l\d{2}$/);
export const DialogueIdSchema = z.string().regex(/^d\d{2}$/);
const ExerciseIdSchema = z.string().regex(/^[a-z0-9_]+$/);

export const VocabItemSchema = z
  .object({
    id: VocabIdSchema,
    vi: ViTextSchema,
    fr: z.string().min(1),
    note: z.string().min(1).optional(),
    audio: z.string().min(1).optional(),
    dialect: z.literal("south"),
    deprecated: z.boolean().optional(),
  })
  .strict();

const base = { id: ExerciseIdSchema, deprecated: z.boolean().optional() };

export const ListenChooseSchema = z
  .object({ ...base, type: z.literal("listen_choose"), vocabId: VocabIdSchema, choices: z.array(VocabIdSchema).length(4) })
  .strict();
export const TranslateChooseSchema = z
  .object({
    ...base,
    type: z.literal("translate_choose"),
    promptFr: z.string().min(1),
    answerVi: ViTextSchema,
    distractorsVi: z.array(ViTextSchema).length(3),
  })
  .strict();
export const TonePickSchema = z
  .object({ ...base, type: z.literal("tone_pick"), syllable: ViTextSchema, answerTone: ToneSchema })
  .strict();
export const WordOrderSchema = z
  .object({
    ...base,
    type: z.literal("word_order"),
    fr: z.string().min(1),
    tokensVi: z.array(ViTextSchema).min(2).max(10),
    extraTokens: z.array(ViTextSchema).max(3).optional(),
  })
  .strict();
export const SpeakSchema = z
  .object({ ...base, type: z.literal("speak"), vi: ViTextSchema, fr: z.string().min(1), vocabIds: z.array(VocabIdSchema) })
  .strict();

export const ExerciseSchema = z.discriminatedUnion("type", [
  ListenChooseSchema,
  TranslateChooseSchema,
  TonePickSchema,
  WordOrderSchema,
  SpeakSchema,
]);

export const LessonSchema = z
  .object({
    id: LessonIdSchema,
    contentVersion: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    emoji: z.string().min(1),
    dialogueId: DialogueIdSchema,
    vocab: z.array(VocabItemSchema).min(12).max(18),
    exercises: z.array(ExerciseSchema).min(8).max(12),
  })
  .strict();

const TurnIdSchema = z.string().regex(/^t\d+$/);
export const NpcTurnSchema = z
  .object({ id: TurnIdSchema, speaker: z.literal("npc"), vi: ViTextSchema, fr: z.string().min(1), audio: z.string().optional(), next: TurnIdSchema.nullable() })
  .strict();
export const UserOptionSchema = z
  .object({ id: z.string().regex(/^o\d+$/), vi: ViTextSchema, fr: z.string().min(1), next: TurnIdSchema.nullable() })
  .strict();
export const UserTurnSchema = z
  .object({ id: TurnIdSchema, speaker: z.literal("user"), options: z.array(UserOptionSchema).min(2).max(3) })
  .strict();
export const TurnSchema = z.discriminatedUnion("speaker", [NpcTurnSchema, UserTurnSchema]);

export const DialogueSchema = z
  .object({
    id: DialogueIdSchema,
    contentVersion: z.number().int().min(1),
    title: z.string().min(1),
    scene: z.string().min(1),
    turns: z.array(TurnSchema).min(4).max(8),
  })
  .strict();

export const ExamSectionSchema = z.enum(["listening", "translation", "tones", "speaking"]);
export const ExamQuestionSchema = z
  .object({ id: z.string().regex(/^exam_q\d{3}$/), section: ExamSectionSchema, exercise: ExerciseSchema })
  .strict();
export const ExamPoolSchema = z.object({ contentVersion: z.number().int().min(1), questions: z.array(ExamQuestionSchema) }).strict();

export const TreeNodeSchema = z
  .object({ id: z.string().min(1), kind: z.enum(["lesson", "boss"]), requires: z.array(z.string().min(1)), branch: z.string().min(1) })
  .strict();
export const TreeFileSchema = z.object({ contentVersion: z.number().int().min(1), nodes: z.array(TreeNodeSchema).min(1) }).strict();

export const BossSchema = z
  .object({
    id: z.string().regex(/^boss_[a-z0-9_]+$/),
    name: ViTextSchema,
    title: z.string().min(1),
    legend: z.string().min(1),
    illustration: z.string().min(1),
    hp: z.number().int().min(1).max(50),
    playerLives: z.number().int().min(1).max(10),
    pool: z.literal("exam"),
  })
  .strict();
export const BossesFileSchema = z.object({ contentVersion: z.number().int().min(1), bosses: z.array(BossSchema).min(1) }).strict();

export const BadgeRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lessons_done"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("streak"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("perfect_lesson") }).strict(),
  z.object({ kind: z.literal("perfect_lessons"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("vocab_reviewed"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("dialogues_done"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("exam_score"), gte: z.number().int().min(1).max(100) }).strict(),
]);
export const BadgeDefSchema = z
  .object({ id: z.string().regex(/^[a-z0-9_]+$/), title: z.string().min(1), description: z.string().min(1), icon: z.string().min(1), rule: BadgeRuleSchema, reward: z.string().regex(/^[a-z0-9_]+$/).optional() })
  .strict();
export const BadgesFileSchema = z.object({ badges: z.array(BadgeDefSchema).min(1) }).strict();

export const ShopItemSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    kind: z.enum(["consumable", "cosmetic"]),
    slot: z.enum(["frame", "profile_fx", "hat", "outfit", "accessory", "aura", "character"]).nullable(),
    price: z.number().int().min(1).nullable(),
    theme: z.string().regex(/^[a-z0-9_]+$/).optional(),
    maxStock: z.number().int().min(1).optional(),
  })
  .strict();
export const ShopFileSchema = z.object({ contentVersion: z.number().int().min(1), items: z.array(ShopItemSchema).min(1) }).strict();
