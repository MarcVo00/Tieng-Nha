import type { FC } from "react";
import type { z } from "zod";
import type { Capabilities, Exercise, VocabId, VocabItem } from "@/domain/types";
import type { SpeechRecognizer, SpeechSynthesizer, VoiceRecorder } from "@/ports";

export const SLOW_VOICE_RATE = 0.6;

export type ExerciseServices = { tts: SpeechSynthesizer; stt: SpeechRecognizer; recorder: VoiceRecorder };
export type GradeContext = { vocabIndex: ReadonlyMap<VocabId, VocabItem> };

export type GradeResult = {
  correct: boolean;
  score: number; // 0..1
  expected: string; // correct answer as displayable Vietnamese text
  vocabIds: VocabId[]; // words whose Leitner state this answer updates
  selfAssessed?: boolean; // speak via recorder fallback
  skipped?: boolean; // speak with mic denied: neither right nor wrong
  detail?: unknown; // plugin-specific (e.g. syllable diff for speak)
};

export type ExerciseProps<E extends Exercise> = {
  exercise: E;
  disabled: boolean; // true after the answer was submitted
  onAnswer: (answer: unknown) => void;
  services: ExerciseServices;
  capabilities: Capabilities;
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  voiceRate: number; // 1 normal, 0.6 slow
  seed: number; // deterministic shuffling of choices
  onCapabilityLost?: (c: "stt" | "recorder") => void; // e.g. microphone permission denied at runtime
};

export type ExercisePlugin<E extends Exercise = Exercise> = {
  type: E["type"];
  schema: z.ZodType<E>;
  Component: FC<ExerciseProps<E>>;
  grade(exercise: E, answer: unknown, ctx: GradeContext): GradeResult;
  /** Optional extra content rendered inside the feedback sheet (e.g. syllable diff for speak). */
  Feedback?: FC<{ exercise: E; result: GradeResult }>;
};
