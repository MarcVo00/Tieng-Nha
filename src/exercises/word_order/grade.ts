import { z } from "zod";
import type { Exercise } from "@/domain/types";
import type { GradeContext, GradeResult } from "@/exercises/types";
import { normalizeVi } from "@/services/pronunciation";

type WordOrder = Extract<Exercise, { type: "word_order" }>;
const AnswerSchema = z.object({ tokens: z.array(z.string()) });

export function grade(exercise: WordOrder, answer: unknown, ctx: GradeContext): GradeResult {
  const parsed = AnswerSchema.safeParse(answer);
  const expectedNorm = exercise.tokensVi.map(normalizeVi);
  const correct =
    parsed.success &&
    parsed.data.tokens.length === expectedNorm.length &&
    parsed.data.tokens.every((token, i) => normalizeVi(token) === expectedNorm[i]);
  const padded = ` ${expectedNorm.join(" ")} `;
  const vocabIds: string[] = [];
  for (const item of ctx.vocabIndex.values()) {
    const word = normalizeVi(item.vi);
    if (word && padded.includes(` ${word} `)) vocabIds.push(item.id);
  }
  return { correct, score: correct ? 1 : 0, expected: exercise.tokensVi.join(" "), vocabIds };
}
