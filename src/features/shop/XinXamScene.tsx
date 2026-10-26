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
import stickSrc from "@/assets/gacha/stick.svg?url";
import cardBackSrc from "@/assets/gacha/card-back.svg?url";
import lanternSrc from "@/assets/gacha/lantern.svg?url";
import { SIGNATURES } from "@/features/shop/signatures";
import {
  ALTAR,
  autoAdvance,
  CARD_RATIO,
  dealSchedule,
  EPIC_OMEN,
  initialReveal,
  LEGENDARY_OMEN,
  MOUTH,
  omenDuration,
  REVEAL,
  recapOrder,
  revealReducer,
  risingSticks,
  STAGE,
  STICK_RATIO,
  TUBE,
  TUBE_PIVOT,
  type RevealAction,
  type RevealState,
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

// The rarity seal and the frame of a turned card: wood, jade, vermilion lacquer, gold; the word carries the meaning.
const SEAL: Record<Rarity, string> = {
  common: "bg-frame-bronze text-paper",
  rare: "bg-frame-jade text-paper",
  epic: "bg-fx-vermilion text-paper",
  legendary: "bg-gold text-ink",
};
const RING: Record<Rarity, string> = {
  common: "ring-frame-bronze",
  rare: "ring-frame-jade",
  epic: "ring-fx-vermilion",
  legendary: "ring-gold",
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
const RAY_BOX = 248;
/** Rising sticks: drawn height, and how far they leave the mouth. */
const STICK_H = 96;
const RISE = 76;
/** Epic lanterns: drawn size (art 48 x 76) and their glow. */
const LANTERN = { w: 40, h: Math.round((40 * 76) / 48), inset: 22, glow: 112 } as const;
/** Width of the one card of a x1. */
const SINGLE_CARD_W = 200;

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

/** Static gold rays: one path of 12 strokes, only its opacity moves. */
function GoldRays({ x, y, delay = 0, length = REVEAL.raysIn }: { x: number; y: number; delay?: number; length?: number }) {
  const d = Array.from({ length: RAYS }, (_, i) => {
    const a = (i / RAYS) * Math.PI * 2;
    const c = RAY_BOX / 2;
    const p = (r: number) => `${(c + Math.cos(a) * r).toFixed(1)} ${(c + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(40)} L${p(i % 2 === 0 ? 122 : 98)}`;
  }).join(" ");
  return (
    <motion.svg
      aria-hidden="true"
      data-fx="rays"
      viewBox={`0 0 ${RAY_BOX} ${RAY_BOX}`}
      width={RAY_BOX}
      height={RAY_BOX}
      className="pointer-events-none absolute"
      style={{ left: x - RAY_BOX / 2, top: y - RAY_BOX / 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.9 }}
      transition={{ duration: length, delay, ease: ease.out }}
    >
      <path d={d} stroke="var(--fx-gold)" strokeWidth={5} strokeLinecap="round" fill="none" />
    </motion.svg>
  );
}

// --- The omen: built up by the best rarity of the pull, the only hint before the cards ---

/** Rare: a jade light spreads around the altar (behind its print, so the lacquer keeps its red). */
function JadeGlow() {
  return (
    <motion.span
      aria-hidden="true"
      data-fx="jade"
      className="pointer-events-none absolute"
      style={{ left: 0, top: ALTAR.y - 56, width: STAGE.w, height: ALTAR.h + 56, background: "radial-gradient(closest-side, var(--frame-jade), transparent)" }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 0.85, scale: 1 }}
      transition={{ duration: REVEAL.glow, delay: REVEAL.rise, ease: ease.out }}
    />
  );
}

/** Epic: two red lanterns come down on their cords, then light up. */
function Lanterns() {
  return (
    <>
      {[LANTERN.inset, STAGE.w - LANTERN.inset - LANTERN.w].map((left) => (
        <motion.span
          key={left}
          aria-hidden="true"
          data-fx="lantern"
          className="pointer-events-none absolute"
          style={{ left, top: 0, width: LANTERN.w, height: LANTERN.h }}
          initial={{ y: -LANTERN.h - 8 }}
          animate={{ y: 0 }}
          transition={{ duration: duration.slow, delay: EPIC_OMEN.drop, ease: ease.out }}
        >
          <motion.span
            className="absolute"
            style={{
              left: (LANTERN.w - LANTERN.glow) / 2,
              top: LANTERN.h * 0.5 - LANTERN.glow / 2,
              width: LANTERN.glow,
              height: LANTERN.glow,
              background: "radial-gradient(closest-side, var(--fx-gold), transparent)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            transition={{ duration: duration.slow, delay: EPIC_OMEN.light, ease: ease.out }}
          />
          <img src={lanternSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          <motion.span
            className="absolute rounded-full"
            style={{ left: "16%", top: "24%", width: "68%", height: "52%", background: "radial-gradient(closest-side, var(--color-paper), transparent)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: duration.slow, delay: EPIC_OMEN.light, ease: ease.out }}
          />
        </motion.span>
      ))}
    </>
  );
}

/** Legendary: the altar holds its breath (ink dims it), then a gold light floods it, static rays behind the tube. */
function GoldFlood() {
  return (
    <>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-fx-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.32, 0.32, 0] }}
        transition={{ duration: REVEAL.pause + REVEAL.flood, delay: REVEAL.rise, times: [0, 0.3, REVEAL.pause / (REVEAL.pause + REVEAL.flood), 1], ease: ease.inOut }}
      />
      <motion.span
        aria-hidden="true"
        data-fx="gold"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(closest-side, var(--fx-gold), transparent)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ duration: REVEAL.flood, delay: LEGENDARY_OMEN.flood, ease: ease.out }}
      />
      <GoldRays x={MOUTH.x} y={MOUTH.y} delay={LEGENDARY_OMEN.flood} length={REVEAL.flood} />
    </>
  );
}

type StageProps = { state: RevealState; count: number; dispatch: (a: RevealAction) => void };

/** The paper inlay: the altar, the tube to shake, then the bare sticks rising and the omen. */
function Stage({ state, count, dispatch }: StageProps) {
  const omen = state.phase === "omen";
  const sticks = useMemo(() => risingSticks(count), [count]);
  const stickW = STICK_H * STICK_RATIO;
  return (
    <div
      data-theme="light"
      data-stage=""
      {...(omen ? { "data-omen": state.top } : {})}
      className="relative mx-auto overflow-hidden rounded-md bg-paper"
      style={{ width: STAGE.w, height: STAGE.h }}
    >
      {omen && state.top === "rare" ? <JadeGlow /> : null}
      <img src={altarSrc} alt="" draggable={false} className="pointer-events-none absolute select-none" style={{ left: ALTAR.x, top: ALTAR.y, width: ALTAR.w, height: ALTAR.h }} />
      {omen && state.top === "legendary" ? <GoldFlood /> : null}
      {/* Identical bare sticks, behind the tube: they rise out of its mouth together. */}
      {omen
        ? sticks.map((s, i) => (
            <motion.img
              key={i}
              src={stickSrc}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: MOUTH.x - stickW / 2, top: MOUTH.y + 4, width: stickW, height: STICK_H, transformOrigin: "50% 100%" }}
              initial={{ y: 0, rotate: 0 }}
              animate={{ y: [0, -RISE - 6, -RISE], rotate: s.rotate }}
              transition={{ duration: REVEAL.rise, times: [0, 0.75, 1], ease: ease.out }}
            />
          ))
        : null}
      <motion.button
        type="button"
        aria-label={fr.gacha.scene.shake}
        autoFocus
        aria-disabled={state.phase !== "tube"}
        tabIndex={state.phase === "tube" ? 0 : -1}
        className="absolute rounded-sm"
        style={{ left: TUBE.x, top: TUBE.y, width: TUBE.w, height: TUBE.h, touchAction: "none" }}
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
      {omen && state.top === "epic" ? <Lanterns /> : null}
    </div>
  );
}

// --- The cards ---

type CardProps = {
  it: GachaPullItem;
  index: number;
  flipped: boolean;
  /** This card is the one being turned over right now. */
  turning: boolean;
  enabled: boolean;
  single: boolean;
  /** First deal: the card comes down onto the panel; afterwards it is simply there. */
  deal: { delay: number } | null;
  look: Look;
  onFlip: (i: number) => void;
};

/**
 * One card. Face down it is the same lacquer back for every piece (nothing in the DOM tells the rarity). Turned over,
 * in place (scaleX 1 → 0 → 1), it shows the seal and colour of its rarity and a small preview of the hero wearing it.
 */
function Card({ it, index, flipped, turning, enabled, single, deal, look, onFlip }: CardProps) {
  const name = nameOf(it.itemId);
  const half = REVEAL.flip / 2;
  return (
    <motion.button
      type="button"
      data-card=""
      data-flipped={flipped ? "true" : "false"}
      aria-label={flipped ? fr.gacha.scene.cardOpen(index + 1, name, fr.shop.rarities[it.rarity]) : fr.gacha.scene.card(index + 1)}
      disabled={!enabled}
      onClick={() => onFlip(index)}
      whileTap={tap}
      className={`relative block w-full rounded-md ${single ? "mx-auto" : ""}`}
      style={{ aspectRatio: `${CARD_RATIO}`, ...(single ? { maxWidth: SINGLE_CARD_W } : {}) }}
      initial={deal ? { opacity: 0, y: -24, scale: 0.92 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: REVEAL.deal, delay: deal?.delay ?? 0, ease: ease.out }}
    >
      <AnimatePresence initial={false}>
        {flipped ? null : (
          <motion.span
            key="back"
            className="absolute inset-0 block rounded-md shadow-card"
            exit={{ scaleX: 0, transition: { duration: half, ease: ease.in } }}
          >
            <img src={cardBackSrc} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" />
          </motion.span>
        )}
      </AnimatePresence>
      {flipped ? (
        <motion.span
          data-theme="light"
          data-face={it.rarity}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-paper p-2 text-center shadow-card ring-[3px] ring-inset ${RING[it.rarity]}`}
          initial={turning ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: half, delay: half, ease: ease.out }}
        >
          <span className={`absolute right-1.5 top-1.5 -rotate-6 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption font-semibold shadow-card ${SEAL[it.rarity]}`}>
            {fr.shop.rarities[it.rarity]}
          </span>
          <HeroMedallion look={look} size={single ? 88 : 52} />
          <span className={`line-clamp-2 text-balance font-semibold text-ink ${single ? "text-body-strong" : "text-caption"}`}>{name}</span>
        </motion.span>
      ) : null}
    </motion.button>
  );
}

type GridProps = {
  pull: GachaPull;
  state: RevealState;
  /** True the first time the cards are shown: they are dealt. */
  dealing: boolean;
  onShown: () => void;
  lookFor: (id: string) => Look;
  onFlip: (i: number) => void;
};

function CardGrid({ pull, state, dealing, onShown, lookFor, onFlip }: GridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const single = pull.items.length === 1;
  const deal = useMemo(() => dealSchedule(pull.items.length), [pull.items.length]);
  // Dealt once: the cards keep the deal they started with (`initial` only counts on mount).
  const [dealt] = useState(dealing);
  const shown = useRef(onShown);
  // Shown (first deal, or back from a focus view): focus goes to the next face-down card.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-card][data-flipped="false"]')?.focus();
    shown.current();
  }, []);
  return (
    <div ref={ref} data-cards="" className={single ? "px-6 py-6" : "grid grid-cols-2 gap-3 py-1"}>
      {pull.items.map((it, i) => (
        <Card
          key={i}
          it={it}
          index={i}
          flipped={state.flipped[i] === true}
          turning={state.current === i && (state.phase === "focus" || state.phase === "signature")}
          enabled={state.phase === "cards"}
          single={single}
          deal={dealt ? { delay: deal[i]?.delay ?? 0 } : null}
          look={lookFor(it.itemId)}
          onFlip={onFlip}
        />
      ))}
    </div>
  );
}

// --- The focus view: the card opened large, the scroll and the hero wearing the piece ---

type ScrollProps = { it: GachaPullItem; look: Look; delay: number };

/** The quẻ: the paper unrolls from its top roller (scaleY), then the hero wearing the piece, its name and the seal. */
function Scroll({ it, look, delay }: ScrollProps) {
  const name = nameOf(it.itemId);
  return (
    <motion.div
      data-scroll={it.rarity}
      className="absolute"
      style={{ left: (STAGE.w - SCROLL.w) / 2, top: 0, width: SCROLL.w, height: SCROLL.h, transformOrigin: "50% 0%" }}
      initial={{ scaleY: 0.08, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ duration: REVEAL.unroll, delay, ease: ease.out }}
    >
      <img src={scrollSrc} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      <motion.div
        className="absolute flex flex-col items-center justify-center gap-1 text-center"
        style={{ left: ZONE.left, top: ZONE.top, width: ZONE.w, height: ZONE.h }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: REVEAL.content, delay: delay + REVEAL.unroll, ease: ease.out }}
      >
        <span className="relative">
          <HeroMedallion look={look} size={88} label={fr.gacha.scene.wearing(name)} />
          <motion.span
            data-seal={it.rarity}
            className={`absolute -right-5 -top-1 -rotate-6 whitespace-nowrap rounded-sm border-2 border-paper px-1.5 py-0.5 text-caption font-semibold shadow-card ${SEAL[it.rarity]}`}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ scale: { ...spring.bouncy, delay: delay + REVEAL.seal }, opacity: { duration: duration.instant, delay: delay + REVEAL.seal } }}
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

/** Phase `signature`: the registered scene of the piece (Task 5 fills the registry); none → straight to the focus view. */
function SignatureSlot({ itemId, reduced, onEnd }: { itemId: string; reduced: boolean; onEnd: () => void }) {
  const Signature = SIGNATURES[itemId];
  useEffect(() => {
    if (!Signature) onEnd();
  }, [Signature, onEnd]);
  return Signature ? <Signature onEnd={onEnd} reduced={reduced} /> : null;
}

type FocusProps = { it: GachaPullItem; look: Look; signing: boolean; reduced: boolean; onSignatureEnd: () => void };

function FocusView({ it, look, signing, reduced, onSignatureEnd }: FocusProps) {
  const legendary = it.rarity === "legendary";
  return (
    <div data-theme="light" data-stage="" data-focus="" className="relative mx-auto mt-1 overflow-hidden rounded-md bg-paper" style={{ width: STAGE.w, height: STAGE.h }}>
      <img src={altarSrc} alt="" draggable={false} className="pointer-events-none absolute select-none opacity-30" style={{ left: ALTAR.x, top: ALTAR.y, width: ALTAR.w, height: ALTAR.h }} />
      {signing ? (
        <SignatureSlot itemId={it.itemId} reduced={reduced} onEnd={onSignatureEnd} />
      ) : (
        <>
          {/* A legendary without a signature: the generic gold treatment, rays first, then the scroll. */}
          {legendary ? <GoldRays x={STAGE.w / 2} y={STAGE.h / 2} /> : null}
          <Scroll it={it} look={look} delay={legendary ? REVEAL.goldHold : 0} />
        </>
      )}
    </div>
  );
}

function Recap({ pull, recovered, lookFor, onClose }: { pull: GachaPull; recovered: boolean; lookFor: (id: string) => Look; onClose: () => void }) {
  const refunds = pull.items.reduce((sum, i) => sum + i.refund, 0);
  const single = pull.items.length === 1;
  return (
    <div className="mt-2 flex flex-col gap-4">
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

// Hierarchy: the paper stage (altar, tube, the omen), then the cards, then the focus view is the hero; one line of
// guidance under it and at most one action; « Passer » always in the corner. Header and footer stay put, only the body
// scrolls (the ten cards, the recap). The panel is lacquer with a gold fillet (a reward is being given).
function Scene({ pull, recovered, items, baseLook, onClose }: Props & { pull: GachaPull; recovered: boolean }) {
  const reduced = useReducedMotion() === true;
  const [state, dispatch] = useReducer(revealReducer, pull.items, (its) => initialReveal(its, { direct: reduced || recovered }));
  // The card whose focus view is open (it opens once the card has turned over in the grid).
  const [opened, setOpened] = useState<number | null>(null);
  const [burst, setBurst] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // The cards are dealt once; coming back from a focus view they are simply there.
  const [dealt, setDealt] = useState(false);
  const lookFor = useLookFor(items, baseLook);
  const count = pull.items.length;
  const recap = state.phase === "recap";
  const chaining = autoAdvance(state);
  useFocusTrap(panelRef, () => (recap ? onClose() : dispatch({ type: "skip" })));

  // Beats run on timers from the schedule (never on animation callbacks): the sequence is the same whatever the frame rate.
  const { phase, shake, top, current: turning } = state;
  useEffect(() => {
    const after = (s: number, run: () => void) => {
      const t = window.setTimeout(run, ms(s));
      return () => window.clearTimeout(t);
    };
    if (phase === "shaking") return after(REVEAL.shake, () => dispatch({ type: "shakeEnd" }));
    if (phase === "omen") return after(omenDuration(top), () => dispatch({ type: "omenEnd" }));
    if (phase === "focus" && chaining) return after(REVEAL.chainStep, () => dispatch({ type: "close" }));
    if (phase === "focus" && turning !== null) return after(REVEAL.flip, () => setOpened(turning));
    return undefined;
  }, [phase, shake, top, turning, chaining]);

  // « Tout découvrir »: the card turning over is brought into view (the grid scrolls inside the panel).
  useEffect(() => {
    if (phase !== "focus" || turning === null) return;
    panelRef.current?.querySelectorAll<HTMLElement>("[data-card]")[turning]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [phase, turning]);

  // Legendary omen: the existing confetti, once, when the gold is full.
  useEffect(() => {
    if (state.phase !== "omen" || state.top !== "legendary") return undefined;
    const on = window.setTimeout(() => setBurst(true), ms(LEGENDARY_OMEN.confetti));
    const off = window.setTimeout(() => setBurst(false), ms(LEGENDARY_OMEN.confetti + REVEAL.confetti));
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [state.phase, state.top]);

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

  // The control that had focus may leave with its phase (« Tout découvrir », the tube): keep focus in the dialog.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  }, [state.phase]);

  const current = state.current === null ? null : (pull.items[state.current] ?? null);
  const focusOpen = (state.phase === "focus" && opened === state.current) || state.phase === "signature";
  const view = state.phase === "tube" || state.phase === "shaking" || state.phase === "omen" ? "stage" : focusOpen ? "focus" : recap ? "recap" : "cards";
  const remaining = state.flipped.filter((f) => !f).length;

  const hint =
    state.phase === "focus" && focusOpen && current
      ? fr.gacha.scene.announce(nameOf(current.itemId), fr.shop.rarities[current.rarity], current.duplicate ? fr.gacha.scene.duplicate(current.refund) : fr.gacha.resultNew)
      : state.phase === "tube"
        ? fr.gacha.scene.shakeHint
        : state.phase === "shaking"
          ? fr.gacha.scene.shaking
          : state.phase === "omen"
            ? fr.gacha.scene.omen
            : chaining
              ? fr.gacha.scene.revealing
              : state.phase === "cards"
                ? count === 1
                  ? fr.gacha.scene.tapOne
                  : fr.gacha.scene.tapMany(remaining)
                : "";

  function closeFocus(): void {
    if (count === 1) onClose();
    else {
      setOpened(null);
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
        {/* The fillet frames the panel and never scrolls; only the body scrolls inside it, clipped short of the line. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-md border border-gold opacity-60" />
        <div className="relative flex shrink-0 items-start justify-between gap-3 px-3 pt-2">
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

        <div data-panel-body="" className="relative mt-2 min-h-0 overflow-y-auto px-2 pb-2">
          {/* Views swap at once (« Passer » is never kept waiting); each one fades in. */}
          <motion.div
            key={view === "focus" ? `focus-${state.current}` : view}
            initial={view === "stage" ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: duration.fast, ease: ease.out }}
          >
            {view === "stage" ? (
              <Stage state={state} count={count} dispatch={dispatch} />
            ) : view === "cards" ? (
              <CardGrid pull={pull} state={state} dealing={!dealt} onShown={() => setDealt(true)} lookFor={lookFor} onFlip={(index) => dispatch({ type: "flip", index })} />
            ) : view === "focus" && current ? (
              <FocusView
                it={current}
                look={lookFor(current.itemId)}
                signing={state.phase === "signature"}
                reduced={reduced}
                onSignatureEnd={() => dispatch({ type: "signatureEnd" })}
              />
            ) : recap ? (
              <Recap pull={pull} recovered={recovered} lookFor={lookFor} onClose={onClose} />
            ) : null}
          </motion.div>
        </div>

        {recap ? null : (
          <div className="relative flex shrink-0 flex-col gap-3 px-2 pb-2 pt-1">
            <p role="status" className="min-h-[1.125rem] text-center text-caption text-ink-muted">
              {hint}
            </p>
            {state.phase === "cards" && count > 1 ? (
              <Button variant="secondary" fullWidth data-reveal-all="" onClick={() => dispatch({ type: "revealAll" })}>
                {fr.gacha.scene.revealAll}
              </Button>
            ) : null}
            {state.phase === "focus" && focusOpen ? (
              <Button fullWidth autoFocus onClick={closeFocus}>
                {count === 1 ? fr.gacha.resultContinue : remaining === 0 && state.queue.length === 0 ? fr.gacha.scene.toRecap : fr.gacha.resultContinue}
              </Button>
            ) : null}
          </div>
        )}
        <Confetti fire={burst && state.phase === "omen"} />
      </motion.div>
    </div>
  );
}

/** The gacha reveal (spec sound-and-reveal §5): shake, the omen of the best piece, then the cards. Skipping never changes what was drawn. */
export function XinXamScene({ pull, recovered = false, ...rest }: Props) {
  return <AnimatePresence>{pull ? <Scene key={pull.id} pull={pull} recovered={recovered} {...rest} /> : null}</AnimatePresence>;
}
