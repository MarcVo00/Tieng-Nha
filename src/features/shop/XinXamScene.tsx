import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GachaPull, GachaPullItem, Look, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { characterSlotOf } from "@/services/look";
import { Button, Confetti, duration, ease, EXIT_RATIO, HeroMedallion, RarityBadge, spring, tap } from "@/ui";
import { useFocusTrap } from "@/ui/useFocusTrap";
import altarSrc from "@/assets/gacha/altar.svg?url";
import tubeSrc from "@/assets/gacha/tube.svg?url";
import scrollSrc from "@/assets/gacha/scroll.svg?url";
import stickSrc from "@/assets/gacha/stick.svg?url";
import { SIGNATURES } from "@/features/shop/signatures";
import { CardGrid, nameOf, SEAL } from "@/features/shop/XinXamCards";
import { GoldFlood, GoldRays, JadeGlow, Lanterns } from "@/features/shop/XinXamOmen";
import {
  ALTAR,
  autoAdvance,
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

const SHAKE = { rotate: [0, -6, 6, -6, 6, -3, 0], y: [0, -2, 0, -2, 0, -1, 0] };
// The scroll art is 160 x 220 with a free zone (24,26)-(136,194), inner fillet at 26/134; drawn at the stage height. The
// content keeps clear of the fillet (28..132).
const SCROLL = { h: STAGE.h, w: Math.round((STAGE.h * 160) / 220) } as const;
const SCROLL_K = SCROLL.h / 220;
const ZONE = { left: Math.round(28 * SCROLL_K), top: Math.round(26 * SCROLL_K), w: Math.round(104 * SCROLL_K), h: Math.round(168 * SCROLL_K) } as const;
/** Past this many characters a name is set one size down, so it stays within three lines on the scroll. */
const LONG_NAME = 18;
/** Rising sticks: drawn height, and how far they leave the mouth. */
const STICK_H = 96;
const RISE = 76;

const ms = (s: number) => Math.round(s * 1000);

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

type FocusProps = {
  it: GachaPullItem;
  look: Look;
  signing: boolean;
  /** Its signature has played: the piece appears at once, without the generic gold. */
  signed: boolean;
  reduced: boolean;
  onSignatureEnd: () => void;
};

function FocusView({ it, look, signing, signed, reduced, onSignatureEnd }: FocusProps) {
  const gold = it.rarity === "legendary" && !signed;
  return (
    <div data-theme="light" data-stage="" data-focus="" className="relative mx-auto mt-1 overflow-hidden rounded-md bg-paper" style={{ width: STAGE.w, height: STAGE.h }}>
      <img src={altarSrc} alt="" draggable={false} className="pointer-events-none absolute select-none opacity-30" style={{ left: ALTAR.x, top: ALTAR.y, width: ALTAR.w, height: ALTAR.h }} />
      {signing ? (
        <SignatureSlot itemId={it.itemId} reduced={reduced} onEnd={onSignatureEnd} />
      ) : (
        <>
          {/* A legendary without a signature: the generic gold treatment, rays first, then the scroll. */}
          {gold ? <GoldRays x={STAGE.w / 2} y={STAGE.h / 2} /> : null}
          <Scroll it={it} look={look} delay={gold ? REVEAL.goldHold : 0} />
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
  // Cards whose signature has played: their focus view stays open from the signature on (no return to the grid).
  const [signed, setSigned] = useState<readonly number[]>([]);
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

  // A signature opens the focus view straight away (the card face would show the piece before it), and keeps it open.
  useEffect(() => {
    if (phase !== "signature" || turning === null) return;
    setSigned((s) => (s.includes(turning) ? s : [...s, turning]));
  }, [phase, turning]);
  const onSignatureEnd = useCallback(() => dispatch({ type: "signatureEnd" }), []);

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
  const focusOpen =
    state.phase === "signature" || (state.phase === "focus" && state.current !== null && (opened === state.current || signed.includes(state.current)));
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
            : state.phase === "focus" && current && state.current !== null
              ? // « Tout découvrir » announces each card as it turns; a touched card says it is turning.
                chaining
                ? fr.gacha.scene.cardOpen(state.current + 1, nameOf(current.itemId), fr.shop.rarities[current.rarity])
                : fr.gacha.scene.turning
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
                signed={state.current !== null && signed.includes(state.current)}
                onSignatureEnd={onSignatureEnd}
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
            {/* Stays in place while a card turns over in the grid (the footer does not jump; focus stays on it). */}
            {count > 1 && (state.phase === "cards" || (state.phase === "focus" && !focusOpen)) ? (
              <Button
                variant="secondary"
                fullWidth
                data-reveal-all=""
                aria-disabled={state.phase !== "cards"}
                className={state.phase === "cards" ? "" : "opacity-50"}
                onClick={() => dispatch({ type: "revealAll" })}
              >
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
