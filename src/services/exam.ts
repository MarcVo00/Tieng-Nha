import type { ExamQuestion, ExamSection } from "@/domain/types";
import { createRng, pickN } from "@/services/random";

export const EXAM_LAYOUT = { listening: 10, translation: 8, tones: 6, speaking: 6 } as const;
export const EXAM_PASS = 70;
export type ExamMention = "excellent" | "tres_bien" | "bien" | "presque";
const ORDER: ExamSection[] = ["listening", "translation", "tones", "speaking"];

export function drawExam(pool: readonly ExamQuestion[], seed: number, hasStt: boolean): ExamQuestion[] {
  const rng = createRng(seed);
  const layout: Record<ExamSection, number> = hasStt
    ? { ...EXAM_LAYOUT }
    : { ...EXAM_LAYOUT, listening: EXAM_LAYOUT.listening + EXAM_LAYOUT.speaking, speaking: 0 };
  return ORDER.flatMap((section) => {
    const candidates = pool.filter((q) => q.section === section && !q.exercise.deprecated);
    if (candidates.length < layout[section]) throw new Error("exam_pool_too_small");
    return pickN(candidates, layout[section], rng);
  });
}
export function examScore(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((100 * scores.reduce((a, b) => a + Math.max(0, Math.min(1, b)), 0)) / scores.length);
}
export function examMention(score: number): ExamMention {
  if (score >= 95) return "excellent";
  if (score >= 85) return "tres_bien";
  if (score >= EXAM_PASS) return "bien";
  return "presque";
}
