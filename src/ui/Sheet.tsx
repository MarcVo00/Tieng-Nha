import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";

type SheetProps = { open: boolean; onClose?: () => void; children?: ReactNode; label: string; tone?: "neutral" | "success" | "error" };

const TONE = { neutral: "bg-surface", success: "bg-success-soft", error: "bg-error-soft" } as const;

export function Sheet({ open, onClose, children, label, tone = "neutral" }: SheetProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
            transition={{ duration: duration.fast }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={label}
            className={`absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-lg pb-[env(safe-area-inset-bottom)] shadow-raised ${TONE[tone]}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring.soft}
            drag={onClose ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (onClose && info.offset.y > 120) onClose();
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="px-5 pb-5 pt-3">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
