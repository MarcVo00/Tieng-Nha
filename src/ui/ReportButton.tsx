import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { spring, tap } from "@/ui/motion";

type ReportButtonProps = { onClick: () => void };

export function ReportButton({ onClick }: ReportButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={fr.ui.report.aria}
      onClick={onClick}
      whileTap={tap}
      transition={spring.snappy}
      className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-3 text-caption text-ink-muted"
    >
      <Icon name="flag" size={18} />
      <span>{fr.ui.report.label}</span>
    </motion.button>
  );
}
