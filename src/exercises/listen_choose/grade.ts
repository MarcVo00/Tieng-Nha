import { z } from "zod";
import type { Exercise } from "@/domain/types";
import type { GradeContext, GradeResult } from "@/exercises/types";

type ListenChoose = Extract<Exercise, { type: "listen_choose" }>;
const AnswerSchema = z.object({ vocabId: z.string() });

export function grade(exercise: ListenChoose, answer: unknown, ctx: GradeContext): GradeResult {
  const parsed = AnswerSchema.safeParse(answer);
  const correct = parsed.success && parsed.data.vocabId === exercise.vocabId;
  return {
    correct,
    score: correct ? 1 : 0,
    expected: ctx.vocabIndex.get(exercise.vocabId)?.vi ?? exercise.vocabId,
    vocabIds: [exercise.vocabId],
  };
}
