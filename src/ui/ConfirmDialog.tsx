import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function Panel({ title, body, confirmLabel, cancelLabel, danger, requireText, onConfirm, onCancel }: Omit<ConfirmDialogProps, "open">) {
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const canConfirm = requireText === undefined || typed === requireText;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-raised"
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.fast * EXIT_RATIO } }}
      transition={spring.soft}
    >
      <h2 id={titleId} className="text-heading text-ink">
        {title}
      </h2>
      {body ? <p className="mt-2 text-body text-ink-muted">{body}</p> : null}
      {requireText !== undefined ? (
        <label className="mt-4 block">
          <span className="block text-caption text-ink-muted">{fr.ui.confirm.typeToConfirm(requireText)}</span>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label={fr.ui.confirm.inputLabel}
            className="mt-1 min-h-11 w-full rounded-sm border-2 border-line bg-bg px-3 text-body text-ink"
          />
        </label>
      ) : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} autoFocus={requireText === undefined}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} disabled={!canConfirm} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </motion.div>
  );
}

export function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <motion.div
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
            transition={{ duration: duration.fast }}
            onClick={rest.onCancel}
          />
          <Panel {...rest} />
        </div>
      ) : null}
    </AnimatePresence>
  );
}
