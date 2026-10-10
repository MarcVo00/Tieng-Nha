import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";

export type ToastInput = { title: string; body?: string; icon?: string };
type ToastItem = ToastInput & { id: number };
type ToastStore = { toasts: ToastItem[]; show: (t: ToastInput) => void; dismiss: (id: number) => void };

const AUTO_DISMISS_MS = 3500;
let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function useToast(): { show: (t: ToastInput) => void } {
  const show = useToastStore((s) => s.show);
  return { show };
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  return (
    <motion.div
      layout
      role="status"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0, y: -24, transition: { duration: duration.fast * EXIT_RATIO } }}
      transition={spring.soft}
      className="pointer-events-auto flex items-center gap-3 rounded-md bg-surface p-3 pr-2 shadow-raised"
    >
      {toast.icon ? (
        <motion.span
          aria-hidden="true"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring.bouncy}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-surface-2 text-title leading-none"
        >
          {toast.icon}
        </motion.span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-body-strong text-ink">{toast.title}</span>
        {toast.body ? <span className="block text-caption text-ink-muted">{toast.body}</span> : null}
      </span>
      <button type="button" aria-label={fr.ui.toast.dismiss} onClick={() => dismiss(toast.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted">
        <Icon name="close" size={20} />
      </button>
    </motion.div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-md flex-col gap-2 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
