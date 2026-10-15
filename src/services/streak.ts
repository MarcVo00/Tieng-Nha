import { daysBetween } from "@/services/time";

/**
 * Replays the active days with a stock of streak freezes (a freeze bought on day F covers gaps ending on or after F).
 * A gap of g missed days consumes g freezes when available, else the streak restarts at 1. The current value is
 * alive if the last active day is today or yesterday, or if the freezes left still cover the days missed since.
 */
export function computeStreak(activeDays: readonly string[], today: string, freezeDays: readonly string[] = []): number {
  const days = [...new Set(activeDays)].filter((d) => d <= today).sort();
  const last = days[days.length - 1];
  if (last === undefined) return 0;
  const bought = [...freezeDays].sort();
  const boughtBy = (day: string) => bought.filter((f) => f <= day).length;
  let consumed = 0;
  let streak = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (prev === null) streak = 1;
    else {
      const missed = daysBetween(prev, d) - 1;
      if (missed === 0) streak += 1;
      else if (missed <= boughtBy(d) - consumed) {
        consumed += missed;
        streak += 1;
      } else streak = 1;
    }
    prev = d;
  }
  const missedSince = daysBetween(last, today) - 1;
  if (missedSince <= 0) return streak;
  return missedSince <= boughtBy(today) - consumed ? streak : 0;
}
