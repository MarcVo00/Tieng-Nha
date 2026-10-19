import type { Duel } from "@/domain/types";
import { DUEL } from "@/services/duel";

export const DONE_LIMIT = 10;

export type Sections = { toPlay: Duel[]; waiting: Duel[]; done: Duel[] };
export type Outcome = "win" | "loss" | "draw" | "forfeit" | "cancelled";

const time = (iso: string): number => Date.parse(iso);

/**
 * Splits my duels into the hub sections. I may be the challenger or the opponent: only `myRun` matters.
 * An open duel past its expiry (stale cache) is neither playable nor pending, so it is left out.
 */
export function splitDuels(duels: readonly Duel[], nowIso: string): Sections {
  const now = time(nowIso);
  const open = duels.filter((d) => d.status === "open" && time(d.expiresAt) > now);
  const newestFirst = (a: Duel, b: Duel) => time(b.createdAt) - time(a.createdAt);
  return {
    toPlay: open.filter((d) => d.myRun === null).sort(newestFirst),
    waiting: open.filter((d) => d.myRun !== null).sort(newestFirst),
    done: duels.filter((d) => d.status !== "open").sort(newestFirst).slice(0, DONE_LIMIT),
  };
}

/** How a finished duel went for me; `myId` may be unknown, the server reward then tells win from loss. */
export function outcomeOf(d: Duel, myId: string | undefined): Outcome {
  if (d.status === "cancelled") return "cancelled";
  if (d.myRun === null) return "forfeit";
  if (d.winner === null) return "draw";
  if (myId !== undefined) return d.winner === myId ? "win" : "loss";
  return (d.myRun.reward ?? 0) >= DUEL.rewards.win ? "win" : "loss";
}

/** The other player's id (I am either side). */
export function otherId(d: Duel, myId: string): string {
  return d.challenger === myId ? d.opponent : d.challenger;
}

/** Whole hours left before expiry, never negative. */
export function hoursLeft(d: Duel, nowIso: string): number {
  return Math.max(0, Math.floor((time(d.expiresAt) - time(nowIso)) / 3_600_000));
}
