import { useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { tap } from "@/ui/motion";

export type BannerTab = { id: string; label: string };

type Props = {
  label: string;
  tabs: readonly BannerTab[];
  current: string;
  /** Locked while a request runs (like every other control of the screen). */
  disabled: boolean;
  onSelect: (id: string) => void;
};

export const tabIdOf = (theme: string) => `gacha-tab-${theme}`;
export const panelIdOf = (theme: string) => `gacha-panel-${theme}`;

// The banners of one screen behind one control: the SegmentedNav look (a recessed track, the chosen one raised on it),
// but tabs, not links. Arrow keys move and select at once (roving tabindex), Home/End jump to the ends.
export function BannerTabs({ label, tabs, current, disabled, onSelect }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    const tab = next === null ? undefined : tabs[next];
    if (next === null || !tab) return;
    e.preventDefault();
    refs.current[next]?.focus();
    if (!disabled) onSelect(tab.id);
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-surface-2 p-1">
      {tabs.map((t, i) => {
        const active = t.id === current;
        return (
          <motion.button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabIdOf(t.id)}
            aria-selected={active}
            aria-controls={panelIdOf(t.id)}
            tabIndex={active ? 0 : -1}
            disabled={disabled && !active}
            {...(disabled ? {} : { whileTap: tap })}
            onClick={() => !active && onSelect(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex min-h-11 min-w-0 flex-1 items-center justify-center text-balance rounded-full px-1.5 py-1 text-center text-caption font-semibold leading-tight min-[360px]:px-2 min-[360px]:text-body-strong ${
              active ? "bg-surface text-primary shadow-card" : "text-ink-muted disabled:opacity-60"
            }`}
          >
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}
