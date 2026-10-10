import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { duration, spring, tap } from "@/ui/motion";

type SpeakerButtonProps = {
  onSpeak: () => void;
  onSpeakSlow?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  size?: "md" | "xl";
  playing?: boolean;
};

export function SpeakerButton({ onSpeak, onSpeakSlow, disabled = false, disabledReason, size = "md", playing = false }: SpeakerButtonProps) {
  const reduced = useReducedMotion();
  const dim = size === "xl" ? "h-[72px] w-[72px]" : "h-14 w-14";
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-3">
        <span className="relative inline-flex">
          {playing && !reduced
            ? [0, 1].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: duration.loop, repeat: Infinity, delay: i * 0.4 }}
                />
              ))
            : null}
          <motion.button
            type="button"
            aria-label={fr.ui.speaker.play}
            title={disabled ? disabledReason : undefined}
            disabled={disabled}
            onClick={onSpeak}
            whileTap={tap}
            transition={spring.snappy}
            className={`relative inline-flex items-center justify-center rounded-full bg-primary text-primary-on disabled:opacity-50 ${dim}`}
          >
            <Icon name="speaker" size={size === "xl" ? 36 : 28} />
          </motion.button>
        </span>
        {onSpeakSlow ? (
          <motion.button
            type="button"
            aria-label={fr.ui.speaker.slow}
            title={disabled ? disabledReason : undefined}
            disabled={disabled}
            onClick={onSpeakSlow}
            whileTap={tap}
            transition={spring.snappy}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-surface text-ink disabled:opacity-50"
          >
            <Icon name="turtle" size={24} />
          </motion.button>
        ) : null}
      </div>
      {disabled && disabledReason ? <span className="text-caption text-ink-muted">{disabledReason}</span> : null}
    </div>
  );
}
