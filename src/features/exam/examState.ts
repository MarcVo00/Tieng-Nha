import type { BadgeDef, Exercise, ExamQuestion, ExamSection } from "@/domain/types";
import { fr } from "@/i18n/fr";
import type { ExamMention } from "@/services/exam";

export const EXAM_TOTAL = 30;
export const EXAM_LESSONS_REQUIRED = 10;
export const SECTION_ORDER: readonly ExamSection[] = ["listening", "translation", "tones", "speaking"];

/** Router state handed from the intro to the run screen. */
export type RunState = { attemptId: string; remainingToday: number };

/** What the result screen needs per question (plain data: it must survive the history state clone). */
export type QuestionOutcome = { score: number; correct: boolean; skipped: boolean; expected: string };

export type ResultState = {
  score: number;
  mention: ExamMention;
  results: QuestionOutcome[];
  questions: ExamQuestion[];
  noSpeaking: boolean;
  xpGained: number;
  newBadges: BadgeDef[];
  remainingToday: number;
  dateIso: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function isRunState(v: unknown): v is RunState {
  return isRecord(v) && typeof v["attemptId"] === "string" && v["attemptId"] !== "" && typeof v["remainingToday"] === "number";
}

export function isResultState(v: unknown): v is ResultState {
  return (
    isRecord(v) &&
    typeof v["score"] === "number" &&
    typeof v["mention"] === "string" &&
    typeof v["noSpeaking"] === "boolean" &&
    typeof v["xpGained"] === "number" &&
    typeof v["remainingToday"] === "number" &&
    typeof v["dateIso"] === "string" &&
    Array.isArray(v["newBadges"]) &&
    Array.isArray(v["results"]) &&
    Array.isArray(v["questions"]) &&
    v["results"].length === v["questions"].length
  );
}

/** Distinct sections of a draw, in exam order (the "Partie n" numbering). */
export function sectionsOf(questions: readonly ExamQuestion[]): ExamSection[] {
  return SECTION_ORDER.filter((s) => questions.some((q) => q.section === s));
}

/** Short French description of a question, for the correction list. */
export function describeQuestion(ex: Exercise): { prompt: string; subject?: string; subjectLang?: "vi" } {
  switch (ex.type) {
    case "listen_choose":
      return { prompt: fr.exercises.listenChoose.prompt };
    case "tone_pick":
      return { prompt: fr.exercises.tonePick.prompt, subject: ex.syllable, subjectLang: "vi" };
    case "translate_choose":
      return { prompt: fr.exercises.translateChoose.prompt, subject: ex.promptFr };
    case "word_order":
      return { prompt: fr.exercises.wordOrder.prompt, subject: ex.fr };
    case "speak":
      return { prompt: fr.exercises.speak.prompt, subject: ex.fr };
  }
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Router state of the intro after an attempt was abandoned (reload of the run page). */
export const INTERRUPTED_STATE = { interrupted: true } as const;
export const isInterruptedState = (v: unknown): boolean => isRecord(v) && v["interrupted"] === true;

// Attempt marker in sessionStorage: "pending:<id>" once started, "running:<id>" once the run page mounted.
// A run page mounting on a "running" marker is a reload: the attempt is abandoned (and counted).
const MARK_KEY = "tieng-nha.exam.attempt";
export type AttemptMark = "pending" | "running" | "none";

export function markAttempt(kind: "pending" | "running", attemptId: string): void {
  try {
    sessionStorage.setItem(MARK_KEY, kind + ":" + attemptId);
  } catch {
    // storage unavailable: the reload guard is simply off
  }
}
export function readAttemptMark(attemptId: string): AttemptMark {
  try {
    const v = sessionStorage.getItem(MARK_KEY);
    if (v === "pending:" + attemptId) return "pending";
    if (v === "running:" + attemptId) return "running";
  } catch {
    // ignore
  }
  return "none";
}
export function clearAttemptMark(): void {
  try {
    sessionStorage.removeItem(MARK_KEY);
  } catch {
    // ignore
  }
}
