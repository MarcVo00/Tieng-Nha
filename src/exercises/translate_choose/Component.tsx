import { useMemo, useState, type FC } from "react";
import { motion } from "motion/react";
import type { Exercise } from "@/domain/types";
import type { ExerciseProps } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { createRng, shuffle } from "@/services/random";
import { Button, ChoiceGrid, Icon, spring, tap, useChoiceKeys } from "@/ui";

type TranslateChoose = Extract<Exercise, { type: "translate_choose" }>;

// Hero: the French sentence to translate. Secondary: four Vietnamese options. One action: Vérifier.
export const Component: FC<ExerciseProps<TranslateChoose>> = ({ exercise, disabled, onAnswer, services, capabilities, voiceRate, seed }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () => shuffle([exercise.answerVi, ...exercise.distractorsVi], createRng(seed)).map((vi) => ({ id: vi, label: vi, lang: "vi" as const })),
    [exercise.answerVi, exercise.distractorsVi, seed],
  );

  const submit = () => {
    if (selected !== null) onAnswer({ vi: selected });
  };
  useChoiceKeys({ ids: options.map((o) => o.id), selected, disabled, onSelect: setSelected, onSubmit: submit });

  const listenButton = (id: string) => (
    <motion.button
      type="button"
      aria-label={fr.exercises.translateChoose.listen(id)}
      onClick={() => {
        services.tts.speak(id, { rate: voiceRate }).catch(() => undefined);
      }}
      whileTap={tap}
      transition={spring.snappy}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-ink"
    >
      <Icon name="speaker" size={20} />
    </motion.button>
  );

  const revealed = disabled && selected !== null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-caption text-ink-muted">{fr.exercises.translateChoose.prompt}</p>
        <h2 lang="fr" className="text-heading text-ink">
          {exercise.promptFr}
        </h2>
      </div>
      <ChoiceGrid
        options={options}
        selected={selected}
        onSelect={setSelected}
        disabled={disabled}
        correctId={revealed ? exercise.answerVi : null}
        wrongId={revealed && selected !== exercise.answerVi ? selected : null}
        {...(capabilities.tts ? { accessory: listenButton } : {})}
      />
      <Button size="lg" fullWidth disabled={disabled || selected === null} onClick={submit}>
        {fr.exercises.verify}
      </Button>
    </div>
  );
};
