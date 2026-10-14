import { useEffect, useRef, useState, type FC } from "react";
import type { Exercise } from "@/domain/types";
import { SLOW_VOICE_RATE, type ExerciseProps } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { RecognitionError } from "@/ports";
import { saidExactly } from "@/services/pronunciation";
import { Button, MicButton, SpeakerButton } from "@/ui";

type Speak = Extract<Exercise, { type: "speak" }>;
type Mode = "stt" | "recorder" | "none";

const MAX_RECORD_MS = 6000;
const LISTEN_TIMEOUT_MS = 8000;
const FAILURES_BEFORE_SELF_ASSESS = 2;
const PERMANENT_RECORDER_ERRORS: readonly string[] = ["NotAllowedError", "NotFoundError", "SecurityError"];

/** Only permission or device errors mean the recorder is gone for good; anything else is worth a retry. */
function isRecorderLost(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e && typeof e.name === "string" && PERMANENT_RECORDER_ERRORS.includes(e.name);
}

// Hero: the sentence to say + the mic. Secondary: French meaning, model voice. One action at a time:
// speak (stt), record then self-assess (recorder), or pass (none).
export const Component: FC<ExerciseProps<Speak>> = ({ exercise, disabled, onAnswer, services, capabilities, voiceRate, onCapabilityLost }) => {
  const baseMode: Mode = capabilities.stt ? "stt" : capabilities.recorder ? "recorder" : "none";
  const [override, setOverride] = useState<Mode | null>(null);
  const mode = override ?? baseMode;

  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "recorded">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [recorderFailures, setRecorderFailures] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const recordCtl = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      services.tts.cancel();
      services.stt.abort();
      recordCtl.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // Cleanup runs once per mounted exercise; services are stable for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakModel = (rate: number) => {
    setPlaying(true);
    services.tts
      .speak(exercise.vi, { rate })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setPlaying(false);
      });
  };

  const switchToRecorder = () => {
    setOverride(capabilities.recorder ? "recorder" : "none");
    setPhase("idle");
  };

  const listen = async () => {
    if (phase === "listening") {
      services.stt.abort();
      return;
    }
    setMessage(null);
    setPhase("listening");
    try {
      const alternatives = await services.stt.listen({
        lang: "vi-VN",
        timeoutMs: LISTEN_TIMEOUT_MS,
        acceptEarly: (heard) => saidExactly(exercise.vi, heard), // the whole sentence, perfectly: no need to wait
      });
      if (!mounted.current) return;
      setPhase("processing");
      onAnswer({ kind: "speech", alternatives });
    } catch (e) {
      if (!mounted.current) return;
      setPhase("idle");
      const code = e instanceof RecognitionError ? e.code : "network";
      if (code === "not-allowed" || code === "unsupported") {
        setMessage(code === "not-allowed" ? fr.exercises.speak.micDenied : fr.exercises.speak.unsupported);
        onCapabilityLost?.("stt");
        switchToRecorder();
        return;
      }
      setMessage(fr.exercises.speak.failed[code]);
      setFailures((n) => n + 1);
    }
  };

  const record = async () => {
    if (phase === "listening") {
      recordCtl.current?.abort();
      return;
    }
    setMessage(null);
    setPhase("listening");
    const ctl = new AbortController();
    recordCtl.current = ctl;
    try {
      const blob = await services.recorder.record(MAX_RECORD_MS, ctl.signal);
      if (!mounted.current) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setVoiceUrl(url);
      setPhase("recorded");
    } catch (e) {
      if (!mounted.current) return;
      setPhase("idle");
      if (isRecorderLost(e)) {
        onCapabilityLost?.("recorder");
        setOverride("none");
        return;
      }
      setMessage(fr.exercises.speak.notHeard);
      setRecorderFailures((n) => n + 1);
    }
  };

  const skipButton = (
    <Button variant={mode === "none" ? "primary" : "secondary"} size="lg" fullWidth disabled={disabled} onClick={() => onAnswer({ kind: "skip" })}>
      {fr.exercises.speak.skip}
    </Button>
  );

  let body;
  if (mode === "stt") {
    const offerSelf = failures >= FAILURES_BEFORE_SELF_ASSESS;
    body = (
      <>
        <MicButton
          state={phase === "listening" ? "listening" : phase === "processing" ? "processing" : "idle"}
          label={phase === "listening" ? fr.exercises.speak.micStop : fr.exercises.speak.micLabel}
          disabled={disabled}
          onPress={() => void listen()}
        />
        {offerSelf ? (
          capabilities.recorder ? (
            <Button variant="secondary" size="lg" fullWidth disabled={disabled} onClick={switchToRecorder}>
              {fr.exercises.speak.selfAssess}
            </Button>
          ) : (
            skipButton
          )
        ) : null}
      </>
    );
  } else if (mode === "recorder") {
    body = (
      <>
        <p className="text-caption text-ink-muted">{fr.exercises.speak.recordHint}</p>
        <MicButton
          state={phase === "listening" ? "listening" : "idle"}
          label={phase === "listening" ? fr.exercises.speak.micStop : fr.exercises.speak.micLabel}
          disabled={disabled}
          onPress={() => void record()}
        />
        {recorderFailures > 0 && phase !== "recorded" ? skipButton : null}
        {phase === "recorded" && voiceUrl ? (
          <>
            <div className="flex w-full flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                {fr.exercises.speak.myVoice}
                <audio controls src={voiceUrl} className="w-full" />
              </label>
              {capabilities.tts ? (
                <Button variant="secondary" disabled={disabled} onClick={() => speakModel(voiceRate)}>
                  {fr.exercises.speak.model}
                </Button>
              ) : null}
            </div>
            <div className="flex w-full gap-3">
              <Button size="lg" fullWidth disabled={disabled} onClick={() => onAnswer({ kind: "self", ok: true })}>
                {fr.exercises.speak.saidOk}
              </Button>
              <Button variant="secondary" size="lg" fullWidth disabled={disabled} onClick={() => onAnswer({ kind: "self", ok: false })}>
                {fr.exercises.speak.retry}
              </Button>
            </div>
          </>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <p className="text-body text-ink-muted">{fr.exercises.speak.none}</p>
        {skipButton}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-heading text-ink">{fr.exercises.speak.prompt}</h2>
      <div className="flex flex-col gap-2">
        <p lang="vi" className="text-display text-ink">
          {exercise.vi}
        </p>
        <p lang="fr" className="text-body text-ink-muted">
          {exercise.fr}
        </p>
      </div>
      {capabilities.tts ? (
        <SpeakerButton size="md" playing={playing} disabled={disabled} onSpeak={() => speakModel(voiceRate)} onSpeakSlow={() => speakModel(SLOW_VOICE_RATE)} />
      ) : null}
      <div className="flex flex-col items-center gap-4">{body}</div>
      <p role="alert" className="text-caption text-ink-muted empty:hidden">
        {message}
      </p>
    </div>
  );
};
