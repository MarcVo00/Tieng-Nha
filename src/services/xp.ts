export const XP = {
  lessonFirst: 10, lessonPerfectBonus: 5, lessonReplay: 3,
  reviewPerWord: 2, reviewMaxPerSession: 40,
  dialogueFirst: 15, dialogueReplay: 3,
  dailyCap: 200,
} as const;

export function lessonXp({ firstTime, perfect }: { firstTime: boolean; perfect: boolean }): number {
  if (!firstTime) return XP.lessonReplay;
  return XP.lessonFirst + (perfect ? XP.lessonPerfectBonus : 0);
}
export function dialogueXp({ firstTime }: { firstTime: boolean }): number {
  return firstTime ? XP.dialogueFirst : XP.dialogueReplay;
}
export function reviewXp(correctCount: number): number {
  return Math.min(Math.max(0, correctCount) * XP.reviewPerWord, XP.reviewMaxPerSession);
}
export function examXpDelta(score: number, previousBest: number | null): number {
  return Math.max(0, score - (previousBest ?? 0));
}
