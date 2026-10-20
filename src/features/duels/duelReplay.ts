import type { Duel, DuelRun } from "@/domain/types";
import { outcomeOf } from "@/features/duels/duelsView";
import { DUEL, round1Blow, round2Blow, type DuelBlow } from "@/services/duel";

export type ReplayStep = {
  round: 1 | 2;
  attacker: "me" | "them";
  kind: "hit" | "critical" | "miss";
  damage: number;
  /** HP left after this blow, floored at 0 (K.-O.). */
  hpMe: number;
  hpThem: number;
};

/**
 * The replayed fight: question by question, the challenger first (Q1 of each, then Q2…), round 1 then round 2.
 * A missing run (forfeit) contributes no blow, so only the present player attacks. Every blow plays even after a
 * K.-O.: the winner is decided on damage, the HP bar only stops at 0.
 */
export function duelReplay(mine: DuelRun | null, theirs: DuelRun | null, meFirst: boolean): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let hpMe: number = DUEL.hp;
  let hpThem: number = DUEL.hp;
  const order: ("me" | "them")[] = meFirst ? ["me", "them"] : ["them", "me"];
  const runOf = (who: "me" | "them") => (who === "me" ? mine : theirs);

  const play = (round: 1 | 2, count: number, blowAt: (run: DuelRun, i: number) => DuelBlow | null) => {
    for (let i = 0; i < count; i++) {
      for (const attacker of order) {
        const run = runOf(attacker);
        const blow = run ? blowAt(run, i) : null;
        if (!blow) continue;
        if (attacker === "me") hpThem = Math.max(0, hpThem - blow.damage);
        else hpMe = Math.max(0, hpMe - blow.damage);
        steps.push({ round, attacker, ...blow, hpMe, hpThem });
      }
    }
  };

  const count = (pick: (r: DuelRun) => number) => Math.max(mine ? pick(mine) : 0, theirs ? pick(theirs) : 0);
  play(1, count((r) => r.round1.length), (r, i) => {
    const a = r.round1[i];
    return a ? round1Blow(a) : null;
  });
  play(2, count((r) => r.round2.length), (r, i) => {
    const a = r.round2[i];
    return a ? round2Blow(a) : null;
  });
  return steps;
}

export type ReplayStats = { damage: number; criticals: number; timeMs: number };

/** What the bilan shows for one side: the server's totals and the number of critical blows. */
export function replayStats(run: DuelRun | null): ReplayStats | null {
  if (!run) return null;
  const criticals = run.round1.filter((a) => round1Blow(a).kind === "critical").length;
  return { damage: run.damage, criticals, timeMs: run.timeMs };
}

export type DuelVerdict = "win" | "loss" | "draw" | "forfeitWin" | "forfeitLoss" | "cancelled";

/** How a finished duel ended for me, forfeits told apart (I was absent, or they were). */
export function verdictOf(duel: Duel, myId: string): DuelVerdict {
  if (duel.status === "cancelled") return "cancelled";
  if (duel.myRun === null) return "forfeitLoss";
  if (duel.theirRun === null) return "forfeitWin";
  const o = outcomeOf(duel, myId === "" ? undefined : myId);
  return o === "win" || o === "loss" ? o : "draw";
}
