import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";

type StreakFlameProps = { days: number; size?: "sm" | "md" };

export function StreakFlame({ days, size = "md" }: StreakFlameProps) {
  const lit = days > 0;
  return (
    <span role="img" aria-label={fr.ui.streak(days)} className={`inline-flex items-center gap-1 ${size === "md" ? "text-heading" : "text-body-strong"} ${lit ? "text-ink" : "text-ink-muted"}`}>
      <Icon name="flame" size={size === "md" ? 28 : 20} className={lit ? "text-streak" : "text-line"} />
      <span className="tabular" aria-hidden="true">
        {days}
      </span>
    </span>
  );
}
