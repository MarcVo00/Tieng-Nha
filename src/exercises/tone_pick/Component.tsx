import { useEffect, useRef, useState, type FC } from "react";
import type { Exercise, Tone } from "@/domain/types";
import { TONES } from "@/domain/tones";
import { SLOW_VOICE_RATE, type ExerciseProps } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { stripTones } from "@/services/pronunciation";
import { Button, Sheet, SpeakerButton, ToneButton, ToneMark, useChoiceKeys } from "@/ui";

type TonePick = Extract<Exercise, { type: "tone_pick" }>;

// Hero: the toneless syllable, huge. Secondary: six tone buttons. One action: Vérifier.
export const Component: FC<ExerciseProps<TonePick>> = ({ exercise, disabled, onAnswer, services, capabilities, voiceRate }) => {
  const [selected, setSelected] = useState<Tone | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const mounted = useRef(true);
  const autoplayed = useRef(false);

  const speak = (rate: number) => {
    setPlaying(true);
    services.tts
      .speak(exercise.syllable, { rate })
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

  const pick = (id: string) => {
    const tone = TONES.find((t) => t === id);
    if (tone) setSelected(tone);
  };
  const submit = () => {
    if (selected !== null) onAnswer({ tone: selected });
  };
  useChoiceKeys({ ids: TONES, selected, disabled: disabled || recapOpen, onSelect: pick, onSubmit: submit });

  const stateOf = (tone: Tone): "idle" | "correct" | "wrong" => {
    if (!disabled || selected === null) return "idle";
    if (tone === exercise.answerTone) return "correct";
    return tone === selected ? "wrong" : "idle";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading text-ink">{fr.exercises.tonePick.prompt}</h2>
        <p className="text-caption text-ink-muted">{capabilities.tts ? fr.exercises.tonePick.hint : fr.exercises.tonePick.noAudio}</p>
      </div>
      <div className="flex flex-col items-center gap-4 py-2">
        <p lang="vi" className="text-display text-ink">
          {stripTones(exercise.syllable)}
        </p>
        {capabilities.tts ? <SpeakerButton playing={playing} onSpeak={() => speak(voiceRate)} onSpeakSlow={() => speak(SLOW_VOICE_RATE)} /> : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TONES.map((tone) => (
          <ToneButton key={tone} tone={tone} selected={selected === tone} state={stateOf(tone)} onClick={() => !disabled && pick(tone)} />
        ))}
      </div>
      <button type="button" onClick={() => setRecapOpen(true)} className="min-h-11 self-center rounded-sm px-3 text-caption text-ink-muted underline underline-offset-4">
        {fr.exercises.tonePick.recapLink}
      </button>
      <Button size="lg" fullWidth disabled={disabled || selected === null} onClick={submit}>
        {fr.exercises.verify}
      </Button>
      <Sheet open={recapOpen} onClose={() => setRecapOpen(false)} label={fr.exercises.tonePick.recapTitle}>
        <h3 className="mb-3 text-heading text-ink">{fr.exercises.tonePick.recapTitle}</h3>
        <ul className="flex flex-col gap-3">
          {TONES.map((tone) => (
            <li key={tone} className="flex items-center gap-3">
              <span className="w-28 shrink-0">
                <ToneMark tone={tone} showName />
              </span>
              <span className="text-body text-ink">{fr.exercises.tonePick.descriptions[tone]}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
};
