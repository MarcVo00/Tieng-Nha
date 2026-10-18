import type { Look } from "@/domain/types";
import { Character } from "@/ui/Character";

/** The hero on the paper medallion (art direction §3): outlines stay readable in the dark theme. `size` is the diameter in px. */
export function HeroMedallion({ look, size, label }: { look: Look; size: number; label?: string }) {
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : {})}
      className={`inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-paper pb-[3%] ring-gold ${size >= 160 ? "ring-[3px]" : "ring-2"}`}
      style={{ width: size, height: size }}
    >
      <Character look={look} size={Math.round(size * 0.62)} />
    </span>
  );
}
