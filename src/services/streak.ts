import { addDays, daysBetween } from "@/services/time";

export function computeStreak(activeDays: readonly string[], today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Current streak at `today` from the wallet replay's state: alive while the days missed since the last active day
 * are covered by the freezes left (same rule as the leaderboard view: last_active_day >= today - 1 - freezes).
 */
export function streakAtDay(streak: number, lastActiveDay: string | null, freezes: number, today: string): number {
  if (lastActiveDay === null) return 0;
  const missed = daysBetween(lastActiveDay, today) - 1;
  return missed <= freezes ? streak : 0;
}
