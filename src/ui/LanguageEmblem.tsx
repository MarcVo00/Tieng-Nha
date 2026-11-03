import type { ReactNode } from "react";
import type { LanguageId } from "@/domain/languages";

// Same grid and stroke as src/ui/icons: 24x24, 2px round strokes, drawn by hand. No flags.
const PATHS: Record<LanguageId, ReactNode> = {
  // Nón lá: the palm-leaf cone, its curved brim and the chin strap.
  vi: (
    <>
      <path d="M3.5 14.5 12 4l8.5 10.5" />
      <path d="M2.5 14.5c4.5 2.6 14.5 2.6 19 0" />
      <path d="M8 13.2 12 4.6l4 8.6" opacity={0.55} />
      <path d="M9 17.4c1.2 2.1 4.8 2.1 6 0" />
    </>
  ),
  // Jeepney: long body with a sloped bonnet, roof rack, window belt, two wheels.
  tl: (
    <>
      <path d="M5.5 17H3.5V9a2 2 0 0 1 2-2h9.5l3.5 4.5h1a1 1 0 0 1 1 1V17h-2" />
      <path d="M9.5 17h5" />
      <path d="M3.5 11.5h15" />
      <path d="M9.5 7v4.5" />
      <path d="M6 4.5h8.5" />
      <path d="M7.5 4.5V7M13 4.5V7" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
    </>
  ),
};

/** Emblem of a language (nón lá, jeepney), drawn in `currentColor`. Decorative: the name always sits next to it. */
export function LanguageEmblem({ id, size = 24, className }: { id: LanguageId; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-emblem={id}
    >
      {PATHS[id]}
    </svg>
  );
}
