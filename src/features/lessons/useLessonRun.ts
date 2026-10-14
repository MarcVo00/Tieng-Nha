import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Exercise, Lesson, VocabId, VocabItem } from "@/domain/types";
import type { GradeResult } from "@/exercises/types";
import type { ActivityResult } from "@/services/activity";
import { createRng, seedFromString, shuffleWithinGroups } from "@/services/random";
import {
  accuracyOf,
  applyResult,
  createSession,
  currentExercise,
  progressOf,
  type SessionOptions,
  type SessionState,
} from "@/services/lessonSession";

export const LESSON_HEARTS = 3;
const OPTIONS: SessionOptions = { hearts: LESSON_HEARTS, retryWrong: true };

export type LessonPhase = "intro" | "exercises" | "failed" | "saving";
export type LessonDoneState = ActivityResult & { accuracy: number; perfect: boolean };
export type LessonLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; lesson: Lesson; vocabIndex: ReadonlyMap<VocabId, VocabItem> };

const liveExercises = (lesson: Lesson): Exercise[] => lesson.exercises.filter((e) => !e.deprecated);

/**
 * A new order on every start, so the learner cannot replay a lesson from memory. Exercises stay grouped by type
 * (listening first, speaking last, as the content orders them); only the order inside each group changes.
 */
export const orderExercises = (lesson: Lesson, now: string): Exercise[] =>
  shuffleWithinGroups(liveExercises(lesson), (e) => e.type, createRng(seedFromString(`${lesson.id}:${now}`)));
/** Retired words stay in the content (ids are immutable) but are no longer taught nor added to the reviews. */
export const liveVocab = (lesson: Lesson): VocabItem[] => lesson.vocab.filter((v) => !v.deprecated);

export function useLessonRun(lessonId: string | undefined) {
  const { content, activity, clock } = useServices();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();

  const [load, setLoad] = useState<LessonLoad>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>("intro");
  const [session, setSession] = useState<SessionState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [failPending, setFailPending] = useState(false);

  // Latest values for async callbacks, plus the idempotence guards.
  const sessionRef = useRef<SessionState | null>(null);
  const lessonRef = useRef<Lesson | null>(null);
  const startedAt = useRef(0);
  const completing = useRef(false); // completeLesson runs at most once per finished session
  const failHandled = useRef(false);
  const handledKey = useRef<string | null>(null); // one result per exercise presentation
  const answers = useRef<Promise<void>>(Promise.resolve()); // recordAnswer calls, strictly sequential
  const mounted = useRef(true);
  const prefetched = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const begin = useCallback((lesson: Lesson) => {
    const fresh = createSession(orderExercises(lesson, clock()), OPTIONS);
    sessionRef.current = fresh;
    setSession(fresh);
    completing.current = false;
    failHandled.current = false;
    handledKey.current = null;
    startedAt.current = Date.parse(clock());
    setSaveError(false);
    setFailPending(false);
  }, [clock]);

  useEffect(() => {
    if (!lessonId) {
      setLoad({ status: "error" });
      return;
    }
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([content.getLesson(lessonId), content.getVocabIndex()]).then(
      ([lesson, vocabIndex]) => {
        if (cancelled) return;
        lessonRef.current = lesson;
        begin(lesson);
        setPhase("intro");
        setLoad({ status: "ready", lesson, vocabIndex });
      },
      () => {
        if (!cancelled) setLoad({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, lessonId, begin, loadAttempt]);

  // Prefetch the next lesson while the learner is busy with exercises (ADR 0010).
  useEffect(() => {
    if (phase !== "exercises" || load.status !== "ready" || prefetched.current === load.lesson.id) return;
    prefetched.current = load.lesson.id;
    const currentId = load.lesson.id;
    content
      .listLessons()
      .then((list) => {
        const i = list.findIndex((l) => l.id === currentId);
        const next = i >= 0 ? list[i + 1] : undefined;
        return next ? content.getLesson(next.id) : undefined;
      })
      .catch(() => undefined);
  }, [phase, load, content]);

  const finish = useCallback(async (final: SessionState) => {
    const lesson = lessonRef.current;
    if (!lesson || completing.current) return;
    completing.current = true;
    setSaveError(false);
    setPhase("saving");
    let result: ActivityResult;
    // Self-assessment can never earn the perfect bonus.
    const mistakes = final.mistakes + (final.selfAssessed > 0 ? 1 : 0);
    try {
      await answers.current;
      result = await activity.completeLesson({
        lessonId: lesson.id,
        mistakes,
        durationMs: Math.max(0, Date.parse(clock()) - startedAt.current),
        vocabIds: liveVocab(lesson).map((v) => v.id),
      });
    } catch {
      completing.current = false; // nothing was committed: the learner may retry
      if (mounted.current) setSaveError(true);
      return;
    }
    await refreshProgress().catch(() => undefined);
    if (!mounted.current) return;
    const state: LessonDoneState = { ...result, accuracy: accuracyOf(final), perfect: mistakes === 0 };
    navigate(`/lesson/${lesson.id}/done`, { state, replace: true });
  }, [activity, clock, navigate, refreshProgress]);

  const fail = useCallback(async () => {
    const lesson = lessonRef.current;
    if (!lesson || failHandled.current) return;
    failHandled.current = true;
    setPhase("failed");
    setFailPending(true);
    try {
      await answers.current;
      await activity.introduceVocab(liveVocab(lesson).map((v) => v.id));
    } catch {
      // The words simply will not be in the reviews; the failed panel still works.
    }
    if (mounted.current) setFailPending(false);
  }, [activity]);

  const submit = useCallback((result: GradeResult) => {
    const s = sessionRef.current;
    const exercise = s ? currentExercise(s) : undefined;
    if (!s || !exercise || s.status !== "running") return;
    const attempt = s.results.filter((r) => r.exerciseId === exercise.id).length;
    const key = `${exercise.id}:${attempt}`;
    if (handledKey.current === key) return;
    handledKey.current = key;

    if (!result.skipped) {
      answers.current = answers.current
        .then(() => activity.recordAnswer(result.vocabIds, result.correct))
        .catch(() => undefined);
    }
    const next = applyResult(s, OPTIONS, result);
    sessionRef.current = next;
    setSession(next);
    if (next.status === "done") void finish(next);
    else if (next.status === "failed") void fail();
  }, [activity, finish, fail]);

  const startExercises = useCallback(() => setPhase("exercises"), []);

  const restart = useCallback(() => {
    const lesson = lessonRef.current;
    if (!lesson || failPending) return;
    begin(lesson);
    setPhase("exercises");
  }, [begin, failPending]);

  const retrySave = useCallback(() => {
    const s = sessionRef.current;
    if (s) void finish(s);
  }, [finish]);

  const reload = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const exercise = session ? currentExercise(session) : undefined;
  return {
    load,
    phase,
    session,
    exercise,
    attempt: session && exercise ? session.results.filter((r) => r.exerciseId === exercise.id).length : 0,
    progress: session ? progressOf(session) : 0,
    hearts: session?.hearts ?? null,
    saveError,
    failPending,
    startExercises,
    submit,
    restart,
    retrySave,
    reload,
  };
}
