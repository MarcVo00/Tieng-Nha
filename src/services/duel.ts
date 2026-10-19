import type { DuelQuestionRef, DuelQuestions, Lesson, Round1Answer, Round2Answer } from "@/domain/types";
import { shuffle } from "@/services/random";

type Rng = () => number;

/** Duel rules. The server (`duel_damage`, `duel_time`, `settle_duel`) applies the same values. */
export const DUEL = {
  hp: 100,
  hit: 10,
  crit: 15,
  oral: 15,
  critUnderMs: 3000,
  minMs: 300,
  round1CapMs: 20000,
  round2CapMs: 30000,
  round1: 8,
  round2: 3,
  minRound1: 4,
  minRound2: 1,
  rewards: { win: 3, draw: 2, loss: 1, forfeitWin: 3, forfeitAbsent: 0 },
} as const;

const ROUND1_TYPES: readonly string[] = ["translate_choose", "listen_choose", "tone_pick"];

/** Round 1: correct = 10, or 15 when 300 <= ms < 3000; over 20 s is a miss. Round 2: correct = 15. */
export function duelDamage(round1: readonly Round1Answer[], round2: readonly Round2Answer[]): number {
  let total = 0;
  for (const a of round1) {
    if (!a.correct || a.ms > DUEL.round1CapMs) continue;
    total += a.ms >= DUEL.minMs && a.ms < DUEL.critUnderMs ? DUEL.crit : DUEL.hit;
  }
  for (const a of round2) if (a.correct) total += DUEL.oral;
  return total;
}

/** Round-1 time: sum of ms, each capped at 20000. */
export function duelTime(round1: readonly Round1Answer[]): number {
  return round1.reduce((sum, a) => sum + Math.min(a.ms, DUEL.round1CapMs), 0);
}

/** Higher damage wins, then lower time; otherwise a draw. */
export function duelOutcome(a: { damage: number; timeMs: number }, b: { damage: number; timeMs: number }): "a" | "b" | "draw" {
  if (a.damage !== b.damage) return a.damage > b.damage ? "a" : "b";
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? "a" : "b";
  return "draw";
}

/** Elapsed milliseconds as the server expects them: a non-negative integer (NaN and negatives become 0). */
export function toDuelMs(elapsed: number): number {
  return Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0;
}

/** Interleaves lessons so that the picked questions mix them (each lesson's pool is shuffled first). */
function mixed(pools: DuelQuestionRef[][], rng: Rng): DuelQuestionRef[] {
  const queues = shuffle(pools.filter((p) => p.length > 0).map((p) => shuffle(p, rng)), rng);
  const out: DuelQuestionRef[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      const ref = q[i];
      if (ref) out.push(ref);
    }
  }
  return out;
}

/** Picks the duel's questions from the lessons both players have done; null when below the minimums. */
export function pickDuelQuestions(common: readonly Lesson[], rng: Rng): DuelQuestions | null {
  const pool = (accept: (type: string) => boolean): DuelQuestionRef[][] =>
    common.map((l) =>
      l.exercises.filter((x) => !x.deprecated && accept(x.type)).map((x) => ({ lessonId: l.id, exerciseId: x.id })),
    );
  const round1 = mixed(pool((t) => ROUND1_TYPES.includes(t)), rng).slice(0, DUEL.round1);
  const round2 = mixed(pool((t) => t === "speak"), rng).slice(0, DUEL.round2);
  if (round1.length < DUEL.minRound1 || round2.length < DUEL.minRound2) return null;
  return { round1, round2 };
}

/** Both players need the first lesson and the first dialogue to duel. */
export function duelPrerequisites(lessonsDone: readonly string[], dialoguesDone: readonly string[]): boolean {
  return lessonsDone.includes("l01") && dialoguesDone.includes("d01");
}

/** Lessons done by both players, in the order of `a`. */
export function commonLessons(a: readonly string[], b: readonly string[]): string[] {
  const other = new Set(b);
  return a.filter((id, i) => other.has(id) && a.indexOf(id) === i);
}
