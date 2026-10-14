import type { Boss, ExamQuestion, ExamSection } from "@/domain/types";
import { EXAM_PASS, type ExamMention } from "@/services/exam";
import { createRng, shuffle } from "@/services/random";

const ROTATION: readonly ExamSection[] = ["listening", "translation", "tones", "speaking"];
const WIN_SCORES_5_LIVES = [70, 78, 85, 92, 100] as const; // spec §3.3, index = lives left - 1
const DEFEAT_MAX = 60;

export type FightStatus = "fighting" | "won" | "lost";
export type Fight = { bossHp: number; lives: number; answers: { questionId: string; correct: boolean }[]; status: FightStatus };

/** Enough questions for the longest possible fight: every hit plus every life but the last. */
export const maxQuestions = (boss: Boss): number => boss.hp + boss.playerLives - 1;

/** One question at a time, no repeats, rotating through the sections (speaking only with speech recognition). */
export function buildDeck(pool: readonly ExamQuestion[], boss: Boss, seed: number, hasStt: boolean): ExamQuestion[] {
  const rng = createRng(seed);
  const sections = ROTATION.filter((s) => hasStt || s !== "speaking");
  const queues = new Map(sections.map((s) => [s, shuffle(pool.filter((q) => q.section === s && !q.exercise.deprecated), rng)]));
  const deck: ExamQuestion[] = [];
  const need = maxQuestions(boss);
  for (let i = 0; deck.length < need; i++) {
    if (sections.every((s) => (queues.get(s)?.length ?? 0) === 0)) break;
    const next = queues.get(sections[i % sections.length] ?? "listening")?.shift();
    if (next) deck.push(next);
  }
  return deck;
}

export const startFight = (boss: Boss): Fight => ({ bossHp: boss.hp, lives: boss.playerLives, answers: [], status: "fighting" });

export function answer(fight: Fight, questionId: string, correct: boolean): Fight {
  if (fight.status !== "fighting") return fight;
  const bossHp = correct ? fight.bossHp - 1 : fight.bossHp;
  const lives = correct ? fight.lives : fight.lives - 1;
  const status: FightStatus = bossHp <= 0 ? "won" : lives <= 0 ? "lost" : "fighting";
  return { bossHp, lives, answers: [...fight.answers, { questionId, correct }], status };
}

export const outOfQuestions = (fight: Fight): Fight => (fight.status === "fighting" ? { ...fight, status: "lost" } : fight);

function winScore(livesLeft: number, playerLives: number): number {
  if (playerLives === 5) return WIN_SCORES_5_LIVES[livesLeft - 1] ?? 70;
  return 70 + Math.round((30 * (livesLeft - 1)) / Math.max(1, playerLives - 1));
}

/** The 0-100 score stored for the attempt (badges, XP, best score). */
export function fightScore(fight: Fight, boss: Boss): number {
  if (fight.status === "won") return winScore(fight.lives, boss.playerLives);
  return Math.round((DEFEAT_MAX * (boss.hp - fight.bossHp)) / boss.hp);
}

export function bossMention(score: number): ExamMention {
  if (score >= 90) return "excellent";
  if (score >= 80) return "tres_bien";
  if (score >= 70) return "bien";
  return "presque";
}

/**
 * Lives shown behind a victory score (profile: "4/5 ❤️"): the largest lives count whose win score is <= score
 * (so legacy 30-question scores such as 84 still read as a win); null below the pass mark.
 */
export function livesFromScore(score: number, playerLives: number): number | null {
  for (let lives = playerLives; lives >= 1; lives--) if (winScore(lives, playerLives) <= score && score >= EXAM_PASS) return lives;
  return null;
}
