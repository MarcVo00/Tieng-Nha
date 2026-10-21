import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { tap } from "@/ui/motion";

export type SegmentItem = { to: string; label: string; badge?: number; badgeLabel?: string };

type SegmentedNavProps = { label: string; items: SegmentItem[]; current: string; className?: string };

// Sibling screens behind one control. Links, not buttons: each segment is its own route.
export function SegmentedNav({ label, items, current, className = "" }: SegmentedNavProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex list-none gap-1 rounded-full bg-surface-2 p-1">
        {items.map((item) => {
          const active = item.to === current;
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <motion.div whileTap={tap}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-body-strong ${
                    active ? "bg-surface text-primary shadow-card" : "text-ink-muted"
                  }`}
                >
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on"
                      >
                        {item.badge}
                      </span>
                      {item.badgeLabel ? <span className="sr-only">{item.badgeLabel}</span> : null}
                    </>
                  ) : null}
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
