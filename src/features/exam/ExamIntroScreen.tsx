import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Boss, Tree } from "@/domain/types";
import { livesFromScore } from "@/services/bossFight";
import { FINAL_BOSS_ID, nodeState, treeProgress } from "@/services/tree";
import { ExamLimitError, OfflineError } from "@/domain/errors";
import { fr } from "@/i18n/fr";
import { Button, Card, EmptyState, Icon, Motif, ProgressBar, Skeleton } from "@/ui";
import { BossPortrait } from "@/features/exam/BossPortrait";
import { isInterruptedState, markAttempt, type RunState } from "@/features/exam/examState";

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

// Hero: the boss portrait (or the lock while the skill tree keeps it locked). One action: Commencer.
export function ExamIntroScreen() {
  const { exam, content } = useServices();
  const navigate = useNavigate();
  const interrupted = isInterruptedState((useLocation() as { state: unknown }).state);
  const snapshot = useAppState((s) => s.snapshot);
  const online = useOnline();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [treeFailed, setTreeFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTreeFailed(false);
    Promise.all([content.getTree(), content.getBoss(FINAL_BOSS_ID)]).then(
      ([t, b]) => {
        if (cancelled) return;
        setTree(t);
        setBoss(b);
      },
      () => {
        if (!cancelled) setTreeFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, attempt]);

  if (treeFailed) {
    return (
      <EmptyState
        title={fr.exam.intro.loadError.title}
        body={fr.exam.intro.loadError.body}
        illustration="boat"
        action={<Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>}
      />
    );
  }

  if (!snapshot || !tree || !boss) {
    return (
      <div className="pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }
  const progress = treeProgress(snapshot);
  const unlocked = nodeState(tree, FINAL_BOSS_ID, progress) !== "locked";
  const trunkLessons = tree.nodes.filter((n) => n.kind === "lesson");
  const done = trunkLessons.filter((n) => progress.lessonsDone.includes(n.id)).length;
  const total = trunkLessons.length;
  const bestLives = snapshot.examBest === null ? null : livesFromScore(snapshot.examBest, boss.playerLives);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const { attemptId, remainingToday } = await exam.startAttempt();
      const state: RunState = { attemptId, remainingToday };
      markAttempt("pending", attemptId);
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
      <header className="relative flex flex-col items-center gap-2 text-center">
        <p className="text-caption text-gold-ink">{fr.exam.intro.kicker}</p>
        {unlocked ? (
          <>
            <BossPortrait boss={boss} size={176} hits={0} defeated={false} />
            <h1 lang="vi" className="text-title text-ink">
              {boss.name}
            </h1>
            <p className="text-body-strong text-ink-muted">{boss.title}</p>
            <p className="text-body text-ink">{boss.legend}</p>
          </>
        ) : null}
        {interrupted ? (
          <p role="status" className="pt-1 text-body-strong text-error">
            {fr.exam.intro.interrupted}
          </p>
        ) : null}
        {unlocked && bestLives !== null ? (
          <p className="pt-1 text-body-strong text-gold-ink tabular">
            {fr.exam.intro.won(boss.name, bestLives, boss.playerLives)}
          </p>
        ) : null}
      </header>

      {unlocked ? (
        <>
          <section aria-label={fr.exam.intro.rulesLabel} className="flex flex-col gap-3">
            <h2 className="text-heading text-ink">{fr.exam.intro.rulesLabel}</h2>
            <ul className="flex flex-col gap-2 text-body text-ink">
              {fr.exam.intro.rules(boss.hp, boss.playerLives).map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  {rule}
                </li>
              ))}
            </ul>
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
          <ProgressBar value={done / Math.max(1, total)} label={fr.exam.intro.locked.progress(done, total)} />
          <p className="text-caption text-ink-muted tabular">{fr.exam.intro.locked.progress(done, total)}</p>
        </Card>
      )}
    </div>
  );
}
