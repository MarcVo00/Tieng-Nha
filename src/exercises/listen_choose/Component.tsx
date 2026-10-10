import { useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Exercise } from "@/domain/types";
import { SLOW_VOICE_RATE, type ExerciseProps } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { createRng, shuffle } from "@/services/random";
import { Button, ChoiceGrid, SpeakerButton, useChoiceKeys } from "@/ui";

type ListenChoose = Extract<Exercise, { type: "listen_choose" }>;

// Hero: the big speaker (the sound). Secondary: four French meanings. One action: Vérifier.
export const Component: FC<ExerciseProps<ListenChoose>> = ({ exercise, disabled, onAnswer, services, capabilities, vocabIndex, voiceRate, seed }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const mounted = useRef(true);
  const autoplayed = useRef(false);
  const word = vocabIndex.get(exercise.vocabId);

  const options = useMemo(
    () =>
      shuffle(exercise.choices, createRng(seed)).flatMap((id) => {
        const item = vocabIndex.get(id);
        return item ? [{ id, label: item.fr, lang: "fr" as const }] : [];
      }),
    [exercise.choices, vocabIndex, seed],
  );

  const speak = (rate: number) => {
    if (!word) return;
    setPlaying(true);
    const opts = word.audio ? { rate, audioUrl: word.audio } : { rate };
    services.tts
      .speak(word.vi, opts)
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setPlaying(false);
      });
  };
  const speakRef = useRef(speak);
  speakRef.current = speak;

  useEffect(() => {
    mounted.current = true;
    if (!autoplayed.current && capabilities.tts) {
      autoplayed.current = true;
      speakRef.current(voiceRate);
    }
    return () => {
      mounted.current = false;
      autoplayed.current = false; // StrictMode re-runs the effect: play again after the cancel below
      services.tts.cancel();
    };
    // Auto-play exactly once per mounted exercise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    if (selected !== null) onAnswer({ vocabId: selected });
  };
  useChoiceKeys({ ids: options.map((o) => o.id), selected, disabled, onSelect: setSelected, onSubmit: submit });

  const revealed = disabled && selected !== null;
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-heading text-ink">{fr.exercises.listenChoose.prompt}</h2>
      <div className="flex flex-col items-center gap-3 py-2">
        {capabilities.tts ? (
          <SpeakerButton size="xl" playing={playing} onSpeak={() => speak(voiceRate)} onSpeakSlow={() => speak(SLOW_VOICE_RATE)} />
        ) : (
          <>
            <p lang="vi" className="text-display text-ink">
              {word?.vi}
            </p>
            <p className="text-caption text-ink-muted">{fr.exercises.listenChoose.noAudio}</p>
          </>
        )}
      </div>
      <ChoiceGrid
        options={options}
        selected={selected}
        onSelect={setSelected}
        disabled={disabled}
        correctId={revealed ? exercise.vocabId : null}
        wrongId={revealed && selected !== exercise.vocabId ? selected : null}
      />
      <Button size="lg" fullWidth disabled={disabled || selected === null} onClick={submit}>
        {fr.exercises.verify}
      </Button>
    </div>
  );
};
