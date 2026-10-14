import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Capabilities } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { fr } from "@/i18n/fr";
import { waitParts } from "@/services/energy";
import { Button, ConfirmDialog, EmptyState, FocusHeader, Hearts, NoEnergy, ReportSheet, Skeleton } from "@/ui";
import { LESSON_HEARTS, liveVocab, useLessonRun } from "@/features/lessons/useLessonRun";
import { VocabDeck } from "@/features/lessons/VocabDeck";

// Hero: the current card or exercise, big, on cream. Header: quit, progress, hearts.
// One primary action per phase (Suivant / C'est parti / Réessayer).
export function LessonScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tts, stt, recorder, reporter, clock } = useServices();
  const { settings, updateSettings } = useSettings();
  const run = useLessonRun(id);
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
    const { nextAt } = run.load;
    return (
      <div className="pb-8">
        <FocusHeader progress={0} onClose={goHome} closeLabel={fr.lessons.quit.aria} />
        <NoEnergy wait={nextAt ? waitParts(clock(), nextAt) : null} onReview={() => navigate("/review")} onBack={goHome} />
      </div>
    );
  }

  const { lesson, vocabIndex } = run.load;
  const inExercises = run.phase === "exercises";

  return (
    <div className="pb-8">
      <FocusHeader
        progress={inExercises || run.phase === "saving" ? run.progress : 0}
        onClose={() => setQuitting(true)}
        closeLabel={fr.lessons.quit.aria}
        right={<Hearts count={run.hearts ?? LESSON_HEARTS} max={LESSON_HEARTS} />}
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
            onReport={setReportRef}
            onCapabilityLost={(c) => void updateSettings({ capabilities: { ...capabilities, [c]: false } })}
          />
        </div>
      ) : null}

      {run.phase === "failed" ? (
        <EmptyState
          title={fr.lessons.failed.title}
          body={fr.lessons.failed.body}
          illustration="bowl"
          action={
            <div className="flex gap-2">
              <Button onClick={() => void run.restart()} disabled={run.failPending}>
                {fr.lessons.failed.retry}
              </Button>
              <Button variant="secondary" onClick={goHome} disabled={run.failPending}>
                {fr.lessons.failed.back}
              </Button>
            </div>
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
