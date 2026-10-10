import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { duration, ease, Icon, ReportButton, spring, tap } from "@/ui";

type MiniSpeakerProps = { onSpeak: () => void; disabled?: boolean };

/** Small replay button used inside bubbles and option cards. */
export function MiniSpeaker({ onSpeak, disabled = false }: MiniSpeakerProps) {
  return (
    <motion.button
      type="button"
      aria-label={fr.ui.speaker.play}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onSpeak();
      }}
      whileTap={tap}
      transition={spring.snappy}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary disabled:opacity-50"
    >
      <Icon name="speaker" size={20} />
    </motion.button>
  );
}

type BubbleProps = {
  speaker: "npc" | "user";
  vi: string;
  fr: string;
  onReplay: () => void;
  replayDisabled: boolean;
  onReport?: () => void;
};

// NPC bubbles sit left on `surface`, user bubbles right on `primary`. Each grows from its own corner.
export function Bubble({ speaker, vi, fr: translation, onReplay, replayDisabled, onReport }: BubbleProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const npc = speaker === "npc";
  return (
    <motion.li
      initial={reduced ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduced ? { duration: duration.fast } : spring.soft}
      className={`flex max-w-[85%] flex-col gap-1 ${npc ? "origin-bottom-left self-start" : "origin-bottom-right self-end"}`}
    >
      <div
        className={`rounded-md px-4 py-3 ${npc ? "rounded-bl-sm bg-surface text-ink shadow-card" : "rounded-br-sm bg-primary text-primary-on"}`}
      >
        <span className="sr-only">{npc ? fr.conversation.npc : fr.conversation.you}</span>
        <p lang="vi" className="break-words text-body-strong">
          {vi}
        </p>
        {npc ? (
          <div className="mt-1 flex items-center gap-1">
            {/* Both labels share one grid cell: the cell keeps the taller height, only opacity changes. */}
            <div className="grid flex-1">
              <motion.button
                type="button"
                aria-expanded={shown}
                aria-hidden={shown || undefined}
                tabIndex={shown ? -1 : 0}
                onClick={() => setShown(true)}
                initial={false}
                animate={{ opacity: shown ? 0 : 1 }}
                transition={{ duration: duration.fast, ease: ease.out }}
                className={`col-start-1 row-start-1 min-h-11 self-center text-left text-caption text-info underline ${shown ? "pointer-events-none" : ""}`}
              >
                {fr.conversation.translate}
              </motion.button>
              <motion.button
                type="button"
                title={fr.conversation.hideTranslation}
                aria-hidden={shown ? undefined : true}
                tabIndex={shown ? 0 : -1}
                onClick={() => setShown(false)}
                initial={false}
                animate={{ opacity: shown ? 1 : 0 }}
                transition={{ duration: duration.fast, ease: ease.out }}
                className={`col-start-1 row-start-1 min-h-11 self-center text-left text-caption text-ink-muted ${shown ? "" : "pointer-events-none"}`}
              >
                {translation}
              </motion.button>
            </div>
            <MiniSpeaker onSpeak={onReplay} disabled={replayDisabled} />
          </div>
        ) : null}
      </div>
      {npc && onReport ? (
        <div className="self-start">
          <ReportButton onClick={onReport} />
        </div>
      ) : null}
    </motion.li>
  );
}

/** Three bouncing dots, shown for 600 ms before each NPC line. */
export function TypingIndicator() {
  const reduced = useReducedMotion();
  return (
    <motion.li
      role="status"
      aria-label={fr.conversation.typing}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.fast }}
      className="flex origin-bottom-left items-center gap-1.5 self-start rounded-md rounded-bl-sm bg-surface px-4 py-4 shadow-card"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-ink-muted"
          animate={reduced ? { opacity: [0.3, 1, 0.3] } : { y: [0, -5, 0] }}
          transition={{ duration: duration.pulse, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </motion.li>
  );
}
