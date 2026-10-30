import type { AppEvent, LessonId, VocabId } from "@/domain/types";

// Help for a learner stuck on a lesson (spec 2026-10-30): pure replay of the local journal.
export const STRUGGLE = { wordsAfter: 2, trainingAfter: 3, maxWords: 5, talismanHearts: 2 } as const;

export type Struggle = {
  /** Lessons lost (no hearts left) since the last completion of this lesson. */
  failures: number;
  /** Words missed in those attempts, most missed first (ties: first missed first), at most `maxWords`. */
  missedVocab: VocabId[];
  /** Exercises missed in those attempts, in first-missed order, without duplicates. */
  missedExercises: string[];
  /** A finished training whose bonus attempt has not started yet. */
  talisman: boolean;
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function struggleAt(events: readonly AppEvent[], lessonId: LessonId): Struggle {
  const mine = events.filter((e) => e.refId === lessonId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let since = 0;
  mine.forEach((e, i) => {
    if (e.type === "lesson_completed") since = i + 1;
  });
  const recent = mine.slice(since);

  let failures = 0;
  const counts = new Map<VocabId, number>();
  const exercises: string[] = [];
  let talisman = false;
  for (const e of recent) {
    if (e.type === "lesson_failed") {
      failures += 1;
      for (const id of strings(e.payload["vocabIds"])) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const id of strings(e.payload["exerciseIds"])) if (!exercises.includes(id)) exercises.push(id);
    } else if (e.type === "training_done") {
      talisman = true;
    } else if (e.type === "session_started" && e.payload["kind"] === "lesson") {
      talisman = false; // the next attempt after a training uses the talisman up
    }
  }
  // Map keeps insertion order, and sort is stable: equal counts stay in first-missed order.
  const missedVocab = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, STRUGGLE.maxWords).map(([id]) => id);
  return { failures, missedVocab, missedExercises: exercises, talisman };
}
