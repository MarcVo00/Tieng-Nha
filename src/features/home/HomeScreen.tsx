import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { FINAL_BOSS_ID } from "@/services/tree";
import { fr } from "@/i18n/fr";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useDuelSummary } from "@/app/usePendingDuels";
import type { Boss, LessonSummary, Tree } from "@/domain/types";
import { lookOf } from "@/services/look";
import { Button, Card, EmptyState, Icon, Motif, Skeleton, ease, tap } from "@/ui";
import { PathStop } from "@/features/home/PathStop";
import { HeroToken } from "@/features/home/HeroToken";
import { buildPathLayout, PATH_MARGIN, PATH_WIDTH, type PathLayout } from "@/features/home/pathLayout";

// Hero: the winding path with the next stop pulsing. One primary action: the next stop.
// Secondary: the review card on top. Loading: skeleton stops. Error: retry.

function ReviewCard({ count }: { count: number }) {
  return (
    <motion.div whileTap={tap}>
      <Card raised>
        <Link to="/review" className="flex min-h-11 items-center gap-3 p-4">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
            <Icon name="review" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-strong text-ink">{fr.home.review.title}</span>
            <span className="block text-caption tabular-nums text-ink-muted">{fr.home.review.count(count)}</span>
          </span>
          <Icon name="chevron-right" size={20} className="text-ink-muted" />
        </Link>
      </Card>
    </motion.div>
  );
}

function DuelBanner({ label, to }: { label: string; to: string }) {
  return (
    <motion.div whileTap={tap} className="mb-3">
      <Card raised>
        <Link to={to} className="flex min-h-11 items-center gap-3 p-4">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
            <Icon name="swords" size={24} />
          </span>
          <span className="min-w-0 flex-1 text-body-strong text-ink">{label}</span>
          <Icon name="chevron-right" size={20} className="text-ink-muted" />
        </Link>
      </Card>
    </motion.div>
  );
}

function heroLabel(layout: PathLayout): string {
  const stop = layout.nodes.find((n) => n.kind === "lesson" && n.key === layout.hero.at);
  return stop && stop.kind === "lesson" ? fr.home.heroAt(stop.lesson.title) : fr.home.heroStart;
}

function SkeletonStops() {
  return (
    <div className="flex flex-col gap-10 py-6" style={{ width: PATH_WIDTH, marginInline: PATH_MARGIN }} aria-hidden="true">
      {[-40, 0, 40].map((offset) => (
        <div key={offset} className="flex items-center gap-4" style={{ transform: `translateX(${offset}px)` }}>
          <div className="h-16 w-16 shrink-0 rounded-full bg-surface-2" />
          <div className="w-24"><Skeleton lines={2} /></div>
        </div>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const { content } = useServices();
  const refresh = useRefreshProgress();
  const snapshot = useAppState((s) => s.snapshot);
  const dueCount = useAppState((s) => s.dueCount);
  const equipped = useAppState((s) => s.wallet?.equipped);
  const look = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const reduced = useReducedMotion();
  const { pending: pendingDuels, unseen: unseenResults } = useDuelSummary();
  const maskId = useId();
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const nextEl = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([content.listLessons(), content.getTree(), content.getBoss(FINAL_BOSS_ID), refresh()]).then(
      ([list, loadedTree, loadedBoss]) => {
        if (cancelled) return;
        setLessons(list);
        setTree(loadedTree);
        setBoss(loadedBoss);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, refresh, attempt]);

  const ready = lessons !== null && tree !== null && boss !== null && snapshot !== null;
  useEffect(() => {
    if (!ready || scrolled.current) return;
    scrolled.current = true;
    nextEl.current?.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [ready, reduced]);

  const nextRef = useCallback((el: HTMLElement | null) => {
    nextEl.current = el;
  }, []);

  if (failed) {
    return (
      <EmptyState
        title={fr.home.loadError.title}
        body={fr.home.loadError.body}
        illustration="boat"
        action={<Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>}
      />
    );
  }

  const layout = ready ? buildPathLayout(lessons, snapshot, tree, boss) : null;

  return (
    <div className="relative px-5 pb-8 pt-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 text-primary [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="waves" />
      </div>
      <h1 className="sr-only">{fr.home.pathLabel}</h1>
      <div className="relative">
        {pendingDuels[0] ? (
          <DuelBanner to="/duels" label={fr.duels.banner(pendingDuels[0].opponentPseudo, pendingDuels.length - 1)} />
        ) : unseenResults[0] ? (
          // A duel to play keeps priority; otherwise announce a settled duel whose result was not shown yet.
          <DuelBanner to={`/duel/${unseenResults[0].id}`} label={fr.duels.resultBanner(unseenResults[0].opponentPseudo)} />
        ) : null}
        {dueCount > 0 ? <ReviewCard count={dueCount} /> : null}
        {layout === null ? (
          <SkeletonStops />
        ) : (
          <div className="relative" style={{ width: PATH_WIDTH, height: layout.height, marginInline: PATH_MARGIN }}>
            <svg className="absolute inset-0 text-line" width={PATH_WIDTH} height={layout.height} viewBox={`0 0 ${PATH_WIDTH} ${layout.height}`} fill="none" aria-hidden="true" focusable="false">
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={PATH_WIDTH} height={layout.height}>
                  <motion.path
                    d={layout.d}
                    stroke="white"
                    strokeWidth={10}
                    strokeLinecap="round"
                    fill="none"
                    initial={{ pathLength: reduced ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reduced ? 0 : 0.6, ease: ease.inOut }}
                  />
                </mask>
              </defs>
              {/* Brush stroke: a wide, soft ink band under a dashed centre line, revealed together by the mask. */}
              <g mask={`url(#${maskId})`}>
                <path d={layout.d} className="stroke-line" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
                <path d={layout.d} className="stroke-ink-muted" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 9" opacity={0.7} />
              </g>
            </svg>
            <ol className="absolute inset-0 list-none">
              {layout.nodes.map((node) => (
                <PathStop key={node.key} node={node} nextRef={nextRef} />
              ))}
            </ol>
            <HeroToken hero={layout.hero} label={heroLabel(layout)} look={look} />
          </div>
        )}
      </div>
    </div>
  );
}
