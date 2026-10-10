import { z } from "zod";
import type { Exercise } from "@/domain/types";
import { TONES } from "@/domain/tones";
import type { GradeContext, GradeResult } from "@/exercises/types";

type TonePick = Extract<Exercise, { type: "tone_pick" }>;
const AnswerSchema = z.object({ tone: z.enum(TONES as [string, ...string[]]) });

export function grade(exercise: TonePick, answer: unknown, ctx: GradeContext): GradeResult {
  void ctx; // a syllable has no vocab to credit; the parameter keeps the plugin signature uniform
  const parsed = AnswerSchema.safeParse(answer);
  const correct = parsed.success && parsed.data.tone === exercise.answerTone;
  return { correct, score: correct ? 1 : 0, expected: exercise.syllable, vocabIds: [] };
}
