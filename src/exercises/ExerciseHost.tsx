import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Capabilities, Exercise, VocabId, VocabItem } from "@/domain/types";
import { getPlugin } from "@/exercises/registry";
import type { ExerciseServices, GradeResult } from "@/exercises/types";
import { seedFromString } from "@/services/random";
import { duration, EXIT_RATIO, ease, FeedbackSheet } from "@/ui";

export type ExerciseHostProps = {
  exercise: Exercise;
  mode: "practice" | "exam"; // exam = no feedback sheet, result reported immediately
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  capabilities: Capabilities;
  voiceRate: number;
  services: ExerciseServices;
  onResult: (r: GradeResult) => void; // practice: after the user taps "Continuer"
  onReport?: (refId: string) => void;
  onCapabilityLost?: (c: "stt" | "recorder") => void;
  attempt?: number; // bump when the same exercise is presented again (retry)
};

const SHAKE = { x: [0, -6, 6, -4, 4, 0] };
const SHAKE_TRANSITION = { duration: duration.base, ease: ease.inOut };

export function ExerciseHost({ exercise, mode, vocabIndex, capabilities, voiceRate, services, onResult, onReport, onCapabilityLost, attempt = 0 }: ExerciseHostProps) {
  const plugin = getPlugin(exercise.type);
  // Each presentation (exercise id + attempt) owns its result and its one-answer guard.
  const presentation = `${exercise.id}:${attempt}`;
  const [state, setState] = useState<{ presentation: string; result: GradeResult } | null>(null);
  const result = state?.presentation === presentation ? state.result : null;
  const answered = useRef<string | null>(null);
  const seed = useMemo(() => seedFromString(exercise.id), [exercise.id]);

  const handleAnswer = (answer: unknown) => {
    if (answered.current === presentation) return; // one answer per presentation
    answered.current = presentation;
    const r = plugin.grade(exercise, answer, { vocabIndex });
    if (mode === "exam") onResult(r);
    else setState({ presentation, result: r });
  };

  const wrong = result !== null && !result.correct && !result.skipped;
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={presentation}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { duration: duration.base, ease: ease.out } }}
          exit={{ x: -24, opacity: 0, transition: { duration: duration.fast * EXIT_RATIO, ease: ease.in } }}
        >
          <motion.div animate={wrong ? SHAKE : { x: 0 }} transition={wrong ? SHAKE_TRANSITION : { duration: 0 }}>
            <plugin.Component
              exercise={exercise}
              disabled={result !== null}
              onAnswer={handleAnswer}
              services={services}
              capabilities={capabilities}
              vocabIndex={vocabIndex}
              voiceRate={voiceRate}
              seed={seed}
              {...(onCapabilityLost ? { onCapabilityLost } : {})}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {mode === "practice" ? (
        <FeedbackSheet
          open={result !== null}
          correct={!!result?.correct}
          skipped={!!result?.skipped}
          expected={result?.expected ?? ""}
          onSpeak={() => {
            if (result) services.tts.speak(result.expected, { rate: voiceRate }).catch(() => undefined);
          }}
          {...(onReport ? { onReport: () => onReport(exercise.id) } : {})}
          onContinue={() => {
            if (!result) return;
            onResult(result);
            setState(null);
          }}
        >
          {result && plugin.Feedback ? <plugin.Feedback exercise={exercise} result={result} /> : null}
        </FeedbackSheet>
      ) : null}
    </>
  );
}
