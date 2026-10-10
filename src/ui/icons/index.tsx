import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "home" | "review" | "trophy" | "user" | "close" | "check" | "cross" | "speaker" | "turtle" | "mic" | "stop"
  | "flag" | "chevron-right" | "chevron-left" | "lock" | "star" | "flame" | "refresh" | "settings" | "share"
  | "download" | "chat" | "play";

// 24x24 grid, 2px round strokes. Paths are drawn by hand; `flame` is the only filled glyph.
const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  review: <><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4.5v1.5A3 3 0 0 0 8 10.5" /><path d="M16 6h3.5v1.5a3 3 0 0 1-3.5 3" /><path d="M12 13v4" /><path d="M8.5 20h7" /><path d="M9.5 17h5v3h-5z" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  cross: <><path d="M7 7l10 10" /><path d="M17 7 7 17" /></>,
  speaker: <><path d="M4 10v4h3.5L12 18V6L7.5 10H4Z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" /><path d="M18 7a7 7 0 0 1 0 10" /></>,
  turtle: <><path d="M4.5 16c0-4 3-7 7-7s7 3 7 7H4.5Z" /><path d="M9 9.5 10 16" /><path d="M14 9.5 13 16" /><path d="M18.5 13.5c1.7-.4 2.5-1.5 2.5-2.7" /><path d="M7 16v2.5" /><path d="M16 16v2.5" /></>,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v2.5" /><path d="M9 20.5h6" /></>,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />,
  flag: <><path d="M6 21V4" /><path d="M6 4.5h11l-2 4 2 4H6" /></>,
  "chevron-right": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  "chevron-left": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14.5v2.5" /></>,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />,
  flame: <path d="M12.5 2.5c.4 3-1.2 4.6-2.8 6.4C8.3 10.5 7 12.2 7 14.8a5 5 0 0 0 10 0c0-2.1-.9-3.5-1.9-4.8-.3 1.4-1 2.2-1.8 2.6.5-3.4-.1-7.5-.8-10.1Z" fill="currentColor" />,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.5-5.6" /><path d="M19.5 4v4.5H15" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  share: <><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="6" r="2.5" /><circle cx="17.5" cy="18" r="2.5" /><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></>,
  chat: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16H11l-4.5 4v-4H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Z" />,
  play: <path d="M8 5.5v13l11-6.5L8 5.5Z" />,
};

type IconProps = { name: IconName; size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, "name" | "children" | "ref">;

export function Icon({ name, size = 24, className, ...rest }: IconProps) {
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
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
