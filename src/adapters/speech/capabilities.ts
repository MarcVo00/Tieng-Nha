import type { Capabilities } from "@/domain/types";
import type { SpeechRecognizer, VoiceRecorder } from "@/ports";

/** Anything that can say whether Vietnamese speech works once it is ready (device TTS, or the audio pack wrapping it). */
export type SpeechProbe = { ready(): Promise<void>; isAvailable(): boolean };

export function createDetectCapabilities(tts: SpeechProbe, stt: SpeechRecognizer, rec: VoiceRecorder) {
  return async (): Promise<Capabilities> => {
    await tts.ready();
    return { tts: tts.isAvailable(), stt: stt.isAvailable(), recorder: rec.isAvailable() };
  };
}
