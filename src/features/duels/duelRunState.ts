import type { DuelQuestions, Round1Answer, Round2Answer } from "@/domain/types";
import { DUEL, duelDamage, toDuelMs } from "@/services/duel";

/** An in-progress run, persisted so that a reload cannot buy extra time. */
export type RunRecord = {
  questions: DuelQuestions;
  seed: number;
  round1: Round1Answer[];
  round2: Round2Answer[];
  /** Epoch ms at which the current question was displayed; null between two questions. */
  shownAt: number | null;
};

/** A finished run waiting for the network. */
export type PendingRun = { round1: Round1Answer[]; round2: Round2Answer[] };

export type Position =
  | { round: 1 | 2; index: number; total: number; cap: number }
  | { round: "done" };

export type Verdict = "critical" | "hit" | "miss";

export const runKey = (id: string): string => `tn-duel-run:${id}`;
export const pendingKey = (id: string): string => `tn-duel-pending:${id}`;
export const seenKey = (id: string): string => `tn-duel-seen:${id}`;

export function newRecord(questions: DuelQuestions, seed: number): RunRecord {
  return { questions, seed, round1: [], round2: [], shownAt: null };
}

export function positionOf(rec: RunRecord): Position {
  const n1 = rec.questions.round1.length;
  const n2 = rec.questions.round2.length;
  if (rec.round1.length < n1) return { round: 1, index: rec.round1.length, total: n1, cap: DUEL.round1CapMs };
  if (rec.round2.length < n2) return { round: 2, index: rec.round2.length, total: n2, cap: DUEL.round2CapMs };
  return { round: "done" };
}

/** Records one answer; an answer given after the cap is a miss. `elapsed` is time since display. */
export function recordAnswer(rec: RunRecord, correct: boolean, elapsed: number): RunRecord {
  const pos = positionOf(rec);
  if (pos.round === "done") return rec;
  // A clock moved back gives a negative elapsed time: not a 0 ms answer, a miss at the cap.
  const valid = Number.isFinite(elapsed) && elapsed >= 0;
  const ms = valid ? toDuelMs(elapsed) : pos.cap;
  const ok = correct && valid && ms <= pos.cap;
  if (pos.round === 1) return { ...rec, round1: [...rec.round1, { correct: ok, ms: Math.min(ms, pos.cap) }], shownAt: null };
  return { ...rec, round2: [...rec.round2, { correct: ok }], shownAt: null };
}

/** The question timed out (or could not be shown): counts as a miss at the cap. */
export function recordMiss(rec: RunRecord): RunRecord {
  const pos = positionOf(rec);
  return pos.round === "done" ? rec : recordAnswer(rec, false, pos.cap);
}

/** Mic lost: every remaining oral question is missed. */
export function missRemainingOral(rec: RunRecord): RunRecord {
  let next = rec;
  while (positionOf(next).round === 2) next = recordMiss(next);
  return next;
}

/** On (re)opening: a question that was displayed but never answered counts as missed. */
export function resume(rec: RunRecord): RunRecord {
  return rec.shownAt === null ? rec : recordMiss(rec);
}

/** Feedback of the answer just given. */
export function verdictOf(round: 1 | 2, a: Round1Answer | Round2Answer | undefined): Verdict {
  if (!a) return "miss";
  if (round === 1 && "ms" in a) {
    const damage = duelDamage([a], []);
    return damage >= DUEL.crit ? "critical" : damage > 0 ? "hit" : "miss";
  }
  return a.correct ? "hit" : "miss";
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isRef = (v: unknown): boolean => isRecord(v) && typeof v["lessonId"] === "string" && typeof v["exerciseId"] === "string";
const isRound1 = (v: unknown): v is Round1Answer => isRecord(v) && typeof v["correct"] === "boolean" && typeof v["ms"] === "number";
const isRound2 = (v: unknown): v is Round2Answer => isRecord(v) && typeof v["correct"] === "boolean";

export function isRunRecord(v: unknown): v is RunRecord {
  if (!isRecord(v) || !isRecord(v["questions"])) return false;
  const q = v["questions"];
  return (
    Array.isArray(q["round1"]) && q["round1"].every(isRef) &&
    Array.isArray(q["round2"]) && q["round2"].every(isRef) &&
    typeof v["seed"] === "number" &&
    Array.isArray(v["round1"]) && v["round1"].every(isRound1) &&
    Array.isArray(v["round2"]) && v["round2"].every(isRound2) &&
    (v["shownAt"] === null || typeof v["shownAt"] === "number")
  );
}

export function isPendingRun(v: unknown): v is PendingRun {
  return isRecord(v) && Array.isArray(v["round1"]) && v["round1"].every(isRound1) && Array.isArray(v["round2"]) && v["round2"].every(isRound2);
}

function read<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the reload guard is simply off
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const readRun = (id: string): RunRecord | null => read(runKey(id), isRunRecord);
export const saveRun = (id: string, rec: RunRecord): void => write(runKey(id), rec);
export const clearRun = (id: string): void => remove(runKey(id));
export const readPending = (id: string): PendingRun | null => read(pendingKey(id), isPendingRun);
export const savePending = (id: string, run: PendingRun): void => write(pendingKey(id), run);
export const clearPending = (id: string): void => remove(pendingKey(id));
const isTrue = (v: unknown): v is true => v === true;
/** Whether this device has already shown the result of a finished duel (the celebration plays once). */
export const wasResultSeen = (id: string): boolean => read(seenKey(id), isTrue) === true;
export const markResultSeen = (id: string): void => write(seenKey(id), true);

type KeyStorage = Pick<Storage, "length" | "key">;

/** The run to send for a duel: a pending one, or an in-progress record that is fully answered. */
export function readUnsent(id: string): PendingRun | null {
  const pending = readPending(id);
  if (pending) return pending;
  const rec = readRun(id);
  return rec && positionOf(rec).round === "done" ? { round1: rec.round1, round2: rec.round2 } : null;
}

/** Ids of the duels that have a finished run waiting to be sent. */
export function unsentDuelIds(storage: KeyStorage = localStorage): string[] {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null) continue;
      for (const prefix of [pendingKey(""), runKey("")]) {
        if (key.startsWith(prefix) && key.length > prefix.length) ids.add(key.slice(prefix.length));
      }
    }
  } catch {
    return [];
  }
  return [...ids].filter((id) => readUnsent(id) !== null);
}
