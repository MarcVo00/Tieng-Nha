import type { Duel, DuelQuestions, Round1Answer, Round2Answer } from "@/domain/types";

/** Business refusals of the duel RPCs (never thrown: returned as `{ ok: false, error }`). */
export type DuelError =
  | "not_same_group"
  | "self"
  | "prerequisites"
  | "bad_questions"
  | "not_common_lesson"
  | "already_open"
  | "daily_limit"
  | "not_found"
  | "not_participant"
  | "not_open"
  | "already_submitted"
  | "bad_run";

export const DUEL_ERRORS: readonly DuelError[] = [
  "not_same_group", "self", "prerequisites", "bad_questions", "not_common_lesson", "already_open",
  "daily_limit", "not_found", "not_participant", "not_open", "already_submitted", "bad_run",
];

/** Asynchronous duels. A network failure throws `OfflineError`. */
export interface DuelGateway {
  create(opponent: string, questions: DuelQuestions, seed: number): Promise<{ ok: true; duelId: string } | { ok: false; error: DuelError }>;
  submitRun(duelId: string, round1: Round1Answer[], round2: Round2Answer[]): Promise<{ ok: true } | { ok: false; error: DuelError }>;
  /** My duels, newest first; `theirRun` is only present once the duel is settled. */
  list(): Promise<Duel[]>;
}
