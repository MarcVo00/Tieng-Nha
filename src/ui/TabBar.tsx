import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon, type IconName } from "@/ui/icons";
import { spring, tap } from "@/ui/motion";

export type TabItem = {
  to: string;
  label: string;
  icon: IconName;
  /** Count shown in a round badge. */
  badge?: number;
  /** Spoken version of the badge (defaults to « n à réviser »). */
  badgeLabel?: string;
  /** A small unlabeled dot (something new to look at). */
  dot?: boolean;
  dotLabel?: string;
  /** Extra path prefixes that keep this tab active (e.g. /duels under « Arène »). */
  alsoActiveOn?: string[];
};

type TabBarProps = { items: TabItem[] };

const under = (pathname: string, prefix: string): boolean =>
  prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);

export function TabBar({ items }: TabBarProps) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label={fr.ui.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const isActive =
            under(pathname, item.to) || (item.alsoActiveOn ?? []).some((p) => under(pathname, p));
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <Link to={item.to} className="block" aria-current={isActive ? "page" : undefined}>
                {(() => {
                  const count = item.badge ?? 0;
                  return (
                    <motion.span
                      whileTap={tap}
                      transition={spring.snappy}
                      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 ${isActive ? "text-primary" : "text-ink-muted"}`}
                    >
                      <Icon name={item.icon} size={24} />
                      <span className="whitespace-nowrap text-caption tracking-tighter min-[360px]:tracking-tight">{item.label}</span>
                      {count > 0 ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="tabular absolute right-[calc(50%-1.5rem)] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on"
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                          <span className="sr-only">
                            {item.badgeLabel ?? (count > 99 ? fr.ui.nav.dueMany : fr.ui.nav.due(count))}
                          </span>
                        </>
                      ) : null}
                      {item.dot ? (
                        <>
                          <span
                            aria-hidden="true"
                            data-testid="tab-dot"
                            className="absolute right-[calc(50%-1.1rem)] top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary"
                          />
                          {item.dotLabel ? <span className="sr-only">{item.dotLabel}</span> : null}
                        </>
                      ) : null}
                      {isActive ? (
                        <motion.span
                          layoutId="tab-dot"
                          transition={spring.snappy}
                          className="absolute top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </motion.span>
                  );
                })()}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
