import { useId } from "react";

type MotifProps = { kind: "waves" | "scales" | "clouds"; className?: string };

// Decorative lacquer-inspired patterns, kept at <= 8 % opacity.
export function Motif({ kind, className }: MotifProps) {
  const id = useId();
  const patternId = `motif-${kind}-${id}`;
  return (
    <svg className={`pointer-events-none h-full w-full opacity-[0.07] ${className ?? ""}`} aria-hidden="true" focusable="false">
      <defs>
        {kind === "waves" ? (
          <pattern id={patternId} width="48" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 18c6-12 18-12 24 0s18 12 24 0M0 6c6-12 18-12 24 0s18 12 24 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </pattern>
        ) : kind === "scales" ? (
          <pattern id={patternId} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 20a20 20 0 0 1 40 0M-20 10a20 20 0 0 1 40 0M20 10a20 20 0 0 1 40 0" fill="none" stroke="currentColor" strokeWidth="2" />
          </pattern>
        ) : (
          <pattern id={patternId} width="80" height="40" patternUnits="userSpaceOnUse">
            <path d="M8 30a8 8 0 0 1 4-14 10 10 0 0 1 18-2 8 8 0 0 1 10 16Z M48 18a6 6 0 0 1 3-10 8 8 0 0 1 14-1 6 6 0 0 1 8 11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
