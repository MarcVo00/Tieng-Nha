import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useEntryState } from "@/app/useEntryState";
import { useServices } from "@/app/ServicesProvider";
import type { Boss, Tree } from "@/domain/types";
import { ENERGY } from "@/services/energy";
import { livesFromScore } from "@/services/bossFight";
import { EXAM_PASS } from "@/services/exam";
import { FINAL_BOSS_ID, nodeState, treeProgress } from "@/services/tree";
import { ExamLimitError, OfflineError } from "@/domain/errors";
import { fr } from "@/i18n/fr";
import { Button, Card, EmptyState, Hearts, Icon, Motif, ProgressBar, Skeleton, WaterDropHp } from "@/ui";
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

/** A wooden roller of the scroll (cuộn giấy), drawn at each end of the cartouche. */
function ScrollRoll() {
  return (
    <svg data-scroll-roll aria-hidden="true" viewBox="0 0 320 14" preserveAspectRatio="none" className="-mx-2 block h-3.5 w-[calc(100%+1rem)] text-frame-bronze">
      <rect x="6" y="3" width="308" height="8" rx="4" fill="currentColor" stroke="var(--fx-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The legend on a paper scroll between two rollers, left-aligned (audit §B9). Paper keeps its light palette in dark mode. */
function ScrollCartouche({ label, children }: { label: string; children: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="relative px-1">
      <ScrollRoll />
      <div data-theme="light" className="relative overflow-hidden bg-paper px-5 py-4 shadow-card">
        <div aria-hidden="true" className="absolute inset-0 text-ink">
          <Motif kind="clouds" />
        </div>
        <p id={id} className="relative text-caption uppercase tracking-[0.08em] text-ink-muted">{label}</p>
        <p className="relative pt-1 text-body text-ink">{children}</p>
      </div>
      <ScrollRoll />
    </section>
  );
}

/** A brush with a stroke through it: no correction during the fight. */
function NoBrush() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={32} height={32} className="text-ink">
      <path d="M21 4 L11 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M11 20 C7 21 6 25 5 28 C9 27 12 25 13 22 Z" fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M5 5 L27 27" fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

/** The rules shown, not listed (audit §B9): the 15 drops he holds, the 5 hearts you keep, the brush put away. */
function Rules({ hp, lives }: { hp: number; lives: number }) {
  const r = fr.exam.intro.rules;
  return (
    <section aria-labelledby="exam-rules" className="flex flex-col gap-3">
      <h2 id="exam-rules" className="text-heading text-ink">{fr.exam.intro.rulesLabel}</h2>
      <div data-rule="hp" className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3 shadow-card">
        <WaterDropHp value={hp} max={hp} decorative />
        <p className="text-body text-ink">
          <span className="text-body-strong tabular">{r.hp(hp)}</span> {r.hpBody}
        </p>
      </div>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div data-rule="lives" className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3 shadow-card">
          <Hearts count={lives} max={lives} />
          <p className="text-caption text-ink-muted">
            <span className="block text-body-strong text-ink tabular">{r.lives(lives)}</span>
            {r.livesBody}
          </p>
        </div>
        <div data-rule="no-correction" className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3 shadow-card">
          <NoBrush />
          <p className="text-caption text-ink-muted">
            <span className="block text-body-strong text-ink">{r.noCorrection}</span>
            {r.noCorrectionBody}
          </p>
        </div>
      </div>
    </section>
  );
}

// Hero: the boss portrait (or the lock while the skill tree keeps it locked). One action: Commencer.
export function ExamIntroScreen() {
  const { exam, content, activity } = useServices();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();
  const interrupted = isInterruptedState(useEntryState());
  const snapshot = useAppState((s) => s.snapshot);
  const energy = useAppState((s) => s.energy);
  const dueCount = useAppState((s) => s.dueCount);
  // The stored energy may be stale after a suspended PWA: reload it once when the intro opens.
  useEffect(() => {
    let cancelled = false;
    activity.getEnergy().then(
      (fresh) => {
        if (!cancelled) useAppState.getState().set({ energy: fresh });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [activity]);
  const [spendRefused, setSpendRefused] = useState(false);
  // A refusal is only as true as the energy it was based on: clear it once the gauge shows enough again.
  useEffect(() => {
    if (energy !== null && energy.current >= ENERGY.cost.boss) setSpendRefused(false);
  }, [energy]);
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
  const bestLives = snapshot.examBest !== null && snapshot.examBest >= EXAM_PASS ? livesFromScore(snapshot.examBest, boss.playerLives) : null;

  const canFight = !spendRefused && (energy === null || energy.current >= ENERGY.cost.boss);

  const start = async () => {
    if (starting || !canFight) return;
    setStarting(true);
    setError(null);
    try {
      const { attemptId, remainingToday } = await exam.startAttempt();
      const spent = await activity.startSession("boss", FINAL_BOSS_ID);
      // Accepted trade-off: if this spend fails (or throws) after startAttempt succeeded, the daily attempt is used.
      if (!spent.ok) {
        // Lost a race with another tab: the energy is gone, the attempt stays unused.
        setSpendRefused(true);
        setStarting(false);
        void refreshProgress().catch(() => undefined);
        return;
      }
      void refreshProgress().catch(() => undefined);
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
            <BossPortrait boss={boss} size={176} />
            <h1 lang="vi" className="text-title text-ink">
              {boss.name}
            </h1>
            <p className="text-body-strong text-ink-muted">{boss.title}</p>
          </>
        ) : (
          <h1 lang="vi" className="text-title text-ink">
            {boss.name}
          </h1>
        )}
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
          <ScrollCartouche label={fr.exam.intro.legendLabel}>{boss.legend}</ScrollCartouche>

          <Rules hp={boss.hp} lives={boss.playerLives} />

          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth loading={starting} disabled={!online || !canFight} aria-describedby={!canFight ? "boss-no-energy" : undefined} onClick={() => void start()}>
              {fr.exam.intro.start}
            </Button>
            {!canFight ? (
              <div className="flex flex-wrap items-center gap-3">
                <p id="boss-no-energy" className="text-body-strong text-ink-muted">
                  {fr.exam.intro.noEnergy(ENERGY.cost.boss)}
                </p>
                {dueCount > 0 ? (
                  <Link
                    to="/review"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border-2 border-line bg-surface px-5 py-3 text-body-strong text-ink"
                  >
                    {fr.energy.review}
                  </Link>
                ) : null}
              </div>
            ) : null}
            <p className="text-caption text-ink-muted">{fr.exam.intro.rules.tries}</p>
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
