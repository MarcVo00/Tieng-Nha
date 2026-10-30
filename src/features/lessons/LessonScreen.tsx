import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState, useSettings, voiceRateOf } from "@/app/appState";
import { useResumeAtZero } from "@/app/useCountdown";
import { useHeroLook } from "@/app/useHeroLook";
import { useServices } from "@/app/ServicesProvider";
import type { Capabilities } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { fr } from "@/i18n/fr";
import { formatCountdown } from "@/services/energy";
import { Button, ConfirmDialog, EmptyState, FocusHeader, Hearts, NoEnergy, ReportSheet, Skeleton } from "@/ui";
import { liveVocab, useLessonRun } from "@/features/lessons/useLessonRun";
import { VocabDeck } from "@/features/lessons/VocabDeck";
import { StuckWords } from "@/features/lessons/StuckWords";
import { STRUGGLE } from "@/services/struggle";

// Hero: the current card or exercise, big, on cream. Header: quit, progress, hearts.
// One primary action per phase (Suivant / C'est parti / Réessayer).
export function LessonScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tts, stt, recorder, reporter } = useServices();
  const { settings, updateSettings } = useSettings();
  const run = useLessonRun(id);
  const remaining = useResumeAtZero(run.load.status === "no-energy" ? run.load.nextAt : null, run.reload);
  const dueCount = useAppState((s) => s.dueCount);
  const heroLook = useHeroLook();
  const [quitting, setQuitting] = useState(false);
  const [reportRef, setReportRef] = useState<string | null>(null);

  const capabilities: Capabilities = settings.capabilities ?? {
    tts: tts.isAvailable(),
    stt: stt.isAvailable(),
    recorder: recorder.isAvailable(),
  };
  const goHome = () => navigate("/", { replace: true });

  if (run.load.status === "error") {
    return (
      <EmptyState
        title={fr.lessons.loadError.title}
        body={fr.lessons.loadError.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={run.reload}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={goHome}>
              {fr.app.error.home}
            </Button>
          </div>
        }
      />
    );
  }
  if (run.load.status === "loading") {
    return (
      <div className="px-5 pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  if (run.load.status === "no-energy") {
    return (
      <div className="pb-8">
        <FocusHeader progress={0} onClose={goHome} closeLabel={fr.lessons.quit.aria} />
        <NoEnergy wait={remaining !== null ? formatCountdown(remaining) : null} canReview={dueCount > 0} onReview={() => navigate("/review")} onBack={goHome} />
      </div>
    );
  }

  const { lesson, vocabIndex } = run.load;
  const inExercises = run.phase === "exercises";
  const failures = run.struggle?.failures ?? 1;
  const canTrain = failures >= STRUGGLE.trainingAfter && (run.struggle?.missedExercises.length ?? 0) > 0;
  const training = run.mode === "training";

  return (
    <div className="pb-8">
      <FocusHeader
        progress={inExercises || run.phase === "saving" ? run.progress : 0}
        onClose={() => setQuitting(true)}
        closeLabel={fr.lessons.quit.aria}
        right={
          training ? (
            <span className="text-caption text-ink-muted">{fr.lessons.stuck.training}</span>
          ) : (
            <Hearts count={run.hearts ?? run.heartsMax} max={run.heartsMax} />
          )
        }
      />

      {run.phase === "intro" ? (
        <VocabDeck
          vocab={liveVocab(lesson)}
          voiceRate={voiceRateOf(settings)}
          ttsEnabled={capabilities.tts}
          onReport={setReportRef}
          onStart={run.startExercises}
        />
      ) : null}

      {inExercises && run.exercise ? (
        <div className="px-5 pt-2">
          <ExerciseHost
            exercise={run.exercise}
            attempt={run.attempt}
            mode="practice"
            vocabIndex={vocabIndex}
            capabilities={capabilities}
            voiceRate={voiceRateOf(settings)}
            services={{ tts, stt, recorder }}
            onResult={run.submit}
            onGraded={run.graded}
            onReport={setReportRef}
            onCapabilityLost={(c) => void updateSettings({ capabilities: { ...capabilities, [c]: false } })}
          />
        </div>
      ) : null}

      {run.phase === "failed" ? (
        // Help grows with the failures since the last completion (spec 2026-10-30): words from 2, training from 3.
        <EmptyState
          title={fr.lessons.failed.title}
          body={fr.lessons.failed.bodyFor(failures)}
          scene={{ look: heroLook, line: fr.lessons.failed.lineFor(failures), expression: "hurt" }}
          action={
            <>
              {failures >= STRUGGLE.wordsAfter && run.struggle ? (
                <StuckWords
                  ids={run.struggle.missedVocab}
                  vocabIndex={vocabIndex}
                  canSpeak={capabilities.tts}
                  onSpeak={(vi) => void tts.speak(vi, { rate: voiceRateOf(settings) }).catch(() => undefined)}
                />
              ) : null}
              {canTrain ? (
                <Button size="lg" onClick={run.startTraining} disabled={run.failPending}>
                  {fr.lessons.stuck.train}
                </Button>
              ) : null}
              <Button size="lg" variant={canTrain ? "secondary" : "primary"} onClick={() => void run.restart()} disabled={run.failPending}>
                {fr.lessons.failed.retry}
              </Button>
              <Button variant={canTrain ? "ghost" : "secondary"} onClick={goHome} disabled={run.failPending}>
                {fr.lessons.failed.back}
              </Button>
            </>
          }
        />
      ) : null}

      {run.phase === "trained" ? (
        <EmptyState
          title={fr.lessons.stuck.trained.title}
          body={fr.lessons.stuck.trained.body}
          scene={{ look: heroLook, line: fr.lessons.stuck.trained.line, tone: "reward" }}
          action={
            <>
              <Button size="lg" onClick={() => void run.restart()}>
                {fr.lessons.stuck.trained.retry}
              </Button>
              <Button variant="secondary" onClick={goHome}>
                {fr.lessons.stuck.trained.back}
              </Button>
            </>
          }
        />
      ) : null}

      {run.phase === "saving" ? (
        run.saveError ? (
          <EmptyState
            title={fr.lessons.saveError.title}
            body={fr.lessons.saveError.body}
            illustration="boat"
            action={<Button onClick={run.retrySave}>{fr.app.error.retry}</Button>}
          />
        ) : (
          <div className="px-5 pt-6" role="status" aria-label={fr.lessons.saving.title}>
            <Skeleton lines={3} />
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={quitting}
        title={fr.lessons.quit.title}
        body={fr.lessons.quit.body}
        confirmLabel={fr.lessons.quit.confirm}
        cancelLabel={fr.lessons.quit.cancel}
        danger
        onConfirm={goHome}
        onCancel={() => setQuitting(false)}
      />
      <ReportSheet
        open={reportRef !== null}
        onClose={() => setReportRef(null)}
        onSubmit={(message) =>
          reportRef === null ? Promise.resolve() : reporter.report({ refId: reportRef, message, contentVersion: lesson.contentVersion })
        }
      />
    </div>
  );
}
