import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { duration, spring, tap } from "@/ui/motion";

export type ChoiceOption = { id: string; label: string; lang?: "vi" | "fr"; sub?: string };

type ChoiceGridProps = {
  options: ChoiceOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
  correctId?: string | null;
  wrongId?: string | null;
  /** Optional control rendered beside an option (never nested in the option button). */
  accessory?: (id: string) => ReactNode;
};

function stateClass(id: string, selected: string | null, correctId: string | null, wrongId: string | null): string {
  if (id === correctId) return "border-success bg-success-soft";
  if (id === wrongId) return "border-error bg-error-soft";
  if (id === selected) return "border-primary bg-surface";
  return "border-line bg-surface";
}

// One tile per option, stacked full-width: the answer is a thumb-sized target, not a radio dot.
export function ChoiceGrid({ options, selected, onSelect, disabled, correctId = null, wrongId = null, accessory }: ChoiceGridProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const isCorrect = o.id === correctId;
        const isWrong = o.id === wrongId;
        const extra = accessory?.(o.id);
        return (
          <div key={o.id} className="flex items-center gap-2">
            <motion.button
              type="button"
              disabled={disabled}
              aria-pressed={o.id === selected}
              onClick={() => onSelect(o.id)}
              whileTap={tap}
              animate={isCorrect && selected === o.id ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={isCorrect ? { duration: duration.base } : spring.snappy}
              className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md border-2 border-b-4 px-4 py-3 text-left disabled:cursor-default ${stateClass(o.id, selected, correctId, wrongId)}`}
            >
              <span className="min-w-0 flex-1">
                <span {...(o.lang ? { lang: o.lang } : {})} className="block text-body-strong text-ink">
                  {o.label}
                </span>
                {o.sub ? <span className="block text-caption text-ink-muted">{o.sub}</span> : null}
              </span>
              {isCorrect || isWrong ? (
                <span className={isCorrect ? "text-success" : "text-error"}>
                  <Icon name={isCorrect ? "check" : "cross"} size={22} />
                  <span className="sr-only">{isCorrect ? fr.exercises.correctChoice : fr.exercises.wrongChoice}</span>
                </span>
              ) : null}
            </motion.button>
            {extra}
          </div>
        );
      })}
    </div>
  );
}
