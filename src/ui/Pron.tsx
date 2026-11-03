import { fr } from "@/i18n/fr";

/**
 * Reading aid under a target-language line (e.g. `sa·LA·mat`): a muted caption, for a French speaker.
 * Not tagged with the course language: it is French-readable respelling, not the language itself.
 * `onPrimary` is for a line sitting on the red lacquer (the learner's chat bubble).
 */
export function Pron({ text, onPrimary = false }: { text?: string | undefined; onPrimary?: boolean }) {
  if (!text) return null;
  return (
    <p aria-label={fr.ui.pron.label(text)} className={`text-caption tracking-wide ${onPrimary ? "text-primary-on opacity-80" : "text-ink-muted"}`}>
      {text}
    </p>
  );
}
