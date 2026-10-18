import type { Look } from "@/domain/types";
import { Character } from "@/ui/Character";
import { isProfileFx, ProfileFx } from "@/ui/ProfileFx";

type AvatarProps = {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: "none" | "gold" | "primary";
  /** Equipped shop frame id. A known frame replaces `ring`; unknown or null leaves the avatar unchanged. */
  frame?: string | null | undefined;
  /** Equipped profile effect id (fx_*). A known effect wraps the avatar; unknown or null leaves it unchanged. */
  fx?: string | null | undefined;
  /** Equipped hero look. When set, the circle shows the hero (head and hat) instead of the emoji; with size "xl" it shows the whole body. */
  look?: Look | undefined;
  /** Freeze the profile effect in its static pose (locked previews). */
  still?: boolean;
};

const SIZE = { sm: "h-8 w-8 text-body", md: "h-12 w-12 text-heading", lg: "h-20 w-20 text-display", xl: "h-40 w-40 text-display" } as const;
const DIAMETER = { sm: 32, md: 48, lg: 80, xl: 160 } as const;
/** Width of the full-body hero inside the xl medallion, as a share of its diameter (same as HeroMedallion). */
const XL_BODY = 0.62;
const RING = { none: "", gold: "ring-2 ring-gold ring-offset-2 ring-offset-bg", primary: "ring-2 ring-primary ring-offset-2 ring-offset-bg" } as const;
const FRAME_BASE = "ring-[3px] ring-offset-2 ring-offset-bg";
// Son mai: gold ring plus a 1 px ink line on the inside edge, like an inlaid lacquer border.
const FRAME = {
  frame_bronze: `${FRAME_BASE} ring-frame-bronze`,
  frame_jade: `${FRAME_BASE} ring-frame-jade`,
  frame_son_mai: `${FRAME_BASE} ring-frame-sonmai border border-ink`,
} as const;

const isFrame = (id: string | null | undefined): id is keyof typeof FRAME => id != null && Object.hasOwn(FRAME, id);

export function Avatar({ emoji, size = "md", ring = "none", frame, fx, look, still = false }: AvatarProps) {
  const decoration = isFrame(frame) ? FRAME[frame] : RING[ring];
  const d = DIAMETER[size];
  const cw = d * 1.3;
  const whole = size === "xl" && look !== undefined;
  const avatar = (
    <span
      aria-hidden="true"
      {...(isFrame(frame) ? { "data-frame": frame } : {})}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${look ? `relative overflow-hidden bg-paper ${whole ? "items-end pb-[3%]" : ""}` : "bg-surface-2"} leading-none ${SIZE[size]} ${decoration}`}
    >
      {look && whole ? (
        <Character look={look} size={Math.round(d * XL_BODY)} />
      ) : look ? (
        <span className="absolute" style={{ left: (d - cw) / 2, top: d * 0.5 - cw * (4 / 3) * 0.4375 }}>
          <Character look={look} size={cw} />
        </span>
      ) : (
        emoji
      )}
    </span>
  );
  return isProfileFx(fx) ? <ProfileFx id={fx} still={still}>{avatar}</ProfileFx> : avatar;
}

/** Margin that leaves room for the effect layer (it spills 40 % of the avatar on every side: 32 px for `lg`, 64 px for `xl`, where the room is mostly above and below). One place for « Moi » and public profiles. */
export const fxSpill = (fx: string | null | undefined, size: "lg" | "xl" = "lg"): string =>
  isProfileFx(fx) ? (size === "xl" ? "my-12 mx-auto" : "my-8 ml-8 mr-5") : "";
