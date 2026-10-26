import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState, useRefreshProgress, useSettings } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import type { VocabId, VocabItem } from "@/domain/types";
import type { GradeResult } from "@/exercises/types";
import type { ActivityResult } from "@/services/activity";
import {
  applyResult,
  createSession,
  currentExercise,
  progressOf,
  type SessionOptions,
  type SessionState,
} from "@/services/lessonSession";
import { createRng, seedFromString } from "@/services/random";
import { buildReviewSession } from "@/services/reviewBuilder";
import { useToast } from "@/ui";

const OPTIONS: SessionOptions = { hearts: null, retryWrong: false };

export type ReviewDone = ActivityResult & { correctCount: number; total: number };
export type ReviewPhase =
  | { name: "loading" }
  | { name: "error" }
  | { name: "empty" }
  | { name: "exercises"; vocabIndex: ReadonlyMap<VocabId, VocabItem> }
  | { name: "saving" }
  | { name: "done"; result: ReviewDone };

export function useReviewRun() {
  const { content, progress, activity, clock, sound } = useServices();
  const { settings } = useSettings();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();
  const toast = useToast();

  const [phase, setPhase] = useState<ReviewPhase>({ name: "loading" });
  const [session, setSession] = useState<SessionState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const sessionRef = useRef<SessionState | null>(null);
  const hasStt = useRef(false);
  hasStt.current = settings.capabilities?.stt ?? false;
  const started = useRef(false); // the session is built once, even under StrictMode
  const mounted = useRef(true);
  const completing = useRef(false); // completeReview runs at most once per run
  const completed = useRef(false);
  const leaving = useRef(false);
  const handledKey = useRef<string | null>(null);
  const recordFailures = useRef(0);
  const answers = useRef<Promise<void>>(Promise.resolve()); // recordAnswer calls, strictly sequential

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const build = useCallback(async () => {
    try {
      const now = clock();
      const [due, snapshot] = await Promise.all([
        progress.listDueVocab(now, 20),
        useAppState.getState().snapshot ?? activity.getSnapshot(),
      ]);
      const lessons = await Promise.all(snapshot.lessonsDone.map((id) => content.getLesson(id)));
      const pool = lessons.flatMap((l) => l.vocab);
      const exercises = buildReviewSession(due, pool, createRng(seedFromString(now)), { hasStt: hasStt.current });
      if (!mounted.current) return;
      const fresh = createSession(exercises, OPTIONS);
      sessionRef.current = fresh;
      setSession(fresh);
      setPhase(
        exercises.length === 0
          ? { name: "empty" }
          : { name: "exercises", vocabIndex: new Map(pool.map((v) => [v.id, v])) },
      );
    } catch {
      if (mounted.current) setPhase({ name: "error" });
    }
  }, [clock, progress, activity, content]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void build();
  }, [build]);

  const retryLoad = useCallback(() => {
    setPhase({ name: "loading" });
    void build();
  }, [build]);

  const finish = useCallback(
    async (final: SessionState) => {
      if (completing.current || completed.current) return;
      completing.current = true;
      setSaveError(false);
      setPhase({ name: "saving" });
      const counted = final.results.filter((r) => !r.result.skipped);
      const correctCount = counted.filter((r) => r.result.correct).length;
      const total = counted.length;
      let result: ActivityResult;
      try {
        await answers.current;
        if (recordFailures.current > 0) {
          recordFailures.current = 0;
          toast.show({ title: fr.review.recordFailed });
        }
        result = await activity.completeReview({ correctCount, total });
      } catch {
        completing.current = false; // nothing was committed: the learner may retry
        if (mounted.current) setSaveError(true);
        return;
      }
      completed.current = true;
      if (mounted.current) setPhase({ name: "done", result: { ...result, correctCount, total } });
    },
    [activity, toast],
  );

  const submit = useCallback(
    (result: GradeResult) => {
      const s = sessionRef.current;
      const exercise = s ? currentExercise(s) : undefined;
      if (!s || !exercise || s.status !== "running") return;
      const key = `${exercise.id}:${s.results.length}`;
      if (handledKey.current === key) return;
      handledKey.current = key;

      if (!result.skipped) {
        answers.current = answers.current
          .then(async () => {
            try {
              await activity.recordAnswer(result.vocabIds, result.correct);
            } catch {
              // One retry; a second failure is remembered and surfaced once at the end.
              await activity.recordAnswer(result.vocabIds, result.correct);
            }
          })
          .catch(() => {
            recordFailures.current += 1;
          });
      }
      const next = applyResult(s, OPTIONS, result);
      sessionRef.current = next;
      setSession(next);
      if (next.status !== "running") void finish(next);
    },
    [activity, finish],
  );

  /** The moment an answer is graded (the feedback sheet opens). No hearts in a review: a wrong answer is the soft knock. */
  const graded = useCallback(
    (result: GradeResult) => {
      if (!result.skipped) sound.play(result.correct ? "answer.correct" : "answer.wrong");
    },
    [sound],
  );

  const retrySave = useCallback(() => {
    const s = sessionRef.current;
    if (s) void finish(s);
  }, [finish]);

  const terminate = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    setFinishing(true);
    await refreshProgress().catch(() => undefined);
    navigate("/review", { replace: true });
  }, [navigate, refreshProgress]);

  const exercise = session ? currentExercise(session) : undefined;
  return {
    phase,
    exercise,
    attempt: session && exercise ? session.results.filter((r) => r.exerciseId === exercise.id).length : 0,
    progress: session ? (phase.name === "saving" || phase.name === "done" ? 1 : progressOf(session)) : 0,
    saveError,
    finishing,
    submit,
    graded,
    retrySave,
    retryLoad,
    terminate,
  };
}
