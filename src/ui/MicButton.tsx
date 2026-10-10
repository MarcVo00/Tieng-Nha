import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { spring, tap } from "@/ui/motion";

type MicButtonProps = { state: "idle" | "listening" | "processing"; onPress: () => void; disabled?: boolean; label: string };

export function MicButton({ state, onPress, disabled = false, label }: MicButtonProps) {
  const reduced = useReducedMotion();
  const listening = state === "listening";
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <span className="relative inline-flex">
        {listening && !reduced
          ? [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
              />
            ))
          : null}
        <motion.button
          type="button"
          aria-label={label}
          aria-pressed={listening}
          aria-busy={state === "processing" || undefined}
          disabled={disabled || state === "processing"}
          onClick={onPress}
          whileTap={tap}
          transition={spring.snappy}
          className="relative inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary text-primary-on disabled:opacity-50"
        >
          {state === "processing" ? (
            <span className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-current"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          ) : (
            <Icon name={listening ? "stop" : "mic"} size={32} />
          )}
        </motion.button>
      </span>
      <span className="text-caption text-ink-muted" aria-hidden="true">
        {fr.ui.mic[state]}
      </span>
    </div>
  );
}
