import type { Capabilities } from "@/domain/types";
import type { SpeechRecognizer, VoiceRecorder } from "@/ports";
import type { WebSpeechSynthesizer } from "@/adapters/speech/WebSpeechSynthesizer";

export function createDetectCapabilities(tts: WebSpeechSynthesizer, stt: SpeechRecognizer, rec: VoiceRecorder) {
  return async (): Promise<Capabilities> => {
    await tts.ready();
    return { tts: tts.isAvailable(), stt: stt.isAvailable(), recorder: rec.isAvailable() };
  };
}
