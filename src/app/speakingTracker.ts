import type { SpeechSynthesizer } from "@/ports";

export type TrackedSpeechSynthesizer = SpeechSynthesizer & { isSpeaking(): boolean };

/**
 * Wraps the voice so sound effects can tell whether it is speaking: counts in-flight `speak` calls, each one leaving on
 * resolve, reject or `cancel()`. `speak` is forwarded synchronously so iOS still sees it inside the user gesture.
 * `onChange(speaking)` fires on each silence/voice transition, so a cue already sounding can duck under the voice.
 */
export function trackSpeaking(tts: SpeechSynthesizer, onChange: (speaking: boolean) => void = () => undefined): TrackedSpeechSynthesizer {
  const inFlight = new Set<symbol>();
  const notify = (was: boolean): void => {
    const now = inFlight.size > 0;
    if (now !== was) onChange(now);
  };
  return {
    isAvailable: () => tts.isAvailable(),
    speak(text, opts) {
      const call = Symbol("speak");
      const was = inFlight.size > 0;
      inFlight.add(call);
      notify(was);
      return tts.speak(text, opts).finally(() => {
        const before = inFlight.size > 0;
        inFlight.delete(call);
        notify(before);
      });
    },
    cancel() {
      const was = inFlight.size > 0;
      inFlight.clear();
      notify(was);
      tts.cancel();
    },
    isSpeaking: () => inFlight.size > 0,
  };
}
