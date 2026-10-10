import { z } from "zod";
import type { Exercise } from "@/domain/types";
import type { GradeContext, GradeResult } from "@/exercises/types";
import { PASS_THRESHOLD, scorePronunciation, type SyllableDiff } from "@/services/pronunciation";

type Speak = Extract<Exercise, { type: "speak" }>;

export type SpeakAnswer =
  | { kind: "speech"; alternatives: string[] }
  | { kind: "self"; ok: boolean } // recorder fallback, learner self-assessment
  | { kind: "skip" }; // mic denied / no capability at all

export type SpeakDetail = { diff: SyllableDiff[]; heard: string };

const AnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("speech"), alternatives: z.array(z.string()) }),
  z.object({ kind: z.literal("self"), ok: z.boolean() }),
  z.object({ kind: z.literal("skip") }),
]);

export function grade(exercise: Speak, answer: unknown, ctx: GradeContext): GradeResult {
  void ctx; // speak grades against the sentence itself, not the vocab index
  const base = { expected: exercise.vi, vocabIds: exercise.vocabIds };
  const parsed = AnswerSchema.safeParse(answer);
  if (!parsed.success || parsed.data.kind === "skip") return { ...base, correct: false, score: 0, skipped: true };
  const a = parsed.data;
  if (a.kind === "self") return { ...base, correct: a.ok, score: a.ok ? 1 : 0, selfAssessed: true };
  const r = scorePronunciation(exercise.vi, a.alternatives);
  // scorePronunciation reports heard "" when nothing scored: show the top alternative instead.
  const detail: SpeakDetail = { diff: r.diff, heard: r.heard || (a.alternatives[0] ?? "") };
  return { ...base, correct: r.score >= PASS_THRESHOLD, score: r.score, detail };
}
