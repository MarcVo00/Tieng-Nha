import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, PresenceContext } from "motion/react";
import type { Capabilities, Exercise, VocabId, VocabItem } from "@/domain/types";
import { getPlugin } from "@/exercises/registry";
import type { ExerciseServices, GradeResult, TargetLang } from "@/exercises/types";
import type { SpeechSynthesizer } from "@/ports";
import { seedFromString } from "@/services/random";
import { duration, EXIT_RATIO, ease, FeedbackSheet } from "@/ui";
import { ShineContext } from "@/ui/Button";

export type ExerciseHostProps = {
  exercise: Exercise;
  mode: "practice" | "exam"; // exam = no feedback sheet, result reported immediately
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  capabilities: Capabilities;
  voiceRate: number;
  services: ExerciseServices;
  onResult: (r: GradeResult) => void; // practice: after the user taps "Continuer"
  onGraded?: (r: GradeResult) => void; // practice: the moment the answer is graded, as the feedback sheet opens
  onReport?: (refId: string) => void;
  onCapabilityLost?: (c: "stt" | "recorder") => void;
  seedSalt?: string; // fixes the answer shuffle (duels: same order for both players)
  /**
   * Language of the exercise's content: its `lang` attribute, its recognition language, and the voice of every
   * `speak` call, whatever the active language is (a Vietnamese duel stays Vietnamese while Tagalog is active).
   */
  lang: TargetLang;
  attempt?: number; // bump when the same exercise is presented again (retry)
};

/** The synthesizer handed to the plugins: every call speaks in the content's language. */
function speakingIn(tts: SpeechSynthesizer, language: TargetLang): SpeechSynthesizer {
  // Explicit object: `tts` is a class instance, a spread would drop its prototype methods.
  return {
    isAvailable: () => tts.isAvailable(),
    speak: (text, opts) => tts.speak(text, { ...opts, language }),
    cancel: () => tts.cancel(),
  };
}

/** Respelling of the expected answer, when the content carries one (a spoken line, or the word heard). */
function pronOf(exercise: Exercise, vocabIndex: ReadonlyMap<VocabId, VocabItem>): string | undefined {
  if (exercise.type === "speak") return exercise.pron;
  if (exercise.type === "listen_choose") return vocabIndex.get(exercise.vocabId)?.pron;
  return undefined;
}

const SHAKE = { x: [0, -6, 6, -4, 4, 0] };
const SHAKE_TRANSITION = { duration: duration.base, ease: ease.inOut };

export function ExerciseHost({ exercise, mode, vocabIndex, capabilities, voiceRate, services: given, onResult, onGraded, onReport, onCapabilityLost, seedSalt, lang, attempt = 0 }: ExerciseHostProps) {
  const plugin = getPlugin(exercise.type);
  const { tts: givenTts, stt, recorder } = given;
  // Stable while the underlying services and the language are: plugins keep the first one for their cleanup.
  const services = useMemo<ExerciseServices>(() => ({ tts: speakingIn(givenTts, lang), stt, recorder }), [givenTts, stt, recorder, lang]);
  // Each presentation (exercise id + attempt) owns its result and its one-answer guard.
  const presentation = `${exercise.id}:${attempt}`;
  const [state, setState] = useState<{ presentation: string; result: GradeResult } | null>(null);
  const result = state?.presentation === presentation ? state.result : null;
  const answered = useRef<string | null>(null);
  const emitted = useRef<string | null>(null); // the exiting sheet keeps its old onContinue: emit once per presentation
  // Answer positions are drawn again for every run and every presentation: they cannot be learnt by heart.
  const [runSalt] = useState(() => Math.random().toString(36).slice(2));
  const seed = useMemo(() => seedFromString(`${presentation}:${seedSalt ?? runSalt}`), [presentation, runSalt, seedSalt]);

  const handleAnswer = (answer: unknown) => {
    if (answered.current === presentation) return; // one answer per presentation
    answered.current = presentation;
    const r = plugin.grade(exercise, answer, { vocabIndex });
    if (mode === "exam") onResult(r);
    else {
      setState({ presentation, result: r });
      onGraded?.(r);
    }
  };

  const pron = result ? pronOf(exercise, vocabIndex) : undefined;
  const wrong = result !== null && !result.correct && !result.skipped;
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={presentation}
          data-exercise-id={exercise.id}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { duration: duration.base, ease: ease.out } }}
          exit={{ x: -24, opacity: 0, transition: { duration: duration.fast * EXIT_RATIO, ease: ease.in } }}
        >
          <motion.div animate={wrong ? SHAKE : { x: 0 }} transition={wrong ? SHAKE_TRANSITION : { duration: 0 }}>
            {/* Layout-animated children (word_order tiles) must not take part in this exit: they never release it. */}
            <PresenceContext.Provider value={null}>
              <ShineContext.Provider value={mode !== "exam"}>
              <plugin.Component
                exercise={exercise}
                lang={lang}
                disabled={result !== null}
                onAnswer={handleAnswer}
                services={services}
                capabilities={capabilities}
                vocabIndex={vocabIndex}
                voiceRate={voiceRate}
                seed={seed}
                {...(onCapabilityLost ? { onCapabilityLost } : {})}
              />
              </ShineContext.Provider>
            </PresenceContext.Provider>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {mode === "practice" ? (
        <FeedbackSheet
          open={result !== null}
          correct={!!result?.correct}
          skipped={!!result?.skipped}
          expected={result?.expected ?? ""}
          lang={lang}
          {...(pron ? { pron } : {})}
          onSpeak={() => {
            if (result) services.tts.speak(result.expected, { rate: voiceRate }).catch(() => undefined);
          }}
          {...(onReport ? { onReport: () => onReport(exercise.id) } : {})}
          onContinue={() => {
            if (!result || emitted.current === presentation) return;
            emitted.current = presentation;
            onResult(result);
            setState(null);
          }}
        >
          {result && plugin.Feedback ? <plugin.Feedback exercise={exercise} result={result} lang={lang} /> : null}
        </FeedbackSheet>
      ) : null}
    </>
  );
}
