type AvatarProps = {
  emoji: string;
  size?: "sm" | "md" | "lg";
  ring?: "none" | "gold" | "primary";
  /** Equipped shop frame id. A known frame replaces `ring`; unknown or null leaves the avatar unchanged. */
  frame?: string | null | undefined;
};

const SIZE = { sm: "h-8 w-8 text-body", md: "h-12 w-12 text-heading", lg: "h-20 w-20 text-display" } as const;
const RING = { none: "", gold: "ring-2 ring-gold ring-offset-2 ring-offset-bg", primary: "ring-2 ring-primary ring-offset-2 ring-offset-bg" } as const;
const FRAME_BASE = "ring-[3px] ring-offset-2 ring-offset-bg";
// Son mai: gold ring plus a 1 px ink line on the inside edge, like an inlaid lacquer border.
const FRAME = {
  frame_bronze: `${FRAME_BASE} ring-frame-bronze`,
  frame_jade: `${FRAME_BASE} ring-frame-jade`,
  frame_son_mai: `${FRAME_BASE} ring-frame-sonmai border border-ink`,
} as const;

const isFrame = (id: string | null | undefined): id is keyof typeof FRAME => id != null && Object.hasOwn(FRAME, id);

export function Avatar({ emoji, size = "md", ring = "none", frame }: AvatarProps) {
  const decoration = isFrame(frame) ? FRAME[frame] : RING[ring];
  return (
    <span
      aria-hidden="true"
      {...(isFrame(frame) ? { "data-frame": frame } : {})}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 leading-none ${SIZE[size]} ${decoration}`}
    >
      {emoji}
    </span>
  );
}
