import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { spring, tap } from "@/ui/motion";
import { ProgressBar } from "@/ui/ProgressBar";

type FocusHeaderProps = { progress?: number; onClose: () => void; closeLabel: string; right?: ReactNode };

export function FocusHeader({ progress, onClose, closeLabel, right }: FocusHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-5 py-3">
      <motion.button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        whileTap={tap}
        transition={spring.snappy}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted"
      >
        <Icon name="close" size={24} />
      </motion.button>
      <div className="flex-1">{progress === undefined ? null : <ProgressBar value={progress} label={fr.ui.progress.label} />}</div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
