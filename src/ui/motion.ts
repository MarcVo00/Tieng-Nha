// Motion tokens — values from docs/design-system.md §6. Animate only transform/opacity.
export const duration = { instant: 0.08, fast: 0.15, base: 0.22, slow: 0.36, celebrate: 0.8 } as const; // seconds
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.55, 0, 1, 0.45],
} as const;
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 34 },
  soft: { type: "spring", stiffness: 260, damping: 28 },
  bouncy: { type: "spring", stiffness: 420, damping: 16 },
} as const;
export const tap = { scale: 0.97 } as const;
// Exit runs at ~70 % of the entrance duration (design-system §6.1 rule 2).
export const EXIT_RATIO = 0.7;
