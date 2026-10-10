import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useRefreshProgress, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Capabilities, ExamQuestion, VocabId, VocabItem } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import type { GradeResult } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { drawExam, examMention, examScore } from "@/services/exam";
import { seedFromString } from "@/services/random";
import { Button, ConfirmDialog, duration, EmptyState, ease, FocusHeader, Motif, ProgressBar, Skeleton } from "@/ui";
import {
  clearAttemptMark,
  formatElapsed,
  INTERRUPTED_STATE,
  isRunState,
  markAttempt,
  readAttemptMark,
  sectionsOf,
  type QuestionOutcome,
  type ResultState,
  type RunState,
} from "@/features/exam/examState";

const INTRO_MS = 1200;

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; questions: ExamQuestion[]; vocabIndex: ReadonlyMap<VocabId, VocabItem> };

// Hero: the current question, big, with no feedback. The section interstitial is brief and skippable.
function ExamRun({ run }: { run: RunState }) {
  const { content, exam, activity, clock, tts, stt, recorder } = useServices();
  const { settings } = useSettings();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();

  const capabilities: Capabilities = settings.capabilities ?? { tts: tts.isAvailable(), stt: false, recorder: false };
  const hasStt = useRef(settings.capabilities?.stt ?? false); // fixed for the run: the draw depends on it

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [introDone, setIntroDone] = useState(-1); // index whose section interstitial was dismissed
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const outcomes = useRef<QuestionOutcome[]>([]);
  const handled = useRef<number>(-1); // one result per question
  const finishing = useRef(false); // finishExam runs at most once per run
  const startedAt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([content.getExamPool(), content.getVocabIndex()]).then(
      ([pool, vocabIndex]) => {
        if (cancelled) return;
        try {
          const questions = drawExam(pool, seedFromString(run.attemptId), hasStt.current);
          outcomes.current = [];
          handled.current = -1;
          finishing.current = false;
          startedAt.current = Date.parse(clock());
          setIndex(0);
          setIntroDone(-1);
          setLoad({ status: "ready", questions, vocabIndex });
        } catch {
          setLoad({ status: "error" });
        }
      },
      () => {
        if (!cancelled) setLoad({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, clock, run.attemptId, loadAttempt]);

  const ready = load.status === "ready";
  useEffect(() => {
    if (!ready || saving) return;
    const tick = () => setElapsed(Math.max(0, (Date.parse(clock()) - startedAt.current) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ready, saving, clock]);

  const questions = load.status === "ready" ? load.questions : null;
  const question = questions?.[index];
  const sectionStart = !!questions && !!question && (index === 0 || questions[index - 1]?.section !== question.section);
  const showIntro = sectionStart && introDone !== index && !saving;

  useEffect(() => {
    if (!showIntro) return;
    const t = setTimeout(() => setIntroDone(index), INTRO_MS);
    return () => clearTimeout(t);
  }, [showIntro, index]);

  const finish = useCallback(
    async (all: readonly ExamQuestion[]) => {
      if (finishing.current) return;
      finishing.current = true;
      setSaveError(false);
      setSaving(true);
      try {
        // Always exactly one score per question: a skipped question counts 0.
        const scores = all.map((_, i) => {
          const o = outcomes.current[i];
          return o && !o.skipped ? o.score : 0;
        });
        const score = examScore(scores);
        const noSpeaking = !all.some((q) => q.section === "speaking");
        // The server scores the attempt from the synced exam_finished event; a failed call here is not fatal.
        await exam.submitAttempt(run.attemptId, score).catch(() => undefined);
        const result = await activity.finishExam({ attemptId: run.attemptId, score, noSpeaking });
        await refreshProgress().catch(() => undefined);
        if (!mounted.current) return;
        const state: ResultState = {
          score,
          mention: examMention(score),
          results: outcomes.current,
          questions: [...all],
          noSpeaking,
          xpGained: result.xpGained,
          newBadges: result.newBadges,
          remainingToday: run.remainingToday,
          dateIso: clock(),
        };
        clearAttemptMark();
        navigate("/exam/result", { state, replace: true });
      } catch {
        finishing.current = false; // nothing was committed: the learner may retry
        if (mounted.current) setSaveError(true);
      }
    },
    [exam, activity, refreshProgress, navigate, clock, run.attemptId, run.remainingToday],
  );

  const onResult = useCallback(
    (r: GradeResult) => {
      if (!questions || handled.current >= index) return;
      handled.current = index;
      outcomes.current = [
        ...outcomes.current,
        { score: r.skipped ? 0 : r.score, correct: r.correct, skipped: !!r.skipped, expected: r.expected },
      ];
      if (index + 1 >= questions.length) void finish(questions);
      else setIndex(index + 1);
    },
    [questions, index, finish],
  );

  const goBack = () => {
    clearAttemptMark();
    navigate("/exam", { replace: true });
  };
  const part = useMemo(() => (questions && question ? sectionsOf(questions).indexOf(question.section) + 1 : 0), [questions, question]);

  if (load.status === "error") {
    return (
      <EmptyState
        title={fr.exam.run.loadError.title}
        body={fr.exam.run.loadError.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={() => setLoadAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={goBack}>
              {fr.app.error.home}
            </Button>
          </div>
        }
      />
    );
  }
  if (load.status === "loading" || !questions || !question) {
    return (
      <div className="px-5 pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  const timer = (
    <span className="text-body-strong text-ink-muted tabular" role="timer" aria-label={fr.exam.run.elapsed(formatElapsed(elapsed))}>
      {formatElapsed(elapsed)}
    </span>
  );
  const header = saving ? (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1">
        <ProgressBar value={1} label={fr.ui.progress.label} />
      </div>
      {timer}
    </div>
  ) : (
    <FocusHeader progress={index / questions.length} onClose={() => setQuitting(true)} closeLabel={fr.exam.run.quit.aria} right={timer} />
  );

  return (
    <div className="pb-8">
      {header}

      {saving ? (
        saveError ? (
          <EmptyState
            title={fr.exam.run.saveError.title}
            body={fr.exam.run.saveError.body}
            illustration="boat"
            action={<Button onClick={() => void finish(questions)}>{fr.app.error.retry}</Button>}
          />
        ) : (
          <div className="px-5 pt-6" role="status" aria-label={fr.exam.run.saving}>
            <Skeleton lines={3} />
          </div>
        )
      ) : showIntro ? (
        <motion.button
          type="button"
          onClick={() => setIntroDone(index)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="relative mx-5 flex min-h-[60dvh] w-[calc(100%-2.5rem)] flex-col items-start justify-center gap-2 overflow-hidden rounded-lg bg-surface px-6 text-left shadow-card"
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 text-gold">
            <Motif kind="waves" />
          </span>
          <span className="relative text-caption text-gold-ink">{fr.exam.part(part, fr.exam.sections[question.section].fr)}</span>
          <span className="relative text-display text-ink" lang="vi">
            {fr.exam.sections[question.section].vi}
          </span>
          <span className="relative pt-4 text-caption text-ink-muted">{fr.exam.run.skipIntro}</span>
        </motion.button>
      ) : (
        <div className="px-5 pt-2">
          <p className="pb-2 text-caption text-ink-muted tabular">{fr.exam.run.counter(index + 1, questions.length)}</p>
          <ExerciseHost
            exercise={question.exercise}
            attempt={index}
            mode="exam"
            vocabIndex={load.vocabIndex}
            capabilities={capabilities}
            voiceRate={voiceRateOf(settings)}
            services={{ tts, stt, recorder }}
            onResult={onResult}
          />
        </div>
      )}

      <ConfirmDialog
        open={quitting}
        title={fr.exam.run.quit.title}
        body={fr.exam.run.quit.body}
        confirmLabel={fr.exam.run.quit.confirm}
        cancelLabel={fr.exam.run.quit.cancel}
        danger
        onConfirm={goBack}
        onCancel={() => setQuitting(false)}
      />
    </div>
  );
}

export function ExamRunScreen() {
  const { state } = useLocation() as { state: unknown };
  // Decided once, on the first render (before the effect below marks the run as running).
  const [mark] = useState(() => (isRunState(state) ? readAttemptMark(state.attemptId) : "none"));
  const attemptId = isRunState(state) ? state.attemptId : null;
  useEffect(() => {
    if (attemptId && mark === "pending") markAttempt("running", attemptId);
  }, [attemptId, mark]);
  if (!isRunState(state)) return <Navigate to="/exam" replace />;
  if (mark === "running") return <Navigate to="/exam" replace state={INTERRUPTED_STATE} />;
  if (mark === "none") return <Navigate to="/exam" replace />;
  return <ExamRun run={state} />;
}
