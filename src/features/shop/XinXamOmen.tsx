import { motion } from "motion/react";
import { duration, ease } from "@/ui";
import lanternSrc from "@/assets/gacha/lantern.svg?url";
import { ALTAR, EPIC_OMEN, LEGENDARY_OMEN, MOUTH, REVEAL, STAGE } from "@/features/shop/gachaReveal";

// The omen layers of the gacha reveal (spec sound-and-reveal §5.2), and the static gold rays the focus view reuses.

const RAYS = 12;
const RAY_BOX = 248;
/** Epic lanterns: drawn size (art 48 x 76) and their glow. */
const LANTERN = { w: 40, h: Math.round((40 * 76) / 48), inset: 22, glow: 112 } as const;

/** Static gold rays: one path of 12 strokes, only its opacity moves. */
export function GoldRays({ x, y, delay = 0, length = REVEAL.raysIn }: { x: number; y: number; delay?: number; length?: number }) {
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
export function JadeGlow() {
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
export function Lanterns() {
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
export function GoldFlood() {
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
