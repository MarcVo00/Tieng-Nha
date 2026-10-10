type AvatarProps = { emoji: string; size?: "sm" | "md" | "lg"; ring?: "none" | "gold" | "primary" };

const SIZE = { sm: "h-8 w-8 text-body", md: "h-12 w-12 text-heading", lg: "h-20 w-20 text-display" } as const;
const RING = { none: "", gold: "ring-2 ring-gold ring-offset-2 ring-offset-bg", primary: "ring-2 ring-primary ring-offset-2 ring-offset-bg" } as const;

export function Avatar({ emoji, size = "md", ring = "none" }: AvatarProps) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 leading-none ${SIZE[size]} ${RING[ring]}`}>
      {emoji}
    </span>
  );
}
