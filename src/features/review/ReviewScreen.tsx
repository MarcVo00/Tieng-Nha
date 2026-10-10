import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import type { LeitnerBox, VocabProgress } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { addDaysIso, daysBetween, parisDay } from "@/services/time";
import { Button, Card, EmptyState, Skeleton, duration, ease } from "@/ui";

const BOXES: readonly LeitnerBox[] = [1, 2, 3, 4, 5];
const BAR_HEIGHT = 96; // px of the tallest column
const EMPTY_BAR_HEIGHT = 4; // px of the baseline shown for an empty box

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; words: VocabProgress[]; now: string };

// Hero: the number of words waiting. One action: Réviser. The distribution below is quiet context.
export function ReviewScreen() {
  const { progress, clock } = useServices();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    // Every word is due within 16 days, so a one-year horizon returns all known words, sorted by dueAt.
    const now = clock();
    progress.listDueVocab(addDaysIso(now, 365), 10000).then(
      (words) => {
        if (!cancelled) setLoad({ status: "ready", words, now });
      },
      () => {
        if (!cancelled) setLoad({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [progress, clock, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (load.status === "loading") {
    return (
      <div className="px-5 pt-6" role="status" aria-label={fr.review.run.loading}>
        <Skeleton lines={4} />
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <EmptyState
        title={fr.review.loadError.title}
        body={fr.review.loadError.body}
        illustration="boat"
        action={<Button onClick={retry}>{fr.app.error.retry}</Button>}
      />
    );
  }

  const { words, now } = load;
  const dueCount = words.filter((w) => w.dueAt <= now).length;
  const first = words[0];

  if (dueCount === 0) {
    const days = first ? Math.max(1, daysBetween(parisDay(now), parisDay(first.dueAt))) : 0;
    return (
      <EmptyState
        title={first ? fr.review.empty.title : fr.review.empty.none}
        {...(first ? { body: fr.review.empty.next(days) } : {})}
        illustration="lantern"
      />
    );
  }

  const counts = BOXES.map((b) => words.filter((w) => w.box === b).length);
  const max = Math.max(1, ...counts);

  return (
    <div className="flex flex-col gap-8 px-5 pb-8 pt-6">
      <Card raised className="flex flex-col items-start gap-4 p-5">
        <h1 className="text-title tabular text-ink">{fr.review.due(dueCount)}</h1>
        <Button size="lg" fullWidth onClick={() => navigate("/review/run")}>
          {fr.review.start}
        </Button>
      </Card>

      <section aria-label={fr.review.boxes.label} className="flex flex-col gap-3">
        <h2 className="text-caption text-ink-muted">{fr.review.boxes.label}</h2>
        <ul className="flex items-end gap-2">
          {BOXES.map((box, i) => {
            const count = counts[i] ?? 0;
            const name = fr.review.boxes.names[i] ?? "";
            return (
              <li key={box} className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={fr.review.boxes.aria(name, count)}>
                <span className="text-body-strong tabular text-ink" aria-hidden="true">
                  {count}
                </span>
                <div className="flex w-full items-end justify-center" style={{ height: BAR_HEIGHT }} aria-hidden="true">
                  <motion.div
                    className={`w-full origin-bottom rounded-sm ${count === 0 ? "bg-line" : "bg-primary"}`}
                    style={{ height: count === 0 ? EMPTY_BAR_HEIGHT : BAR_HEIGHT }}
                    initial={{ scaleY: reduced ? 1 : 0, opacity: reduced ? 0 : 1 }}
                    animate={{ scaleY: count === 0 ? 1 : Math.max(0.12, count / max), opacity: 1 }}
                    transition={{ duration: reduced ? duration.fast : duration.slow, ease: ease.out, delay: reduced ? 0 : i * 0.05 }}
                  />
                </div>
                <span className="w-full truncate text-center text-caption text-ink-muted" aria-hidden="true">
                  {name}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
