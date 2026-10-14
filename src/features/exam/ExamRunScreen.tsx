import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useRefreshProgress, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Boss, Capabilities, ExamQuestion, VocabId, VocabItem } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import type { GradeResult } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { answer, bossMention, buildDeck, fightScore, outOfQuestions, startFight, type Fight } from "@/services/bossFight";
import { FINAL_BOSS_ID } from "@/services/tree";
import { seedFromString } from "@/services/random";
import { Button, ConfirmDialog, duration, EmptyState, FocusHeader, Hearts, ProgressBar, Skeleton } from "@/ui";
import { BossPortrait } from "@/features/exam/BossPortrait";
import {
  clearAttemptMark,
  INTERRUPTED_STATE,
  isRunState,
  markAttempt,
  readAttemptMark,
  type QuestionOutcome,
  type ResultState,
  type RunState,
} from "@/features/exam/examState";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; deck: ExamQuestion[]; boss: Boss; vocabIndex: ReadonlyMap<VocabId, VocabItem> };

// Hierarchy: the boss portrait + HP bar are the hero, the current exercise is the one action, lives sit in the header.
function ExamRun({ run }: { run: RunState }) {
  const { content, exam, activity, clock, tts, stt, recorder } = useServices();
  const { settings } = useSettings();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();

  const capabilities: Capabilities = settings.capabilities ?? { tts: tts.isAvailable(), stt: false, recorder: false };
  const hasStt = useRef(settings.capabilities?.stt ?? false); // fixed for the run: the deck depends on it

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fight, setFight] = useState<Fight | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [quitting, setQuitting] = useState(false);

  const outcomes = useRef<QuestionOutcome[]>([]);
  const handled = useRef<number>(-1); // one result per question
  const finishing = useRef(false); // finishExam runs at most once per run
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
    Promise.all([content.getExamPool(), content.getVocabIndex(), content.getBoss(FINAL_BOSS_ID)]).then(
      ([pool, vocabIndex, boss]) => {
        if (cancelled) return;
        try {
          const deck = buildDeck(pool, boss, seedFromString(run.attemptId), hasStt.current);
          outcomes.current = [];
          handled.current = -1;
          finishing.current = false;
          setFight(startFight(boss));
          setLoad({ status: "ready", deck, boss, vocabIndex });
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
  }, [content, run.attemptId, loadAttempt]);

  const finish = useCallback(
    async (f: Fight, boss: Boss, deck: readonly ExamQuestion[]) => {
      if (finishing.current) return;
      finishing.current = true;
      setSaveError(false);
      setSaving(true);
      try {
        const score = fightScore(f, boss);
        const noSpeaking = !deck.some((q) => q.section === "speaking");
        const won = f.status === "won";
        // The server scores the attempt from the synced exam_finished event; a failed call here is not fatal.
        await exam.submitAttempt(run.attemptId, score).catch(() => undefined);
        const result = await activity.finishExam({
          attemptId: run.attemptId,
          score,
          noSpeaking,
          boss: { bossId: boss.id, won, livesLeft: f.lives, bossHpLeft: f.bossHp },
        });
        await refreshProgress().catch(() => undefined);
        if (!mounted.current) return;
        const state: ResultState = {
          score,
          mention: bossMention(score),
          results: outcomes.current,
          questions: deck.slice(0, f.answers.length),
          noSpeaking,
          xpGained: result.xpGained,
          newBadges: result.newBadges,
          remainingToday: run.remainingToday,
          dateIso: clock(),
          boss: {
            id: boss.id,
            name: boss.name,
            title: boss.title,
            illustration: boss.illustration,
            hp: boss.hp,
            playerLives: boss.playerLives,
            won,
            livesLeft: f.lives,
            bossHpLeft: f.bossHp,
          },
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
      if (load.status !== "ready" || !fight || fight.status !== "fighting") return;
      const { deck, boss } = load;
      const index = fight.answers.length;
      const question = deck[index];
      if (!question || handled.current >= index) return;
      handled.current = index;
      let next = answer(fight, question.id, r.correct && !r.skipped);
      outcomes.current = [
        ...outcomes.current,
        { score: r.skipped ? 0 : r.score, correct: r.correct, skipped: !!r.skipped, expected: r.expected },
      ];
      if (next.status === "fighting" && next.answers.length >= deck.length) next = outOfQuestions(next);
      setFight(next);
      if (next.status !== "fighting") {
        const over = next;
        // Let the last hit / heart animation play before the result.
        setTimeout(() => {
          if (mounted.current) void finish(over, boss, deck);
        }, duration.slow * 1000);
      }
    },
    [load, fight, finish],
  );

  const goBack = () => {
    clearAttemptMark();
    navigate("/exam", { replace: true });
  };

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
  if (load.status === "loading" || !fight) {
    return (
      <div className="px-5 pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  const { deck, boss } = load;
  const question = fight.status === "fighting" ? deck[fight.answers.length] : undefined;
  const last = fight.answers[fight.answers.length - 1];
  const hits = boss.hp - fight.bossHp;

  return (
    <div className="pb-8">
      {saving ? (
        <div className="flex items-center justify-end px-5 py-3">
          <Hearts count={fight.lives} max={boss.playerLives} />
        </div>
      ) : (
        <FocusHeader
          onClose={() => setQuitting(true)}
          closeLabel={fr.exam.run.quit.aria}
          right={<Hearts count={fight.lives} max={boss.playerLives} />}
        />
      )}

      <div className="flex items-center gap-4 px-5 pt-2">
        <BossPortrait boss={boss} size={88} hits={hits} defeated={fight.status === "won"} />
        <div className="min-w-0 flex-1 space-y-2">
          <p lang="vi" className="text-heading text-ink">
            {boss.name}
          </p>
          <ProgressBar value={fight.bossHp / boss.hp} label={fr.exam.run.bossHp(boss.name, fight.bossHp, boss.hp)} />
        </div>
      </div>

      {saving ? (
        saveError ? (
          <EmptyState
            title={fr.exam.run.saveError.title}
            body={fr.exam.run.saveError.body}
            illustration="boat"
            action={<Button onClick={() => void finish(fight, boss, deck)}>{fr.app.error.retry}</Button>}
          />
        ) : (
          <div className="px-5 pt-6" role="status" aria-label={fr.exam.run.saving}>
            <Skeleton lines={3} />
          </div>
        )
      ) : (
        <div className="px-5 pt-4">
          <p aria-live="polite" className="h-5 pb-2 text-caption text-ink-muted">
            {last ? (last.correct ? fr.exam.run.hit(fight.bossHp) : fr.exam.run.miss(fight.lives)) : ""}
          </p>
          {question ? (
            <ExerciseHost
              exercise={question.exercise}
              attempt={fight.answers.length}
              mode="exam"
              vocabIndex={load.vocabIndex}
              capabilities={capabilities}
              voiceRate={voiceRateOf(settings)}
              services={{ tts, stt, recorder }}
              onResult={onResult}
            />
          ) : null}
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
