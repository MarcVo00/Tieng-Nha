import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { treeBosses } from "@/services/tree";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useDuelSummary } from "@/app/usePendingDuels";
import { useLanguage } from "@/app/useLanguage";
import type { Language, LanguageId } from "@/domain/languages";
import type { Boss, LessonSummary, Tree } from "@/domain/types";
import { lookOf } from "@/services/look";
import { nextDailyBonus } from "@/services/wallet";
import { parisDay } from "@/services/time";
import { BONUS_SHOWN_KEY } from "@/domain/storageKeys";
import { Button, Card, EmptyState, Icon, LanguageEmblem, LanguageList, Motif, Sheet, Skeleton, ease, tap, useToast } from "@/ui";
import { LevelBanner, PathStop } from "@/features/home/PathStop";
import { HeroToken } from "@/features/home/HeroToken";
import { DailyBonusCard, DailyBonusSheet, type DailyBonusOffer } from "@/features/home/DailyBonus";
import { buildPathLayout, PATH_MARGIN, PATH_WIDTH, type PathLayout } from "@/features/home/pathLayout";

// Hero: the winding path with the next stop pulsing. One primary action: the next stop.
// Secondary: the language switcher and the review card on top. Loading: skeleton stops. Error: retry.

/** Compact chip at the top of the home: the language being learned; opens the sheet to switch. */
function LanguageSwitcher({ language, onSwitch }: { language: Language; onSwitch: (id: LanguageId) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function pick(id: LanguageId) {
    if (id === language.id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      // The routed screen remounts on the new language, which closes this sheet with it.
      await onSwitch(id);
    } catch {
      toast.show({ title: fr.languages.saveError });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }
  return (
    <>
      <motion.button
        type="button"
        whileTap={tap}
        aria-label={fr.languages.current(language.nameFr)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-sm border border-line bg-surface py-1.5 pl-2 pr-3 text-body-strong text-ink shadow-card"
      >
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2">
          <LanguageEmblem id={language.id} size={20} />
        </span>
        {language.nameFr}
        <Icon name="chevron-down" size={18} className="text-ink-muted" />
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} label={fr.languages.switch}>
        <h2 className="text-heading text-ink">{fr.languages.switch}</h2>
        <p className="mt-1 text-caption text-ink-muted">{fr.languages.switchHint}</p>
        <LanguageList className="mt-4" current={language.id} onPick={(id) => void pick(id)} disabled={busy} />
      </Sheet>
    </>
  );
}

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

/** Opens the daily-bonus sheet by itself once per Paris day on this device; false when storage is unavailable. */
function firstShowToday(today: string): boolean {
  try {
    if (localStorage.getItem(BONUS_SHOWN_KEY) === today) return false;
    localStorage.setItem(BONUS_SHOWN_KEY, today);
    return true;
  } catch {
    return false;
  }
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
  const { content, activity, clock, sound } = useServices();
  const { language, setLanguage } = useLanguage();
  const refresh = useRefreshProgress();
  const snapshot = useAppState((s) => s.snapshot);
  const dueCount = useAppState((s) => s.dueCount);
  const wallet = useAppState((s) => s.wallet);
  const equipped = wallet?.equipped;
  const look = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const reduced = useReducedMotion();
  const { pending: pendingDuels, unseen: unseenResults } = useDuelSummary();
  const maskId = useId();
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [bosses, setBosses] = useState<Boss[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const nextEl = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const loadTree = async () => {
      const loaded = await content.getTree();
      return [loaded, await Promise.all(treeBosses(loaded).map((id) => content.getBoss(id)))] as const;
    };
    Promise.all([content.listLessons(), loadTree(), refresh()]).then(
      ([list, [loadedTree, loadedBosses]]) => {
        if (cancelled) return;
        setLessons(list);
        setTree(loadedTree);
        setBosses(loadedBosses);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, refresh, attempt]);

  const ready = lessons !== null && tree !== null && bosses !== null && snapshot !== null;
  useEffect(() => {
    if (!ready || scrolled.current) return;
    scrolled.current = true;
    nextEl.current?.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [ready, reduced]);

  const today = parisDay(clock());
  const offer = wallet ? nextDailyBonus(wallet, today) : null;
  // The sheet keeps the offer it was opened with: once claimed, `offer` turns null but the sheet still shows the amount.
  const [sheetOffer, setSheetOffer] = useState<DailyBonusOffer | null>(null);
  const autoShown = useRef(false);
  useEffect(() => {
    if (!ready || !offer || autoShown.current) return;
    autoShown.current = true;
    if (firstShowToday(today)) setSheetOffer(offer);
  }, [ready, offer, today]);
  const claimBonus = useCallback(async () => {
    const r = await activity.claimDailyBonus();
    if (r.ok) sound.play("arena.coins");
    await refresh();
    return r.ok;
  }, [activity, sound, refresh]);

  const nextRef = useCallback((el: HTMLElement | null) => {
    nextEl.current = el;
  }, []);

  if (failed) {
    return (
      <div className="px-5 pt-4">
        <LanguageSwitcher language={language} onSwitch={setLanguage} />
        <EmptyState
        title={fr.home.loadError.title}
        body={fr.home.loadError.body}
        illustration="boat"
        action={<Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>}
        />
      </div>
    );
  }

  const layout = ready ? buildPathLayout(lessons, snapshot, tree, bosses) : null;

  return (
    <div className="relative px-5 pb-8 pt-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 text-primary [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="waves" />
      </div>
      <h1 className="sr-only">{fr.home.pathLabel}</h1>
      <div className="relative">
        <LanguageSwitcher language={language} onSwitch={setLanguage} />
        {offer ? <DailyBonusCard offer={offer} onOpen={() => setSheetOffer(offer)} /> : null}
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
              {layout.nodes.map((node) =>
                node.kind === "level" ? <LevelBanner key={node.key} node={node} /> : <PathStop key={node.key} node={node} nextRef={nextRef} />,
              )}
            </ol>
            <HeroToken hero={layout.hero} label={heroLabel(layout)} look={look} />
          </div>
        )}
      </div>
      <DailyBonusSheet offer={sheetOffer} onClose={() => setSheetOffer(null)} onClaim={claimBonus} />
    </div>
  );
}
