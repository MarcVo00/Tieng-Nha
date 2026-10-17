import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Capabilities } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { fr } from "@/i18n/fr";
import { BadgeMedal, Button, Confetti, ConfirmDialog, EmptyState, FocusHeader, Icon, Motif, Skeleton, XpCounter } from "@/ui";
import { useReviewRun, type ReviewDone } from "@/features/review/useReviewRun";

const BADGE_STAGGER_MS = 280;

// Hero: the XP counting up and the "N/M justes" score. One action: Terminer.
function DonePanel({ result, finishing, onFinish }: { result: ReviewDone; finishing: boolean; onFinish: () => void }) {
  const total = result.snapshot.xpTotal;
  const [counted, setCounted] = useState(false);
  const [shownBadges, setShownBadges] = useState(0);

  useEffect(() => {
    setCounted(true);
  }, []);

  useEffect(() => {
    if (shownBadges >= result.newBadges.length) return;
    const t = setTimeout(() => setShownBadges((n) => n + 1), shownBadges === 0 ? 0 : BADGE_STAGGER_MS);
    return () => clearTimeout(t);
  }, [shownBadges, result.newBadges.length]);

  return (
    <div className="relative flex min-h-dvh flex-col px-5 pb-8 pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 text-gold [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="scales" />
      </div>
      <Confetti fire />
      <div className="relative flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-ink">{fr.review.done.title}</h1>
          <p className="text-body tabular text-ink-muted">{fr.review.done.score(result.correctCount, result.total)}</p>
        </div>
        <div className="pt-2">
          <XpCounter value={counted ? total : total - result.xpGained} {...(counted ? { delta: result.xpGained } : {})} />
          {result.coinsGained > 0 ? (
            <p className="mt-3 flex items-center gap-1 text-body-strong text-gold-ink tabular">
              <Icon name="coin" size={20} />
              {fr.shop.gained(result.coinsGained)}
            </p>
          ) : null}
          {(result.energyGained ?? 0) > 0 ? (
            <p className="mt-3 flex items-center gap-1 text-body-strong text-gold-ink tabular">
              <Icon name="bolt" size={20} />
              {fr.energy.gained(result.energyGained ?? 0)}
            </p>
          ) : null}
        </div>
        {result.newBadges.length > 0 ? (
          <section aria-label={fr.review.done.badges} className="flex flex-col gap-3">
            <h2 className="text-caption text-ink-muted">{fr.review.done.badges}</h2>
            <ul className="flex flex-wrap gap-5">
              {result.newBadges.slice(0, shownBadges).map((b) => (
                <li key={b.id}>
                  <BadgeMedal icon={b.icon} title={b.title} unlocked size="lg" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="relative">
        <Button size="lg" fullWidth onClick={onFinish} disabled={finishing}>
          {fr.review.done.finish}
        </Button>
      </div>
    </div>
  );
}

export function ReviewRunScreen() {
  const navigate = useNavigate();
  const { tts, stt, recorder } = useServices();
  const { settings, updateSettings } = useSettings();
  const run = useReviewRun();
  const [quitting, setQuitting] = useState(false);

  const capabilities: Capabilities = settings.capabilities ?? {
    tts: tts.isAvailable(),
    stt: stt.isAvailable(),
    recorder: recorder.isAvailable(),
  };
  const leave = () => navigate("/review", { replace: true });
  const { phase } = run;

  if (phase.name === "done") return <DonePanel result={phase.result} finishing={run.finishing} onFinish={() => void run.terminate()} />;

  return (
    <div className="pb-8">
      <FocusHeader progress={run.progress} onClose={() => setQuitting(true)} closeLabel={fr.review.run.quit.aria} />

      {phase.name === "loading" ? (
        <div className="px-5 pt-6" role="status" aria-label={fr.review.run.loading}>
          <Skeleton lines={4} />
        </div>
      ) : null}

      {phase.name === "error" ? (
        <EmptyState
          title={fr.review.loadError.title}
          body={fr.review.loadError.body}
          illustration="boat"
          action={
            <div className="flex gap-2">
              <Button onClick={run.retryLoad}>{fr.app.error.retry}</Button>
              <Button variant="secondary" onClick={leave}>
                {fr.review.run.back}
              </Button>
            </div>
          }
        />
      ) : null}

      {phase.name === "empty" ? (
        <EmptyState
          title={fr.review.run.nothing.title}
          body={fr.review.run.nothing.body}
          illustration="lantern"
          action={<Button onClick={leave}>{fr.review.run.back}</Button>}
        />
      ) : null}

      {phase.name === "exercises" && run.exercise ? (
        <div className="px-5 pt-2">
          <ExerciseHost
            exercise={run.exercise}
            attempt={run.attempt}
            mode="practice"
            vocabIndex={phase.vocabIndex}
            capabilities={capabilities}
            voiceRate={voiceRateOf(settings)}
            services={{ tts, stt, recorder }}
            onResult={run.submit}
            onCapabilityLost={(c) => void updateSettings({ capabilities: { ...capabilities, [c]: false } })}
          />
        </div>
      ) : null}

      {phase.name === "saving" ? (
        run.saveError ? (
          <EmptyState
            title={fr.review.run.saveError.title}
            body={fr.review.run.saveError.body}
            illustration="boat"
            action={<Button onClick={run.retrySave}>{fr.app.error.retry}</Button>}
          />
        ) : (
          <div className="px-5 pt-6" role="status" aria-label={fr.review.run.saving}>
            <Skeleton lines={3} />
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={quitting}
        title={fr.review.run.quit.title}
        body={fr.review.run.quit.body}
        confirmLabel={fr.review.run.quit.confirm}
        cancelLabel={fr.review.run.quit.cancel}
        danger
        onConfirm={leave}
        onCancel={() => setQuitting(false)}
      />
    </div>
  );
}
