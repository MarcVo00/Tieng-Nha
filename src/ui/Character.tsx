import type { Look } from "@/domain/types";
import { characterLayers } from "@/ui/characterLayers";

/** The hero as stacked transparent SVG layers on a 120 x 160 canvas. Decorative: callers label it. */
export function Character({ look, size }: { look: Look; size: number }) {
  const ids = [look.aura, look.outfit, look.hat, look.accessory].filter((v): v is string => typeof v === "string");
  return (
    <span
      aria-hidden="true"
      data-look={ids.join(" ")}
      className="relative inline-block shrink-0"
      style={{ width: size, height: (size * 4) / 3 }}
    >
      {characterLayers(look).map((l) => (
        <img key={l.slot} src={l.src} alt="" draggable={false} data-layer={l.slot} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      ))}
    </span>
  );
}
