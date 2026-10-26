import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { GachaPull, GachaPullItem, Look, Rarity } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { ease, HeroMedallion, tap } from "@/ui";
import cardBackSrc from "@/assets/gacha/card-back.svg?url";
import { CARD_RATIO, dealSchedule, REVEAL, type RevealState } from "@/features/shop/gachaReveal";

// The face-down cards of the gacha reveal (spec sound-and-reveal §5.3): one card, and the grid that deals them.

// The rarity seal and the frame of a turned card: wood, jade, vermilion lacquer, gold; the word carries the meaning.
export const SEAL: Record<Rarity, string> = {
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
/** Width of the one card of a x1. */
const SINGLE_CARD_W = 200;
/** A dealt card starts as wide as a stick (scaleX), then opens into its card. */
const STICK_WIDTH = 0.12;

export const nameOf = (id: string) => fr.shop.items[id]?.name ?? id;

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
      // aria-disabled, not disabled: the card keeps focus while it turns over (a disabled button drops it).
      aria-disabled={!enabled}
      onClick={() => {
        if (enabled) onFlip(index);
      }}
      {...(enabled ? { whileTap: tap } : {})}
      className={`relative block w-full rounded-md ${single ? "mx-auto" : ""}`}
      style={{ aspectRatio: `${CARD_RATIO}`, ...(single ? { maxWidth: SINGLE_CARD_W } : {}) }}
      // The sticks settle into cards: each one comes down as a narrow stick and widens into its card.
      initial={deal ? { opacity: 0, y: -24, scaleX: STICK_WIDTH } : false}
      animate={{ opacity: 1, y: 0, scaleX: 1 }}
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
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-paper px-2 pb-1.5 pt-3 text-center shadow-card ring-[3px] ring-inset ${RING[it.rarity]}`}
          initial={turning ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: half, delay: half, ease: ease.out }}
        >
          {/* The seal is stamped across the top edge, clear of the hero. */}
          <span className={`absolute -top-2.5 right-1 -rotate-6 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption font-semibold shadow-card ${SEAL[it.rarity]}`}>
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

export function CardGrid({ pull, state, dealing, onShown, lookFor, onFlip }: GridProps) {
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
    <div ref={ref} data-cards="" className={single ? "px-6 py-6" : "grid grid-cols-2 gap-x-3 gap-y-4 pb-1 pt-3"}>
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
