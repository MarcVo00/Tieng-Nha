import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { DAILY_BONUS } from "@/services/wallet";
import { Button, Card, Sheet, duration, ease, spring, tap } from "@/ui";

// Daily bonus (spec 2026-10-29 §4). Hero: the red envelope. One action: « Ouvrir », then « Continuer ».
// Secondary: the 7-day run under it. The amount rises out of the envelope in gold once opened.

export type DailyBonusOffer = { day: number; coins: number };
type EnvelopeLook = "lacquer" | "spent" | "ahead";

const FILL: Record<EnvelopeLook, { body: string; flap: string; seal: string }> = {
  lacquer: { body: "fill-primary", flap: "fill-primary-hover", seal: "fill-gold" },
  spent: { body: "fill-gold", flap: "fill-gold-ink", seal: "fill-surface" },
  ahead: { body: "fill-surface-2", flap: "fill-line", seal: "fill-surface" },
};

function Seal({ cy, look }: { cy: number; look: EnvelopeLook }) {
  return (
    <>
      <circle cx="48" cy={cy} r="11" className={FILL[look].seal} />
      <rect x="44" y={cy - 4} width="8" height="8" rx="1" fill="none" className={look === "lacquer" ? "stroke-primary-hover" : "stroke-ink-muted"} strokeWidth="2" />
    </>
  );
}

/**
 * A lì xì envelope: lacquer body, folded flap with a gold seal. `open` fades the folded flap out while the raised one
 * rises in above the body (opacity + translate only: no transform origin to get wrong on SVG).
 */
function Envelope({ size, look, open = false, reduced = false }: { size: number; look: EnvelopeLook; open?: boolean; reduced?: boolean }) {
  const f = FILL[look];
  const fade = reduced ? { duration: duration.base } : { duration: duration.slow, ease: ease.out };
  return (
    <svg viewBox="0 -40 96 168" width={size} height={(size * 168) / 96} aria-hidden="true" focusable="false" className="overflow-visible">
      <rect x="8" y="16" width="80" height="104" rx="6" className={f.body} />
      <rect x="8" y="114" width="80" height="6" rx="3" className={f.flap} opacity={0.7} />
      {look === "lacquer" ? <rect x="15" y="23" width="66" height="90" rx="3" fill="none" className="stroke-gold" strokeWidth="1.5" opacity={0.7} /> : null}
      <motion.g initial={false} animate={{ opacity: open ? 0 : 1 }} transition={fade}>
        <path d="M8 22a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6L52 58a6 6 0 0 1-8 0Z" className={f.flap} />
        <Seal cy={54} look={look} />
      </motion.g>
      {open ? (
        <motion.g initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={fade}>
          <path d="M8 16 44 -18a6 6 0 0 1 8 0L88 16Z" className={f.flap} />
          <Seal cy={-12} look={look} />
        </motion.g>
      ) : null}
    </svg>
  );
}

/** The 7 envelopes of the run: opened ones in gold, today's lit, the 7th a little bigger. */
function RunStrip({ today, todayOpened }: { today: number; todayOpened: boolean }) {
  return (
    <ol className="flex items-end justify-between" aria-label={fr.home.bonus.run}>
      {DAILY_BONUS.map((coins, i) => {
        const day = i + 1;
        const state = day < today || (day === today && todayOpened) ? "spent" : day === today ? "today" : "ahead";
        return (
          <li key={day} className="flex flex-col items-center gap-1" aria-label={fr.home.bonus.dayAria(day, coins, state)}>
            <span className={`rounded-sm p-1 ${state === "today" ? "outline outline-2 outline-gold" : ""}`}>
              <Envelope size={day === 7 ? 30 : 22} look={state === "today" ? "lacquer" : state} />
            </span>
            <span aria-hidden="true" className={`tabular text-caption ${state === "ahead" ? "text-ink-muted" : "text-gold-ink"}`}>{coins}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Word({ lower = false }: { lower?: boolean }) {
  return <span lang="vi">{lower ? fr.home.bonus.word.toLowerCase() : fr.home.bonus.word}</span>;
}

/** Top-of-home card while today's envelope is still closed. */
export function DailyBonusCard({ offer, onOpen }: { offer: DailyBonusOffer; onOpen: () => void }) {
  return (
    <motion.div whileTap={tap} className="mb-3">
      <Card raised>
        <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center gap-3 p-4 text-left">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center">
            <Envelope size={26} look="lacquer" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-strong text-ink">
              {fr.home.bonus.cardBefore} <Word lower /> {fr.home.bonus.cardAfter}
            </span>
            <span className="block text-caption tabular-nums text-gold-ink">{fr.home.bonus.dayLine(offer.day, offer.coins)}</span>
          </span>
        </button>
      </Card>
    </motion.div>
  );
}

/** The sheet: open the envelope (one claim), watch the xu rise, continue. */
export function DailyBonusSheet({ offer, onClose, onClaim }: { offer: DailyBonusOffer | null; onClose: () => void; onClaim: () => Promise<boolean> }) {
  const reduced = useReducedMotion() ?? false;
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    onClose();
    setOpened(false);
    setFailed(false);
  };
  const open = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await onClaim().catch(() => false);
    setBusy(false);
    if (ok) setOpened(true);
    else setFailed(true);
  };

  const title = (
    <>
      <Word /> {fr.home.bonus.titleAfter}
    </>
  );
  return (
    <Sheet open={offer !== null} onClose={close} label={`${fr.home.bonus.word} ${fr.home.bonus.titleAfter}`}>
      {offer ? (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-heading text-ink">{title}</h2>
            <p className="text-caption tabular-nums text-ink-muted">{fr.home.bonus.dayLine(offer.day, offer.coins)}</p>
          </div>
          <div className="relative flex h-56 items-end justify-center">
            {opened ? (
              <motion.p
                className="absolute top-0 text-center"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { duration: duration.base } : { ...spring.bouncy, delay: duration.fast }}
                aria-live="polite"
              >
                <span className="tabular block text-display text-gold-ink">{fr.home.bonus.gained(offer.coins)}</span>
              </motion.p>
            ) : null}
            <Envelope size={96} look="lacquer" open={opened} reduced={reduced} />
          </div>
          {opened ? (
            <p className="text-center">
              <span lang="vi" className="block text-body-strong text-ink">{fr.home.bonus.wish}</span>
              <span className="block text-caption text-ink-muted">{fr.home.bonus.wishFr}</span>
            </p>
          ) : (
            <p className="text-caption text-ink-muted">{fr.home.bonus.hint}</p>
          )}
          <RunStrip today={offer.day} todayOpened={opened} />
          {failed ? <p role="alert" className="text-caption text-error">{fr.home.bonus.failed}</p> : null}
          {opened ? (
            <Button variant="primary" size="lg" fullWidth onClick={close}>{fr.home.bonus.continue}</Button>
          ) : (
            <Button variant="primary" size="lg" fullWidth loading={busy} onClick={open}>{fr.home.bonus.open}</Button>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
