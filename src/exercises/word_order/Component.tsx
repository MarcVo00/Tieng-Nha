import { useMemo, useState, type FC } from "react";
import { motion } from "motion/react";
import type { Exercise } from "@/domain/types";
import type { ExerciseProps } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { createRng, shuffle } from "@/services/random";
import { Button, spring, tap } from "@/ui";

type WordOrder = Extract<Exercise, { type: "word_order" }>;
type Tile = { key: string; text: string };

// Hero: the French sentence + the answer line being built. Secondary: the tile bank. One action: Vérifier.
export const Component: FC<ExerciseProps<WordOrder>> = ({ exercise, disabled, onAnswer, seed }) => {
  // Keys are index-based: tokens can repeat, so text is not a usable identity.
  const bank = useMemo(() => {
    const tiles: Tile[] = [...exercise.tokensVi, ...(exercise.extraTokens ?? [])].map((text, i) => ({ key: `tile-${i}`, text }));
    return shuffle(tiles, createRng(seed));
  }, [exercise.tokensVi, exercise.extraTokens, seed]);
  const [answerKeys, setAnswerKeys] = useState<string[]>([]);

  const byKey = useMemo(() => new Map(bank.map((t) => [t.key, t])), [bank]);
  const answer = answerKeys.flatMap((k) => {
    const tile = byKey.get(k);
    return tile ? [tile] : [];
  });
  const remaining = bank.filter((t) => !answerKeys.includes(t.key));

  const add = (key: string) => setAnswerKeys((keys) => (keys.includes(key) ? keys : [...keys, key]));
  const remove = (key: string) => setAnswerKeys((keys) => keys.filter((k) => k !== key));
  const submit = () => {
    if (answer.length > 0) onAnswer({ tokens: answer.map((t) => t.text) });
  };

  const renderTile = (tile: Tile, onClick: () => void) => (
    <motion.button
      key={tile.key}
      type="button"
      layout
      layoutId={tile.key}
      lang="vi"
      disabled={disabled}
      onClick={onClick}
      whileTap={tap}
      transition={spring.snappy}
      className="rounded-sm border-2 border-b-4 border-line bg-surface px-3 py-2 text-body-strong text-ink"
    >
      {tile.text}
    </motion.button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-caption text-ink-muted">{fr.exercises.wordOrder.prompt}</p>
        <h2 lang="fr" className="text-heading text-ink">
          {exercise.fr}
        </h2>
      </div>
      <div
        role="group"
        aria-label={fr.exercises.wordOrder.answerLine}
        className="flex min-h-14 flex-wrap items-center gap-2 border-b-2 border-dashed border-line pb-2"
      >
        {answer.length === 0 ? <span className="text-caption text-ink-muted">{fr.exercises.wordOrder.answerLineEmpty}</span> : null}
        {answer.map((tile) => renderTile(tile, () => remove(tile.key)))}
      </div>
      <div role="group" aria-label={fr.exercises.wordOrder.bank} className="flex min-h-14 flex-wrap items-center justify-center gap-2">
        {remaining.map((tile) => renderTile(tile, () => add(tile.key)))}
      </div>
      <Button size="lg" fullWidth disabled={disabled || answer.length === 0} onClick={submit}>
        {fr.exercises.verify}
      </Button>
    </div>
  );
};
