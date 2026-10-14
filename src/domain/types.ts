import type { z } from "zod";
import type {
  VocabItemSchema, ExerciseSchema, ListenChooseSchema, TranslateChooseSchema, TonePickSchema, WordOrderSchema,
  SpeakSchema, LessonSchema, TurnSchema, NpcTurnSchema, UserTurnSchema, DialogueSchema, ExamSectionSchema,
  ExamQuestionSchema, BadgeRuleSchema, BadgeDefSchema, TreeNodeSchema, TreeFileSchema, BossSchema,
} from "@/content/schema";

export type { Tone } from "@/domain/tones";
export type VocabId = string;
export type LessonId = string;
export type DialogueId = string;

export type VocabItem = z.infer<typeof VocabItemSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type ExerciseType = Exercise["type"];
export type ListenChoose = z.infer<typeof ListenChooseSchema>;
export type TranslateChoose = z.infer<typeof TranslateChooseSchema>;
export type TonePick = z.infer<typeof TonePickSchema>;
export type WordOrder = z.infer<typeof WordOrderSchema>;
export type Speak = z.infer<typeof SpeakSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonSummary = Pick<Lesson, "id" | "title" | "description" | "emoji" | "dialogueId"> & { order: number };
export type Turn = z.infer<typeof TurnSchema>;
export type NpcTurn = z.infer<typeof NpcTurnSchema>;
export type UserTurn = z.infer<typeof UserTurnSchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type ExamSection = z.infer<typeof ExamSectionSchema>;
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;
export type BadgeRule = z.infer<typeof BadgeRuleSchema>;
export type BadgeDef = z.infer<typeof BadgeDefSchema>;

export type AppEventType =
  | "lesson_completed"
  | "dialogue_completed"
  | "review_session_completed"
  | "exam_finished"
  | "badge_unlocked";

/** Payload shapes by event type (stored as JSON). */
export type EventPayload = {
  lesson_completed: { mistakes: number; durationMs: number; perfect: boolean };
  dialogue_completed: { durationMs: number };
  review_session_completed: { correctCount: number; total: number };
  exam_finished: { score: number; attemptId: string; noSpeaking: boolean };
  badge_unlocked: Record<string, never>;
};

export type AppEvent = {
  clientId: string; // uuid v4, idempotency key
  schemaVersion: 1;
  type: AppEventType;
  refId: string;
  xp: number;
  payload: Record<string, unknown>;
  createdAt: string; // ISO 8601 UTC
};
export type NewEvent = Omit<AppEvent, "clientId" | "createdAt" | "schemaVersion">;

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type VocabProgress = {
  vocabId: VocabId;
  box: LeitnerBox;
  dueAt: string; // ISO
  correct: number;
  wrong: number;
  lastSeenAt: string; // ISO
};

export type Capabilities = { tts: boolean; stt: boolean; recorder: boolean };
export type ThemePref = "system" | "light" | "dark";
export const VOICE_IDS = ["south-f", "south-m", "north-f", "north-m", "device"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];
export type Settings = {
  theme: ThemePref;
  voiceRate: "normal" | "slow";
  voice: VoiceId; // which accent/voice pack speaks; "device" = browser speechSynthesis
  capabilities: Capabilities | null; // null = device test not done yet
  onboardingDone: boolean;
};

export type Session = { userId: string; email: string };

export type LeaderboardRow = {
  userId: string;
  pseudo: string;
  avatarEmoji: string;
  xp: number; // xp_week or xp_total depending on period
  streak: number;
  lessonsDone: number;
  isMe: boolean;
};

export type PublicProfile = {
  userId: string;
  pseudo: string;
  avatarEmoji: string;
  xpTotal: number;
  xpWeek: number;
  streak: number;
  lessonsDone: LessonId[];
  dialoguesDone: DialogueId[];
  badges: string[];
  examBest: number | null;
};

export type ConversationEntry = { turnId: string; speaker: "npc" | "user"; vi: string; fr: string };
export type ConversationState = {
  dialogueId: DialogueId;
  history: ConversationEntry[];
  currentTurnId: string | null; // null = finished
  awaitingUser: boolean; // true when currentTurnId is a user turn
  misunderstood: boolean; // last speech input matched no option
  finished: boolean;
};

/** Local projection of the event log (services/progress.ts). */
export type ProgressSnapshot = {
  xpTotal: number;
  xpWeek: number;
  xpToday: number;
  streak: number;
  lessonsDone: LessonId[];
  perfectLessons: LessonId[];
  dialoguesDone: DialogueId[];
  vocabReviewed: number;
  examBest: number | null;
  badges: string[];
  activeDays: string[]; // YYYY-MM-DD, Europe/Paris, sorted asc
};
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type Tree = z.infer<typeof TreeFileSchema>;
export type Boss = z.infer<typeof BossSchema>;
