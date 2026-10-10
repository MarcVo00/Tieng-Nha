import type { Exercise, VocabId } from "@/domain/types";

// Structurally identical to `GradeResult` (@/exercises/types); services may not import from exercises.
export type GradeResult = {
  correct: boolean;
  score: number;
  expected: string;
  vocabIds: VocabId[];
  selfAssessed?: boolean;
  skipped?: boolean;
  detail?: unknown;
};

export type SessionOptions = { hearts: number | null; retryWrong: boolean };
export type SessionState = {
  queue: Exercise[];
  index: number;
  hearts: number | null;
  mistakes: number;
  selfAssessed: number;
  retried: string[];
  results: Array<{ exerciseId: string; result: GradeResult }>;
  status: "running" | "failed" | "done";
};

export function createSession(exercises: readonly Exercise[], opts: SessionOptions): SessionState {
  return {
    queue: [...exercises],
    index: 0,
    hearts: opts.hearts,
    mistakes: 0,
    selfAssessed: 0,
    retried: [],
    results: [],
    status: exercises.length === 0 ? "done" : "running",
  };
}

export function currentExercise(state: SessionState): Exercise | undefined {
  return state.queue[state.index];
}

export function progressOf(state: SessionState): number {
  return state.queue.length === 0 ? 1 : Math.min(1, state.index / state.queue.length);
}

export function applyResult(state: SessionState, opts: SessionOptions, result: GradeResult): SessionState {
  const exercise = currentExercise(state);
  if (state.status !== "running" || !exercise) return state;

  const wrong = !result.correct && !result.skipped;
  const queue = [...state.queue];
  const retried = [...state.retried];
  let hearts = state.hearts;
  if (wrong) {
    if (hearts !== null) hearts = Math.max(0, hearts - 1);
    if (opts.retryWrong && !retried.includes(exercise.id)) {
      queue.push(exercise);
      retried.push(exercise.id);
    }
  }

  const index = state.index + 1;
  const status = hearts === 0 ? "failed" : index >= queue.length ? "done" : "running";
  return {
    queue,
    index,
    hearts,
    mistakes: state.mistakes + (wrong ? 1 : 0),
    selfAssessed: state.selfAssessed + (result.selfAssessed && !result.skipped ? 1 : 0),
    retried,
    results: [...state.results, { exerciseId: exercise.id, result }],
    status,
  };
}

/** Share of exercises answered right on their first presentation (skipped ones are ignored), 0..1. */
export function accuracyOf(state: SessionState): number {
  const seen = new Set<string>();
  let total = 0;
  let right = 0;
  for (const { exerciseId, result } of state.results) {
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    if (result.skipped) continue;
    total++;
    if (result.correct) right++;
  }
  return total === 0 ? 1 : right / total;
}
