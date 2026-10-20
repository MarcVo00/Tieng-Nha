import type { Look } from "@/domain/types";
import { Character } from "@/ui/Character";
import type { Expression } from "@/ui/characterLayers";

/** From this diameter (px) the ring is drawn thicker. */
const THICK_RING_FROM = 160;

type HeroMedallionProps = {
  look: Look;
  /** Diameter in px. */
  size: number;
  label?: string;
  /** Gold = earned (the hero owns every piece shown); neutral = a preview of something not owned yet. */
  ring?: "gold" | "neutral";
  expression?: Expression;
};

/** The hero on the paper medallion (art direction §3): outlines stay readable in the dark theme. */
export function HeroMedallion({ look, size, label, ring = "gold", expression = "idle" }: HeroMedallionProps) {
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : {})}
      className={`inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-paper pb-[3%] ${ring === "gold" ? "ring-gold" : "ring-line"} ${size >= THICK_RING_FROM ? "ring-[3px]" : "ring-2"}`}
      style={{ width: size, height: size }}
    >
      <Character look={look} size={Math.round(size * 0.62)} expression={expression} />
    </span>
  );
}
