import type { LeitnerBox, VocabId, VocabProgress } from "@/domain/types";
import { addDaysIso } from "@/services/time";

export const INTERVAL_DAYS: Record<LeitnerBox, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export function introduce(vocabId: VocabId, nowIso: string): VocabProgress {
  return { vocabId, box: 1, dueAt: addDaysIso(nowIso, INTERVAL_DAYS[1]), correct: 0, wrong: 0, lastSeenAt: nowIso };
}
export function record(p: VocabProgress, correct: boolean, nowIso: string): VocabProgress {
  const box: LeitnerBox = correct ? (Math.min(p.box + 1, 5) as LeitnerBox) : 1;
  return {
    ...p, box,
    dueAt: addDaysIso(nowIso, INTERVAL_DAYS[box]),
    correct: p.correct + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    lastSeenAt: nowIso,
  };
}
export function isDue(p: VocabProgress, nowIso: string): boolean {
  return p.dueAt <= nowIso;
}
