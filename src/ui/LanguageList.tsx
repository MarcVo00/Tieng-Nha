import { motion } from "motion/react";
import { LANGUAGE_IDS, LANGUAGES, type LanguageId } from "@/domain/languages";
import { Icon } from "@/ui/icons";
import { tap } from "@/ui/motion";
import { LanguageEmblem } from "@/ui/LanguageEmblem";

type LanguageListProps = {
  /** The highlighted language: the active one, or the preselected Vietnamese before any choice. */
  current: LanguageId;
  onPick: (id: LanguageId) => void;
  disabled?: boolean;
  className?: string;
};

// One tile per language. Hero of each tile: the language's own name, in its language. The current one wears the
// lacquer-red edge and a check; nothing is saved until a tile is tapped.
export function LanguageList({ current, onPick, disabled = false, className }: LanguageListProps) {
  return (
    <ul className={`flex flex-col gap-3 ${className ?? ""}`}>
      {LANGUAGE_IDS.map((id) => {
        const lang = LANGUAGES[id];
        const active = id === current;
        return (
          <li key={id}>
            <motion.button
              type="button"
              aria-current={active ? "true" : undefined}
              disabled={disabled}
              whileTap={tap}
              onClick={() => onPick(id)}
              className={`flex min-h-20 w-full items-center gap-4 rounded-md border-2 bg-surface p-4 text-left shadow-card disabled:opacity-60 ${
                active ? "border-primary" : "border-line"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary text-primary-on" : "bg-surface-2 text-ink"}`}
              >
                <LanguageEmblem id={id} size={30} />
              </span>
              <span className="min-w-0 flex-1">
                <span lang={lang.htmlLang} className="block text-heading text-ink">
                  {lang.nameNative}
                </span>
                <span className="block text-body-strong text-ink">{lang.nameFr}</span>
                <span className="block text-caption text-ink-muted">{lang.purposeFr}</span>
              </span>
              {active ? <Icon name="check" size={24} className="shrink-0 text-primary" /> : null}
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}
