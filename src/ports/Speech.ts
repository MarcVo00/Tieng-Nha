export type SpeakOptions = { rate?: number; audioUrl?: string };
export interface SpeechSynthesizer {
  isAvailable(): boolean; // a vi-VN voice exists (or audioUrl playback possible)
  speak(text: string, opts?: SpeakOptions): Promise<void>; // resolves when finished
  cancel(): void;
}
export type RecognitionErrorCode = "no-speech" | "not-allowed" | "aborted" | "timeout" | "unsupported" | "network";
export class RecognitionError extends Error {
  readonly code: RecognitionErrorCode;
  constructor(code: RecognitionErrorCode) {
    super(code);
    this.code = code;
    this.name = "RecognitionError";
  }
}
export interface SpeechRecognizer {
  isAvailable(): boolean;
  listen(opts: { lang: "vi-VN"; timeoutMs: number }): Promise<string[]>; // alternatives, best first; throws RecognitionError
  abort(): void;
}
export interface VoiceRecorder {
  isAvailable(): boolean;
  record(maxMs: number, signal?: AbortSignal): Promise<Blob>; // stops at maxMs or on abort
}
