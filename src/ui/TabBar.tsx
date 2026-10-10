import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon, type IconName } from "@/ui/icons";
import { spring, tap } from "@/ui/motion";

type TabBarProps = { items: Array<{ to: string; label: string; icon: IconName; badge?: number }> };

export function TabBar({ items }: TabBarProps) {
  return (
    <nav aria-label={fr.ui.nav.label} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink to={item.to} className="block">
              {({ isActive }) => (
                <motion.span
                  whileTap={tap}
                  transition={spring.snappy}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 ${isActive ? "text-primary" : "text-ink-muted"}`}
                >
                  <Icon name={item.icon} size={24} />
                  <span className="text-caption">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <>
                      <span aria-hidden="true" className="tabular absolute right-[calc(50%-1.75rem)] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                      <span className="sr-only">{item.badge > 99 ? fr.ui.nav.dueMany : fr.ui.nav.due(item.badge)}</span>
                    </>
                  ) : null}
                  {isActive ? <motion.span layoutId="tab-dot" transition={spring.snappy} className="absolute top-0.5 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </motion.span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
