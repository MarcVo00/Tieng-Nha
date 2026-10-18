import { isProfileFx, ProfileFx } from "@/ui/ProfileFx";

type AvatarProps = {
  emoji: string;
  size?: "sm" | "md" | "lg";
  ring?: "none" | "gold" | "primary";
  /** Equipped shop frame id. A known frame replaces `ring`; unknown or null leaves the avatar unchanged. */
  frame?: string | null | undefined;
  /** Equipped profile effect id (fx_*). A known effect wraps the avatar; unknown or null leaves it unchanged. */
  fx?: string | null | undefined;
  /** Freeze the profile effect in its static pose (locked previews). */
  still?: boolean;
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

export function Avatar({ emoji, size = "md", ring = "none", frame, fx, still = false }: AvatarProps) {
  const decoration = isFrame(frame) ? FRAME[frame] : RING[ring];
  const avatar = (
    <span
      aria-hidden="true"
      {...(isFrame(frame) ? { "data-frame": frame } : {})}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 leading-none ${SIZE[size]} ${decoration}`}
    >
      {emoji}
    </span>
  );
  return isProfileFx(fx) ? <ProfileFx id={fx} still={still}>{avatar}</ProfileFx> : avatar;
}

/** Margin that leaves room for the effect layer (it spills 40 % of a `lg` avatar, 32 px, on every side). One place for « Moi » and public profiles. */
export const fxSpill = (fx: string | null | undefined): string => (isProfileFx(fx) ? "my-8 ml-8 mr-5" : "");
