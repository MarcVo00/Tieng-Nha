import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Exercise, Lesson, VocabId, VocabItem } from "@/domain/types";
import type { GradeResult } from "@/exercises/types";
import type { ActivityResult } from "@/services/activity";
import { STRUGGLE, type Struggle } from "@/services/struggle";
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
const lessonOptions = (talisman: boolean): SessionOptions => ({ hearts: LESSON_HEARTS + (talisman ? STRUGGLE.talismanHearts : 0), retryWrong: true });
/** Training on the missed exercises (spec 2026-10-30): no hearts, so it cannot be lost. */
const TRAINING: SessionOptions = { hearts: null, retryWrong: true };

/** "trained": the training is over and the talisman waits for the next attempt. */
export type LessonPhase = "intro" | "exercises" | "failed" | "saving" | "trained";
export type LessonDoneState = ActivityResult & { accuracy: number; perfect: boolean };
export type LessonLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no-energy"; nextAt: string | null }
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
  const { content, activity, clock, sound } = useServices();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();

  const [load, setLoad] = useState<LessonLoad>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>("intro");
  const [session, setSession] = useState<SessionState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [failPending, setFailPending] = useState(false);
  const [struggle, setStruggle] = useState<Struggle | null>(null);
  const [mode, setMode] = useState<"lesson" | "training">("lesson");
  const [heartsMax, setHeartsMax] = useState(LESSON_HEARTS);

  // Latest values for async callbacks, plus the idempotence guards.
  const sessionRef = useRef<SessionState | null>(null);
  const lessonRef = useRef<Lesson | null>(null);
  const startedAt = useRef(0);
  const completing = useRef(false); // completeLesson runs at most once per finished session
  const failHandled = useRef(false);
  const handledKey = useRef<string | null>(null); // one result per exercise presentation
  const answers = useRef<Promise<void>>(Promise.resolve()); // recordAnswer calls, strictly sequential
  const mounted = useRef(true);
  const refreshRef = useRef(refreshProgress); // read inside the load effect without making it re-run (and re-spend)
  refreshRef.current = refreshProgress;
  const restarting = useRef(false); // one « Réessayer » spend at a time
  const prefetched = useRef<string | null>(null);
  const optionsRef = useRef<SessionOptions>(lessonOptions(false));
  const modeRef = useRef<"lesson" | "training">("lesson");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const begin = useCallback((lesson: Lesson, options: SessionOptions, exercises?: Exercise[]) => {
    optionsRef.current = options;
    const fresh = createSession(exercises ?? orderExercises(lesson, clock()), options);
    sessionRef.current = fresh;
    setSession(fresh);
    completing.current = false;
    failHandled.current = false;
    handledKey.current = null;
    startedAt.current = Date.parse(clock());
    setSaveError(false);
    setFailPending(false);
  }, [clock]);

  /** Starts an attempt: free and with extra hearts when a training earned the talisman. */
  const spend = useCallback(async (lesson: Lesson) => {
    const { talisman } = await activity.getStruggle(lesson.id);
    const spent = await activity.startSession("lesson", lesson.id, talisman ? { free: true } : undefined);
    return { ...spent, talisman };
  }, [activity]);

  const enterLesson = useCallback((lesson: Lesson, talisman: boolean) => {
    modeRef.current = "lesson";
    setMode("lesson");
    setHeartsMax(lessonOptions(talisman).hearts ?? LESSON_HEARTS);
    begin(lesson, lessonOptions(talisman));
  }, [begin]);

  useEffect(() => {
    if (!lessonId) {
      setLoad({ status: "error" });
      return;
    }
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([content.getLesson(lessonId), content.getVocabIndex()])
      .then(async ([lesson, vocabIndex]) => {
        if (cancelled) return;
        // Spend only once the content is here and this run is still the live one (StrictMode double-runs effects).
        const spent = await spend(lesson);
        if (cancelled) return;
        if (!spent.ok) {
          setLoad({ status: "no-energy", nextAt: spent.energy.nextAt });
          return;
        }
        lessonRef.current = lesson;
        enterLesson(lesson, spent.talisman);
        setPhase("intro");
        setLoad({ status: "ready", lesson, vocabIndex });
        void refreshRef.current().catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [content, activity, lessonId, spend, enterLesson, loadAttempt]);

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
    if (modeRef.current === "training") {
      // A training never completes the lesson: it only earns the talisman for the next attempt.
      try {
        await answers.current;
        await activity.completeTraining(lesson.id);
        const next = await activity.getStruggle(lesson.id);
        if (!mounted.current) return;
        setStruggle(next);
        sound.play("lesson.won");
        setPhase("trained");
      } catch {
        completing.current = false;
        if (mounted.current) {
          setPhase("saving"); // shows the save error and its retry
          setSaveError(true);
        }
      }
      return;
    }
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
  }, [activity, clock, navigate, refreshProgress, sound]);

  const fail = useCallback(async () => {
    const lesson = lessonRef.current;
    if (!lesson || failHandled.current) return;
    failHandled.current = true;
    sound.play("lesson.lost");
    setPhase("failed");
    setFailPending(true);
    const wrong = (sessionRef.current?.results ?? []).filter((r) => !r.result.correct && !r.result.skipped);
    try {
      await answers.current;
      await activity.introduceVocab(liveVocab(lesson).map((v) => v.id));
    } catch {
      // The words simply will not be in the reviews; the failed panel still works.
    }
    try {
      await activity.recordLessonFailure(lesson.id, {
        vocabIds: wrong.flatMap((r) => r.result.vocabIds),
        exerciseIds: wrong.map((r) => r.exerciseId),
      });
      const next = await activity.getStruggle(lesson.id);
      if (mounted.current) setStruggle(next);
    } catch {
      // No help this time: the plain failed panel still offers a retry.
    }
    if (mounted.current) setFailPending(false);
  }, [activity, sound]);

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
    const next = applyResult(s, optionsRef.current, result);
    sessionRef.current = next;
    setSession(next);
    if (next.status === "done") void finish(next);
    else if (next.status === "failed") void fail();
  }, [activity, finish, fail]);

  /** The moment an answer is graded (the feedback sheet opens): a wrong one costs a heart, so it sounds the lost heart. */
  const graded = useCallback(
    (result: GradeResult) => {
      if (result.skipped) return;
      sound.play(result.correct ? "answer.correct" : sessionRef.current?.hearts != null ? "heart.lost" : "answer.wrong");
    },
    [sound],
  );

  const startExercises = useCallback(() => setPhase("exercises"), []);

  const restart = useCallback(async () => {
    const lesson = lessonRef.current;
    if (!lesson || failPending || restarting.current) return;
    restarting.current = true;
    try {
      const spent = await spend(lesson);
      if (!mounted.current) return;
      if (!spent.ok) {
        setLoad({ status: "no-energy", nextAt: spent.energy.nextAt });
        return;
      }
      enterLesson(lesson, spent.talisman);
      setPhase("exercises");
      void refreshProgress().catch(() => undefined);
    } catch {
      // The journal write failed: stay on the failed panel, the learner can tap again.
    } finally {
      restarting.current = false;
    }
  }, [spend, enterLesson, failPending, refreshProgress]);

  /** Replays the exercises missed since the last completion, free and without hearts (spec 2026-10-30). */
  const startTraining = useCallback(() => {
    const lesson = lessonRef.current;
    if (!lesson || failPending || !struggle) return;
    const live = liveExercises(lesson);
    const missed = struggle.missedExercises.flatMap((id) => live.filter((e) => e.id === id));
    modeRef.current = "training";
    setMode("training");
    begin(lesson, TRAINING, missed.length > 0 ? missed : orderExercises(lesson, clock()));
    setPhase("exercises");
  }, [begin, clock, failPending, struggle]);

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
    heartsMax,
    mode,
    struggle,
    startTraining,
    saveError,
    failPending,
    startExercises,
    submit,
    graded,
    restart,
    retrySave,
    reload,
  };
}
