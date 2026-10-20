import type { Look } from "@/domain/types";
import { characterLayers, type Expression } from "@/ui/characterLayers";

/** The hero as stacked transparent SVG layers on a 120 x 160 canvas. Decorative: callers label it. */
export function Character({ look, size, expression = "idle" }: { look: Look; size: number; expression?: Expression }) {
  const ids = [look.character, look.aura, look.outfit, look.hat, look.accessory].filter((v): v is string => typeof v === "string");
  return (
    <span
      aria-hidden="true"
      data-look={ids.join(" ")}
      className="relative inline-block shrink-0"
      style={{ width: size, height: (size * 4) / 3 }}
    >
      {characterLayers(look, expression).map((l) => (
        <img
          key={l.slot}
          src={l.src}
          alt=""
          draggable={false}
          data-layer={l.slot}
          {...(l.slot === "face" ? { "data-expression": expression } : {})}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
      ))}
    </span>
  );
}
