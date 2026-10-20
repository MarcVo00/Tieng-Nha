import type { Duel, DuelRun } from "@/domain/types";
import { outcomeOf } from "@/features/duels/duelsView";
import { DUEL, round1Blow, round2Blow, type DuelBlow } from "@/services/duel";
import { duration } from "@/ui/motion";
import { blowTiming, missTiming, type Tempo } from "@/ui/fight";

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

/** The longest a replay may last (seconds), banners and finale included. */
export const REPLAY_BUDGET = 9;

export type MissCount = { attacker: "me" | "them"; count: number };
type Timed = { start: number; length: number };
export type ReplayBeat =
  | ({ type: "banner"; round: 1 | 2 } & Timed)
  /** A landed blow; `ko` on the one that takes a player's HP to 0 first. `impact` is the contact, from `start`. */
  | ({ type: "blow"; step: ReplayStep; ko: boolean; tempo: Tempo; impact: number } & Timed)
  /** Consecutive misses in one beat, counted per attacker (« Raté ×3 »). */
  | ({ type: "misses"; misses: MissCount[]; tempo: Tempo; impact: number } & Timed)
  /** The blows after the K.-O. summed up in one beat, when playing them would overrun the budget. */
  | ({ type: "flurry"; steps: ReplayStep[]; impact: number } & Timed)
  | ({ type: "finale" } & Timed);

type Draft =
  | { type: "banner"; round: 1 | 2 }
  | { type: "blow"; step: ReplayStep; ko: boolean; tempo: Tempo }
  | { type: "misses"; misses: MissCount[]; tempo: Tempo }
  | { type: "flurry"; steps: ReplayStep[] }
  | { type: "finale" };

const timingOf = (d: Draft): { length: number; impact: number } => {
  switch (d.type) {
    case "banner":
    case "finale":
      return { length: duration.celebrate, impact: 0 };
    case "flurry":
      return { length: duration.celebrate, impact: duration.base };
    case "misses":
      return missTiming(d.tempo);
    case "blow":
      return blowTiming(d.step.kind === "critical" ? "crit" : "hit", { ko: d.ko, tempo: d.tempo });
  }
};

/** The fastest the blows after the K.-O. play: twice the normal tempo. */
const AFTER_KO_TEMPO = 2;
const SAFETY = 0.06;

/**
 * When each beat of the replay plays (seconds). One beat per landed blow, consecutive misses grouped, a banner per
 * round, then the finale. The next beat starts when the defender's recoil ends, during the attacker's settle.
 * Budget: the blows after the K.-O. run at least twice as fast (summed up in one beat if even that overruns); a fight
 * that would still last more than `REPLAY_BUDGET` plays its other blows at one quicker tempo, the same for all, so the
 * exchange keeps its rhythm. The K.-O. blow always keeps its full weight.
 */
export function replaySchedule(steps: readonly ReplayStep[]): { beats: ReplayBeat[]; total: number } {
  if (steps.length === 0) return { beats: [], total: 0 };
  const drafts: Draft[] = [];
  const afterKo = new Set<Draft>();
  let round: 1 | 2 | null = null;
  let knockedOut = false;
  for (const step of steps) {
    if (step.round !== round) {
      round = step.round;
      drafts.push({ type: "banner", round });
    }
    if (step.kind === "miss") {
      const last = drafts.at(-1);
      if (last?.type === "misses") {
        const mine = last.misses.find((m) => m.attacker === step.attacker);
        if (mine) mine.count += 1;
        else last.misses.push({ attacker: step.attacker, count: 1 });
      } else {
        const d: Draft = { type: "misses", misses: [{ attacker: step.attacker, count: 1 }], tempo: 1 };
        if (knockedOut) afterKo.add(d);
        drafts.push(d);
      }
      continue;
    }
    const ko: boolean = !knockedOut && (step.hpMe === 0 || step.hpThem === 0);
    const d: Draft = { type: "blow", step, ko, tempo: 1 };
    if (knockedOut) afterKo.add(d);
    knockedOut ||= ko;
    drafts.push(d);
  }
  drafts.push({ type: "finale" });

  const lengthOf = (d: Draft) => timingOf(d).length;
  const playable = (d: Draft) => (d.type === "blow" && !d.ko) || d.type === "misses";
  const sum = (ds: Draft[]) => ds.reduce((t, d) => t + lengthOf(d), 0);
  // At tempo 1: the beats that keep their length, the blows before and after the K.-O.
  const split = () => ({
    fixed: sum(drafts.filter((d) => !playable(d))),
    before: sum(drafts.filter((d) => playable(d) && !afterKo.has(d))),
    after: sum(drafts.filter((d) => afterKo.has(d))),
  });
  let { fixed, before, after } = split();
  if (fixed + before + after / AFTER_KO_TEMPO > REPLAY_BUDGET && after > 0) {
    // Sum the blows after the K.-O. up in one beat (with the banner of a round that starts after it).
    const koAt = drafts.findIndex((d) => d.type === "blow" && d.ko);
    const rest = steps.slice(steps.findIndex((s) => s.hpMe === 0 || s.hpThem === 0) + 1);
    drafts.splice(koAt + 1, drafts.length - koAt - 2, { type: "flurry", steps: rest });
    afterKo.clear();
    ({ fixed, before, after } = split());
  }
  // One tempo for the blows before the K.-O., rounded up to the hundredth, with 60 ms of margin (float sums, the verdict's first frame).
  const room = REPLAY_BUDGET - SAFETY - fixed - after / AFTER_KO_TEMPO;
  const tempo = before > room ? Math.ceil((before / room) * 100) / 100 : 1;
  for (const d of drafts) {
    if (d.type !== "blow" && d.type !== "misses") continue;
    if (afterKo.has(d)) d.tempo = Math.max(AFTER_KO_TEMPO, tempo);
    else if (playable(d)) d.tempo = tempo;
  }

  let start = 0;
  const beats = drafts.map((d): ReplayBeat => {
    const { length, impact } = timingOf(d);
    const at = start;
    start += length;
    switch (d.type) {
      case "banner":
      case "finale":
        return { ...d, start: at, length };
      default:
        return { ...d, start: at, length, impact };
    }
  });
  return { beats, total: start };
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
