import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";
import { useFocusTrap } from "@/ui/useFocusTrap";

type SheetProps = { open: boolean; onClose?: () => void; children?: ReactNode; label: string; tone?: "neutral" | "success" | "error" };

const TONE = { neutral: "bg-surface", success: "bg-success-soft", error: "bg-error-soft" } as const;

function Layer({ onClose, children, label, tone }: Omit<SheetProps, "open"> & { tone: NonNullable<SheetProps["tone"]> }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);
  return (
    <div className="fixed inset-0 z-40">
      <motion.div
        className="absolute inset-0 bg-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
        transition={{ duration: duration.fast }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-lg pb-[env(safe-area-inset-bottom)] shadow-raised outline-none ${TONE[tone]}`}
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
  );
}

// Portalled to <body>: a sheet opened while its page is still sliding in would otherwise be fixed to the moving page
// (a transformed ancestor) and stack under the tab bar.
export function Sheet({ open, onClose, children, label, tone = "neutral" }: SheetProps) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <Layer {...(onClose ? { onClose } : {})} label={label} tone={tone}>
          {children}
        </Layer>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
