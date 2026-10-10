import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { ExamLimitError, OfflineError } from "@/domain/errors";
import { fr } from "@/i18n/fr";
import { Button, Card, Icon, Motif, ProgressBar, Skeleton, type IconName } from "@/ui";
import { EXAM_LESSONS_REQUIRED, SECTION_ORDER, type RunState } from "@/features/exam/examState";

const SECTION_ICON: Record<(typeof SECTION_ORDER)[number], IconName> = {
  listening: "speaker",
  translation: "chat",
  tones: "flag",
  speaking: "mic",
};

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

// Hero: the test title (or the lock when 10 lessons are not done yet). One action: Commencer.
export function ExamIntroScreen() {
  const { exam } = useServices();
  const navigate = useNavigate();
  const snapshot = useAppState((s) => s.snapshot);
  const online = useOnline();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!snapshot) {
    return (
      <div className="pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }
  const done = snapshot.lessonsDone.length;
  const unlocked = done >= EXAM_LESSONS_REQUIRED;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const { attemptId, remainingToday } = await exam.startAttempt();
      const state: RunState = { attemptId, remainingToday };
      navigate("/exam/run", { state });
    } catch (e) {
      setStarting(false);
      if (e instanceof ExamLimitError) setError(fr.exam.intro.limit);
      else if (e instanceof OfflineError) setError(fr.exam.intro.offline);
      else setError(fr.exam.intro.error);
    }
  };

  return (
    <div className="relative flex flex-col gap-6 pt-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-4 h-40 text-gold [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="waves" />
      </div>
      <header className="relative flex flex-col gap-1">
        <p className="text-caption text-gold-ink" lang="vi">
          {fr.exam.intro.kicker}
        </p>
        <h1 className="text-title text-ink">{fr.exam.intro.title}</h1>
        <p className="text-body text-ink-muted">{fr.exam.intro.lead}</p>
        {unlocked && snapshot.examBest !== null ? (
          <p className="pt-1 text-body-strong text-gold-ink tabular">{fr.exam.intro.best(snapshot.examBest)}</p>
        ) : null}
      </header>

      {unlocked ? (
        <>
          <section aria-label={fr.exam.intro.rulesLabel} className="flex flex-col gap-3">
            <h2 className="text-heading text-ink">{fr.exam.intro.rulesLabel}</h2>
            <ul className="flex flex-col gap-2 text-body text-ink">
              {fr.exam.intro.rules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={fr.exam.intro.partsLabel}>
            <ol className="divide-y divide-line">
              {SECTION_ORDER.map((s, i) => (
                <li key={s} className="flex items-center gap-3 py-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-muted">
                    <Icon name={SECTION_ICON[s]} size={24} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-caption text-ink-muted">{fr.exam.part(i + 1, fr.exam.sections[s].fr)}</span>
                    <span className="text-body-strong text-ink" lang="vi">
                      {fr.exam.sections[s].vi}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth loading={starting} disabled={!online} onClick={() => void start()}>
              {fr.exam.intro.start}
            </Button>
            {!online ? <p className="text-caption text-ink-muted">{fr.exam.intro.offline}</p> : null}
            {error ? (
              <p role="alert" className="text-body-strong text-error">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <Card className="relative flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3 text-ink-muted">
            <Icon name="lock" size={28} />
            <h2 className="text-heading text-ink">{fr.exam.intro.locked.title}</h2>
          </div>
          <p className="text-body text-ink-muted">{fr.exam.intro.locked.body}</p>
          <ProgressBar value={done / EXAM_LESSONS_REQUIRED} label={fr.exam.intro.locked.progress(done, EXAM_LESSONS_REQUIRED)} />
          <p className="text-caption text-ink-muted tabular">{fr.exam.intro.locked.progress(done, EXAM_LESSONS_REQUIRED)}</p>
        </Card>
      )}
    </div>
  );
}
