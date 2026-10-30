import { motion } from "motion/react";
import type { VocabId, VocabItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Card, Icon, tap } from "@/ui";

// « Les mots qui te résistent » (spec 2026-10-30): the words missed most since the last completion, left-aligned,
// Vietnamese first and big enough for the diacritics, the translation muted under it, one tap to hear it.
export function StuckWords({ ids, vocabIndex, onSpeak, canSpeak }: {
  ids: readonly VocabId[];
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  onSpeak: (vi: string) => void;
  canSpeak: boolean;
}) {
  const words = ids.flatMap((id) => {
    const w = vocabIndex.get(id);
    return w ? [w] : [];
  });
  if (words.length === 0) return null;
  return (
    <Card className="text-left">
      <h3 className="px-4 pt-3 text-caption text-ink-muted">{fr.lessons.stuck.wordsTitle}</h3>
      <ul className="divide-y divide-line">
        {words.map((w) => (
          <li key={w.id} className="flex items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span lang="vi" className="block break-words text-body-strong leading-relaxed text-ink">{w.vi}</span>
              <span className="block text-caption text-ink-muted">{w.fr}</span>
            </span>
            {canSpeak ? (
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => onSpeak(w.vi)}
                aria-label={fr.lessons.stuck.listen(w.vi)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary"
              >
                <Icon name="speaker" size={22} />
              </motion.button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
