import { z } from "zod";
import type { Exercise } from "@/domain/types";
import type { GradeContext, GradeResult } from "@/exercises/types";
import { normalizeVi } from "@/services/pronunciation";

type TranslateChoose = Extract<Exercise, { type: "translate_choose" }>;
const AnswerSchema = z.object({ vi: z.string() });

export function grade(exercise: TranslateChoose, answer: unknown, ctx: GradeContext): GradeResult {
  const parsed = AnswerSchema.safeParse(answer);
  const expectedNorm = normalizeVi(exercise.answerVi);
  const correct = parsed.success && normalizeVi(parsed.data.vi) === expectedNorm;
  const padded = ` ${expectedNorm} `;
  const vocabIds: string[] = [];
  for (const item of ctx.vocabIndex.values()) {
    const word = normalizeVi(item.vi);
    if (word && padded.includes(` ${word} `)) vocabIds.push(item.id);
  }
  return { correct, score: correct ? 1 : 0, expected: exercise.answerVi, vocabIds };
}
