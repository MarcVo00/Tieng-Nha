import type { SpeechSynthesizer } from "@/ports";

export type TrackedSpeechSynthesizer = SpeechSynthesizer & { isSpeaking(): boolean };

/**
 * Wraps the voice so sound effects can tell whether it is speaking: counts in-flight `speak` calls, each one leaving on
 * resolve, reject or `cancel()`. `speak` is forwarded synchronously so iOS still sees it inside the user gesture.
 */
export function trackSpeaking(tts: SpeechSynthesizer): TrackedSpeechSynthesizer {
  const inFlight = new Set<symbol>();
  return {
    isAvailable: () => tts.isAvailable(),
    speak(text, opts) {
      const call = Symbol("speak");
      inFlight.add(call);
      return tts.speak(text, opts).finally(() => inFlight.delete(call));
    },
    cancel() {
      inFlight.clear();
      tts.cancel();
    },
    isSpeaking: () => inFlight.size > 0,
  };
}
