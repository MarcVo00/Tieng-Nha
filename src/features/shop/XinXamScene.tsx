import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GachaPull, GachaPullItem, Look, Rarity, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { characterSlotOf } from "@/services/look";
import { Button, Confetti, duration, ease, EXIT_RATIO, HeroMedallion, RarityBadge, spring, tap } from "@/ui";
import { useFocusTrap } from "@/ui/useFocusTrap";
import altarSrc from "@/assets/gacha/altar.svg?url";
import tubeSrc from "@/assets/gacha/tube.svg?url";
import scrollSrc from "@/assets/gacha/scroll.svg?url";
import stickCommon from "@/assets/gacha/stick-common.svg?url";
import stickRare from "@/assets/gacha/stick-rare.svg?url";
import stickEpic from "@/assets/gacha/stick-epic.svg?url";
import stickLegendary from "@/assets/gacha/stick-legendary.svg?url";
import {
  ALTAR,
  fallSchedule,
  fallTotal,
  initialReveal,
  MOUTH,
  REVEAL,
  recapOrder,
  revealReducer,
  STAGE,
  STICK_RATIO,
  slotsFor,
  TRAY_TOP,
  TUBE,
  TUBE_PIVOT,
  type RevealState,
  type Slot,
} from "@/features/shop/gachaReveal";

type Props = {
  /** The pull to reveal, null when closed. Its results are final: the scene only stages them. */
  pull: GachaPull | null;
  /** A pull recovered after a crash: already drawn, so no shaking, straight to the recap. */
  recovered?: boolean;
  /** The shop catalogue, to put each piece in its slot on the hero. */
  items: readonly ShopItem[];
  baseLook: Look;
  onClose: () => void;
};

const STICK: Record<Rarity, string> = { common: stickCommon, rare: stickRare, epic: stickEpic, legendary: stickLegendary };
// The rarity seal: same pigments as the stick tips (wood, jade, vermilion lacquer, gold); the word carries the meaning.
const SEAL: Record<Rarity, string> = {
  common: "bg-frame-bronze text-paper",
  rare: "bg-frame-jade text-paper",
  epic: "bg-fx-vermilion text-paper",
  legendary: "bg-gold text-ink",
};
const SHAKE = { rotate: [0, -6, 6, -6, 6, -3, 0], y: [0, -2, 0, -2, 0, -1, 0] };
// The scroll art is 160 x 220 with a free zone (24,26)-(136,194), inner fillet at 26/134; drawn at the stage height. The
// content keeps clear of the fillet (28..132).
const SCROLL = { h: STAGE.h, w: Math.round((STAGE.h * 160) / 220) } as const;
const SCROLL_K = SCROLL.h / 220;
const ZONE = { left: Math.round(28 * SCROLL_K), top: Math.round(26 * SCROLL_K), w: Math.round(104 * SCROLL_K), h: Math.round(168 * SCROLL_K) } as const;
/** Past this many characters a name is set one size down, so it stays within three lines on the scroll. */
const LONG_NAME = 18;
const RAYS = 12;
const RAY_BOX = 200;

const ms = (s: number) => Math.round(s * 1000);
const nameOf = (id: string) => fr.shop.items[id]?.name ?? id;

function useLookFor(items: readonly ShopItem[], baseLook: Look) {
  return useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    return (itemId: string): Look => {
      const item = byId.get(itemId);
      const slot = item ? characterSlotOf(item) : null;
      return slot ? { ...baseLook, [slot]: itemId } : baseLook;
    };
  }, [items, baseLook]);
}

/** Static gold rays behind the legendary stick: one path of 12 strokes, only its opacity moves. */
function GoldRays({ slot }: { slot: Slot }) {
  const d = Array.from({ length: RAYS }, (_, i) => {
    const a = (i / RAYS) * Math.PI * 2;
    const c = RAY_BOX / 2;
    const p = (r: number) => `${(c + Math.cos(a) * r).toFixed(1)} ${(c + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(34)} L${p(i % 2 === 0 ? 96 : 76)}`;
  }).join(" ");
  return (
    <motion.svg
      aria-hidden="true"
      data-fx="rays"
      viewBox={`0 0 ${RAY_BOX} ${RAY_BOX}`}
      width={RAY_BOX}
      height={RAY_BOX}
      className="pointer-events-none absolute z-[1]"
      style={{ left: slot.x - RAY_BOX / 2, top: slot.y - RAY_BOX / 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.9 }}
      exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
      transition={{ duration: REVEAL.raysIn, ease: ease.out }}
    >
      <path d={d} stroke="var(--fx-gold)" strokeWidth={5} strokeLinecap="round" fill="none" />
    </motion.svg>
  );
}

type StickProps = { it: GachaPullItem; index: number; slot: Slot; delay: number; state: RevealState; onOpen: (i: number) => void };

/** One stick: it leaves the tube mouth, rises, then drops onto its resting place. Its tip tells the rarity. */
function Stick({ it, index, slot, delay, state, onOpen }: StickProps) {
  const dx = MOUTH.x - slot.x;
  const dy = MOUTH.y - slot.y;
  const fall = useMemo(
    () => ({
      initial: { x: dx, y: dy, rotate: 0, opacity: 0 },
      animate: { x: [dx, dx, 0], y: [dy, dy - 46, 0], rotate: [0, 0, slot.rotate], opacity: [0, 1, 1] },
      transition: { duration: REVEAL.fall, delay, times: [0, 0.4, 1], ease: ease.inOut },
    }),
    [dx, dy, slot.rotate, delay],
  );
  const lifted = state.phase === "hold" && state.current === index;
  const read = state.revealed[index] === true;
  return (
    <motion.button
      type="button"
      data-stick={it.rarity}
      data-read={read ? "true" : "false"}
      aria-label={fr.gacha.scene.stick(index + 1, fr.gacha.scene.tips[it.rarity])}
      disabled={state.phase !== "altar"}
      onClick={() => onOpen(index)}
      whileTap={tap}
      className={`absolute rounded-sm outline-offset-0 ${lifted ? "z-[2]" : ""}`}
      style={{ left: slot.x - slot.w / 2, top: slot.y - slot.h / 2, width: slot.w, height: slot.hit, transformOrigin: slot.pivot === "bottom" ? `50% ${slot.h}px` : "50% 50%" }}
      {...fall}
    >
      <motion.img
        src={STICK[it.rarity]}
        alt=""
        draggable={false}
        className={`pointer-events-none absolute left-1/2 max-w-none select-none ${read && !lifted ? "opacity-50" : ""}`}
        style={{ top: (slot.h - slot.stickH) / 2, height: slot.stickH, width: slot.stickH * STICK_RATIO, marginLeft: -(slot.stickH * STICK_RATIO) / 2 }}
        animate={{ scale: lifted ? 1.12 : 1 }}
        transition={spring.soft}
      />
    </motion.button>
  );
}

type ScrollProps = { it: GachaPullItem; look: Look };

/** The quẻ: the paper unrolls from its top roller (scaleY), then the hero wearing the piece, its name and the seal. */
function Scroll({ it, look }: ScrollProps) {
  const name = nameOf(it.itemId);
  return (
    <motion.div
      data-scroll={it.rarity}
      className="absolute z-[3]"
      style={{ left: (STAGE.w - SCROLL.w) / 2, top: 0, width: SCROLL.w, height: SCROLL.h, transformOrigin: "50% 0%" }}
      initial={{ scaleY: 0.08, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
      transition={{ duration: REVEAL.unroll, ease: ease.out }}
    >
      <img src={scrollSrc} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      <motion.div
        className="absolute flex flex-col items-center justify-center gap-1 text-center"
        style={{ left: ZONE.left, top: ZONE.top, width: ZONE.w, height: ZONE.h }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: REVEAL.content, delay: REVEAL.unroll, ease: ease.out }}
      >
        <span className="relative">
          <HeroMedallion look={look} size={88} label={fr.gacha.scene.wearing(name)} />
          <motion.span
            data-seal={it.rarity}
            className={`absolute -right-5 -top-1 -rotate-6 whitespace-nowrap rounded-sm border-2 border-paper px-1.5 py-0.5 text-caption font-semibold shadow-card ${SEAL[it.rarity]}`}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ scale: { ...spring.bouncy, delay: REVEAL.seal }, opacity: { duration: duration.instant, delay: REVEAL.seal } }}
          >
            {fr.shop.rarities[it.rarity]}
          </motion.span>
        </span>
        <h3 className={`text-balance text-ink ${name.length > LONG_NAME ? "text-body-strong" : "text-heading"}`}>{name}</h3>
        <p className={`tabular text-caption ${it.duplicate ? "text-ink-muted" : "font-semibold text-gold-ink"}`}>
          {it.duplicate ? fr.gacha.scene.duplicate(it.refund) : fr.gacha.resultNew}
        </p>
      </motion.div>
    </motion.div>
  );
}

function Recap({ pull, recovered, lookFor, onClose }: { pull: GachaPull; recovered: boolean; lookFor: (id: string) => Look; onClose: () => void }) {
  const refunds = pull.items.reduce((sum, i) => sum + i.refund, 0);
  const single = pull.items.length === 1;
  return (
    <div className="mt-4 flex flex-col gap-4">
      {recovered ? <p className="text-caption text-ink-muted">{fr.gacha.recoveredBody}</p> : null}
      <ul className={`grid list-none gap-3 ${single ? "grid-cols-1" : "grid-cols-2"}`}>
        {recapOrder(pull.items).map((i) => {
          const it = pull.items[i];
          if (!it) return null;
          const name = nameOf(it.itemId);
          return (
            <li key={`${it.itemId}-${i}`} data-rarity={it.rarity} className="flex flex-col items-center gap-1.5 rounded-md bg-surface-2 p-3 text-center">
              <HeroMedallion look={lookFor(it.itemId)} size={single ? 112 : 72} label={fr.gacha.scene.wearing(name)} />
              <span className="text-body-strong text-ink">{name}</span>
              <RarityBadge rarity={it.rarity} />
              <span className={`tabular text-caption ${it.duplicate ? "text-ink-muted" : "font-semibold text-gold-ink"}`}>
                {it.duplicate ? fr.gacha.scene.duplicate(it.refund) : fr.gacha.resultNew}
              </span>
            </li>
          );
        })}
      </ul>
      {refunds > 0 ? <p className="tabular text-caption text-ink-muted">{fr.gacha.resultTotal(refunds)}</p> : null}
      <Button fullWidth autoFocus onClick={onClose}>
        {fr.gacha.resultContinue}
      </Button>
    </div>
  );
}

// Hierarchy: the paper stage (altar, tube, sticks, then the scroll) is the hero; one line of guidance under it and at
// most one primary action; « Passer » is always in the corner. The panel is lacquer with a gold fillet (a reward is
// being given), the stage a paper inlay so the black print outlines read in both themes.
function Scene({ pull, recovered, items, baseLook, onClose }: Props & { pull: GachaPull; recovered: boolean }) {
  const reduced = useReducedMotion() === true;
  const [state, dispatch] = useReducer(revealReducer, pull.items, (its) => initialReveal(its, { direct: reduced || recovered }));
  const [confetti, setConfetti] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Set when a x10 scroll closes: focus then moves to the next unread stick instead of falling back to the page.
  const refocus = useRef(false);
  const lookFor = useLookFor(items, baseLook);
  const count = pull.items.length;
  const slots = useMemo(() => slotsFor(count), [count]);
  const schedule = useMemo(() => fallSchedule(count), [count]);
  const recap = state.phase === "recap";
  useFocusTrap(panelRef, () => (recap ? onClose() : dispatch({ type: "skip" })));

  // Beats run on timers from the schedule (never on animation callbacks): the sequence is the same whatever the frame rate.
  useEffect(() => {
    const after = (s: number, run: () => void) => {
      const t = window.setTimeout(run, ms(s));
      return () => window.clearTimeout(t);
    };
    if (state.phase === "shaking") return after(REVEAL.shake, () => dispatch({ type: "shakeEnd" }));
    if (state.phase === "falling") return after(fallTotal(count), () => dispatch({ type: "fallen" }));
    if (state.phase === "hold") return after(REVEAL.legendaryHold, () => dispatch({ type: "holdEnd" }));
    return undefined;
  }, [state.phase, state.shake, count]);

  // The finger may leave the tube (or the tube stop taking events) while it shakes: any release ends the hold.
  useEffect(() => {
    if (!state.held) return undefined;
    const release = () => dispatch({ type: "release" });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [state.held]);

  // Confetti once, when the gold seal is stamped; unmounted after their single burst.
  useEffect(() => {
    if (state.burst === 0 || reduced) return undefined;
    const on = window.setTimeout(() => setConfetti(true), ms(REVEAL.seal));
    const off = window.setTimeout(() => setConfetti(false), ms(REVEAL.seal + duration.celebrate));
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [state.burst, reduced]);

  const current = state.current === null ? null : (pull.items[state.current] ?? null);
  const currentSlot = state.current === null ? null : (slots[state.current] ?? null);
  const remaining = state.revealed.filter((r) => !r).length;
  const sticksOut = state.phase !== "tube" && state.phase !== "shaking";
  const tubeAway = count > 1 && sticksOut;
  const tubeFade = { duration: REVEAL.tubeFade, delay: tubeAway ? (schedule[count - 1]?.delay ?? 0) : 0 };
  const veil = state.phase === "hold" || state.phase === "scroll";
  const showRays = currentSlot !== null && current?.rarity === "legendary" && veil;

  const hint =
    state.phase === "scroll" && current
      ? fr.gacha.scene.announce(nameOf(current.itemId), fr.shop.rarities[current.rarity], current.duplicate ? fr.gacha.scene.duplicate(current.refund) : fr.gacha.resultNew)
      : state.phase === "tube"
      ? fr.gacha.scene.shakeHint
      : state.phase === "shaking" || state.phase === "falling"
        ? fr.gacha.scene.shaking
        : state.phase === "hold"
          ? fr.gacha.scene.holding
          : state.phase === "altar"
            ? count === 1
              ? fr.gacha.scene.tapOne
              : fr.gacha.scene.tapMany(remaining)
            : "";

  // Back on the altar after a scroll: focus the next unread stick (the recap focuses its own button).
  useEffect(() => {
    if (state.phase !== "altar" || !refocus.current) return;
    refocus.current = false;
    const next = panelRef.current?.querySelector<HTMLElement>('[data-stick][data-read="false"]');
    (next ?? panelRef.current?.querySelector<HTMLElement>("[data-reveal-all]"))?.focus();
  }, [state.phase]);

  function closeScroll(): void {
    if (count === 1) onClose();
    else {
      refocus.current = true;
      dispatch({ type: "close" });
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
        transition={{ duration: duration.fast }}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={fr.gacha.resultLabel(pull.cost)}
        tabIndex={-1}
        data-theme="dark"
        data-phase={state.phase}
        className="relative flex max-h-full w-full max-w-md flex-col rounded-lg bg-surface p-2 text-ink shadow-raised outline-none"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: duration.base * EXIT_RATIO } }}
        transition={{ duration: duration.base, ease: ease.out }}
      >
        {/* The fillet frames the panel and never scrolls; the content scrolls inside it, clipped short of the line. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-md border border-gold opacity-60" />
        <div data-scroll="" className="relative min-h-0 overflow-y-auto p-2">
          <div className="relative flex items-start justify-between gap-3 pl-1">
            <div className="flex min-w-0 flex-col pt-1">
              <span lang="vi" className="text-caption font-semibold uppercase tracking-[0.18em] text-gold-ink">
                {fr.gacha.overline}
              </span>
              <h2 className="text-heading text-ink">{recap ? (recovered ? fr.gacha.recovered : fr.gacha.resultTitle) : (fr.shop.themes[pull.theme] ?? pull.theme)}</h2>
            </div>
            {recap ? null : (
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => dispatch({ type: "skip" })}
                className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-body-strong text-primary underline"
              >
                {fr.gacha.scene.skip}
              </motion.button>
            )}
          </div>

          {recap ? (
            <Recap pull={pull} recovered={recovered} lookFor={lookFor} onClose={onClose} />
          ) : (
            <>
              <div
                data-theme="light"
                data-stage=""
                className="relative mx-auto mt-3 overflow-hidden rounded-md bg-paper"
                style={{ width: STAGE.w, height: STAGE.h }}
              >
                {count > 1 ? (
                  <span aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={{ left: ALTAR.x, top: ALTAR.y + TRAY_TOP, width: ALTAR.w, height: ALTAR.h - TRAY_TOP }}>
                    <img src={altarSrc} alt="" draggable={false} className="absolute left-0 max-w-none select-none" style={{ top: -TRAY_TOP, width: ALTAR.w, height: ALTAR.h }} />
                  </span>
                ) : null}
                <motion.img
                  src={altarSrc}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute select-none"
                  style={{ left: ALTAR.x, top: ALTAR.y, width: ALTAR.w, height: ALTAR.h }}
                  animate={{ opacity: tubeAway ? 0 : 1 }}
                  transition={tubeFade}
                />
                <motion.button
                  type="button"
                  aria-label={fr.gacha.scene.shake}
                  autoFocus
                  aria-disabled={state.phase !== "tube"}
                  tabIndex={state.phase === "tube" ? 0 : -1}
                  className="absolute rounded-sm"
                  style={{ left: TUBE.x, top: TUBE.y, width: TUBE.w, height: TUBE.h, touchAction: "none" }}
                  animate={{ opacity: tubeAway ? 0 : 1 }}
                  transition={tubeFade}
                  onPointerDown={() => dispatch({ type: "press" })}
                  onClick={() => {
                    dispatch({ type: "press" });
                    dispatch({ type: "release" });
                  }}
                >
                  <motion.img
                    key={state.phase === "shaking" ? `shake-${state.shake}` : "still"}
                    src={tubeSrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none h-full w-full select-none"
                    style={{ transformOrigin: TUBE_PIVOT }}
                    {...(state.phase === "shaking" ? { animate: SHAKE, transition: { duration: REVEAL.shake, ease: ease.inOut } } : {})}
                  />
                </motion.button>
                {sticksOut
                  ? pull.items.map((it, i) => {
                      const slot = slots[i];
                      if (!slot) return null;
                      return <Stick key={i} it={it} index={i} slot={slot} delay={schedule[i]?.delay ?? 0} state={state} onOpen={(index) => dispatch({ type: "open", index })} />;
                    })
                  : null}
                <AnimatePresence>
                  {veil ? (
                    <motion.span
                      key="veil"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-[1] bg-paper"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.85 }}
                      exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
                      transition={{ duration: REVEAL.raysIn, ease: ease.out }}
                    />
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>{showRays && currentSlot ? <GoldRays key="rays" slot={currentSlot} /> : null}</AnimatePresence>
                <AnimatePresence>
                  {state.phase === "scroll" && current ? <Scroll key={`scroll-${state.current}`} it={current} look={lookFor(current.itemId)} /> : null}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex min-h-[6.5rem] flex-col justify-start gap-3">
                <p role="status" className="min-h-[1.125rem] text-center text-caption text-ink-muted">
                  {hint}
                </p>
                {state.phase === "altar" && count > 1 ? (
                  <Button variant="secondary" fullWidth data-reveal-all="" onClick={() => dispatch({ type: "revealAll" })}>
                    {fr.gacha.scene.revealAll}
                  </Button>
                ) : null}
                {state.phase === "scroll" ? (
                  <Button fullWidth autoFocus onClick={closeScroll}>
                    {count === 1 ? fr.gacha.resultContinue : remaining > 0 ? fr.gacha.scene.next : fr.gacha.scene.toRecap}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
        <Confetti fire={confetti} />
      </motion.div>
    </div>
  );
}

/** The « Xin xăm » reveal of a gacha pull (spec gacha §2). Skipping never changes what was drawn. */
export function XinXamScene({ pull, recovered = false, ...rest }: Props) {
  return <AnimatePresence>{pull ? <Scene key={pull.id} pull={pull} recovered={recovered} {...rest} /> : null}</AnimatePresence>;
}
