import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { usePendingDuels } from "@/app/usePendingDuels";
import { OfflineError } from "@/domain/errors";
import type { LeaderboardRow as Row } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Button, EmptyState, Icon, SegmentedNav, Skeleton, duration, ease, spring, tap } from "@/ui";
import { LeaderboardRow } from "@/features/leaderboard/LeaderboardRow";
import { Podium } from "@/features/leaderboard/Podium";
import { usePullToRefresh } from "@/features/leaderboard/usePullToRefresh";

// Hero: the podium. One quiet action: refresh. My row is tinted, and pinned above the tab bar when off-screen.

type Period = "week" | "all";
const PERIODS: readonly Period[] = ["week", "all"];

type View =
  | { period: Period; status: "ready"; rows: Row[]; fetchedAt: string; stale: "none" | "offline" | "error"; refreshing: boolean }
  | { period: Period; status: "offline-empty" }
  | { period: Period; status: "error" };

const LIST: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const ITEM: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
};

function relativeAge(fetchedAt: string, now: string): string {
  const minutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(fetchedAt)) / 60000));
  if (minutes < 1) return fr.leaderboard.relative.now;
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "always" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 1440) return rtf.format(-Math.floor(minutes / 60), "hour");
  return rtf.format(-Math.floor(minutes / 1440), "day");
}

function SkeletonRows() {
  return (
    <div role="status" aria-label={fr.app.loading} className="flex flex-col gap-4 pt-4">
      <div className="flex items-end gap-2">
        {[72, 96, 56].map((h) => (
          <div key={h} className="flex-1 rounded-sm bg-surface-2" style={{ height: h + 56 }} />
        ))}
      </div>
      <Skeleton lines={4} className="h-12" />
    </div>
  );
}

export function LeaderboardScreen() {
  const { leaderboard, progress, clock } = useServices();
  const reduced = useReducedMotion();
  const pendingDuels = usePendingDuels().length;
  const [period, setPeriod] = useState<Period>("week");
  const [view, setView] = useState<View | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [myEl, setMyEl] = useState<HTMLLIElement | null>(null);
  const [myVisible, setMyVisible] = useState(true);

  useEffect(() => {
    // Stale-response guard: a tab switch (or refresh) cancels this run, so another period's rows never land here.
    let cancelled = false;
    void (async () => {
      const cached = await progress.getCachedLeaderboard(period).catch(() => undefined);
      if (cancelled) return;
      if (cached) setView({ period, status: "ready", rows: cached.rows, fetchedAt: cached.fetchedAt, stale: "none", refreshing: true });
      else setView(null);
      try {
        const rows = await leaderboard.list(period);
        if (cancelled) return;
        const fetchedAt = clock();
        setView({ period, status: "ready", rows, fetchedAt, stale: "none", refreshing: false });
        await progress.cacheLeaderboard(period, rows, fetchedAt).catch(() => undefined);
      } catch (error) {
        if (cancelled) return;
        const offline = error instanceof OfflineError;
        if (cached) setView({ period, status: "ready", rows: cached.rows, fetchedAt: cached.fetchedAt, stale: offline ? "offline" : "error", refreshing: false });
        else setView({ period, status: offline ? "offline-empty" : "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaderboard, progress, clock, period, attempt]);

  const current = view && view.period === period ? view : null;
  const refreshing = current === null || (current.status === "ready" && current.refreshing);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const pullY = usePullToRefresh(refresh, !refreshing);

  const rows = current?.status === "ready" ? current.rows : null;
  const myIndex = rows ? rows.findIndex((r) => r.isMe) : -1;
  const myRow = rows && myIndex >= 0 ? rows[myIndex] : undefined;
  const inList = myIndex >= 3;

  useEffect(() => {
    if (!myEl || typeof IntersectionObserver === "undefined") {
      setMyVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setMyVisible(entry ? entry.isIntersecting : true));
    observer.observe(myEl);
    return () => observer.disconnect();
  }, [myEl]);

  const caption = useMemo(() => {
    if (!current || current.status !== "ready" || current.stale === "none") return null;
    const age = relativeAge(current.fetchedAt, clock());
    return current.stale === "offline" ? fr.leaderboard.offline(age) : fr.leaderboard.stale(age);
  }, [current, clock]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = PERIODS[(PERIODS.indexOf(period) + (e.key === "ArrowRight" ? 1 : PERIODS.length - 1)) % PERIODS.length];
    if (next) setPeriod(next);
  };

  return (
    <div className="pb-20">
      <SegmentedNav
        label={fr.app.arenaNav.label}
        current="/leaderboard"
        items={[
          { to: "/leaderboard", label: fr.app.arenaNav.leaderboard },
          { to: "/duels", label: fr.app.arenaNav.duels, badge: pendingDuels, badgeLabel: fr.duels.entry.pending(pendingDuels) },
        ]}
      />
      <div className="mt-3 flex items-center gap-2">
        <h1 className="flex-1 text-title text-ink">{fr.leaderboard.title}</h1>
        <motion.button
          type="button"
          whileTap={tap}
          onClick={refresh}
          disabled={refreshing}
          aria-label={fr.leaderboard.refresh}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted disabled:opacity-60"
        >
          <motion.span
            className="flex"
            animate={refreshing && !reduced ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing && !reduced ? { duration: duration.loop, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          >
            <Icon name="refresh" size={22} />
          </motion.span>
        </motion.button>
      </div>

      <div role="tablist" aria-label={fr.leaderboard.periodsLabel} className="mt-2 flex border-b border-line">
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <motion.button
              key={p}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              whileTap={tap}
              onClick={() => setPeriod(p)}
              onKeyDown={onTabKey}
              className={`relative flex min-h-11 flex-1 items-center justify-center text-body-strong ${active ? "text-primary" : "text-ink-muted"}`}
            >
              {fr.leaderboard[p]}
              {active ? <motion.span layoutId="tab-underline" transition={spring.snappy} className="absolute inset-x-6 bottom-0 h-1 rounded-sm bg-primary" /> : null}
            </motion.button>
          );
        })}
      </div>

      {caption ? (
        <p role="status" className="pt-3 text-caption text-ink-muted">
          {caption}
        </p>
      ) : null}

      <motion.div style={{ y: pullY }}>
        {current === null ? (
          <SkeletonRows />
        ) : current.status === "offline-empty" ? (
          <EmptyState title={fr.leaderboard.offlineEmpty.title} body={fr.leaderboard.offlineEmpty.body} illustration="boat" />
        ) : current.status === "error" ? (
          <EmptyState
            title={fr.leaderboard.error.title}
            body={fr.leaderboard.error.body}
            illustration="boat"
            action={<Button variant="secondary" onClick={refresh}>{fr.app.error.retry}</Button>}
          />
        ) : current.rows.length === 0 ? (
          <EmptyState title={fr.leaderboard.empty.title} body={fr.leaderboard.empty.body} illustration="lantern" />
        ) : (
          <div key={period}>
            <Podium rows={current.rows.slice(0, 3)} />
            {current.rows.length > 3 ? (
              <motion.ul aria-label={fr.leaderboard.listLabel} className="list-none" variants={LIST} initial="hidden" animate="show">
                {current.rows.slice(3).map((row, i) => (
                  <LeaderboardRow key={row.userId} row={row} rank={i + 4} variants={ITEM} {...(row.isMe ? { rowRef: setMyEl } : {})} />
                ))}
              </motion.ul>
            ) : null}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {myRow && inList && !myVisible ? (
          <motion.div
            key="pinned"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: duration.fast * 0.7 } }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 pb-2"
          >
            <div className="mx-auto max-w-md px-5">
              <LeaderboardRow row={myRow} rank={myIndex + 1} pinned />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
