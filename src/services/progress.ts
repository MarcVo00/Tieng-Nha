import type { AppEvent, AppEventType, ProgressSnapshot } from "@/domain/types";
import { parisDay, startOfParisWeek } from "@/services/time";
import { computeStreak, streakAtDay } from "@/services/streak";
import { XP } from "@/services/xp";

export const STREAK_EVENT_TYPES: readonly AppEventType[] = ["lesson_completed", "dialogue_completed", "review_session_completed"];

/** Streak state replayed by `walletAt` (time-ordered, identical to the server); when given it replaces the day-based streak. */
export type StreakState = { streak: number; lastActiveDay: string | null; freezes: number };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function computeProgress(events: readonly AppEvent[], nowIso: string, streakState?: StreakState): ProgressSnapshot {
  const today = parisDay(nowIso);
  const week = startOfParisWeek(nowIso);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const xpByDay = new Map<string, number>();
  const lessons = new Set<string>(), perfect = new Set<string>(), dialogues = new Set<string>(), badges = new Set<string>(), active = new Set<string>();
  let xpTotal = 0, xpWeek = 0, xpToday = 0, vocabReviewed = 0;
  let examBest: number | null = null;

  for (const e of sorted) {
    const day = parisDay(e.createdAt);
    const used = xpByDay.get(day) ?? 0;
    const credited = Math.max(0, Math.min(e.xp, XP.dailyCap - used));
    xpByDay.set(day, used + credited);
    xpTotal += credited;
    if (startOfParisWeek(e.createdAt) === week) xpWeek += credited;
    if (day === today) xpToday += credited;
    if (STREAK_EVENT_TYPES.includes(e.type)) active.add(day);

    switch (e.type) {
      case "lesson_completed":
        lessons.add(e.refId);
        if (e.payload["perfect"] === true) perfect.add(e.refId);
        break;
      case "dialogue_completed":
        dialogues.add(e.refId);
        break;
      case "review_session_completed":
        vocabReviewed += num(e.payload["correctCount"]);
        break;
      case "exam_finished":
        examBest = Math.max(examBest ?? 0, num(e.payload["score"]));
        break;
      case "badge_unlocked":
        badges.add(e.refId);
        break;
    }
  }
  const activeDays = [...active].sort();
  return {
    xpTotal, xpWeek, xpToday,
    streak: streakState ? streakAtDay(streakState.streak, streakState.lastActiveDay, streakState.freezes, today) : computeStreak(activeDays, today),
    lessonsDone: [...lessons], perfectLessons: [...perfect], dialoguesDone: [...dialogues],
    vocabReviewed, examBest, badges: [...badges], activeDays,
  };
}
