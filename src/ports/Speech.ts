import type { VoiceId } from "@/domain/types";

/** `voice` overrides the configured voice for this call only (settings preview). */
export type SpeakOptions = { rate?: number; audioUrl?: string; voice?: VoiceId };
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
  /**
   * Alternatives, best first; throws RecognitionError. `acceptEarly` is asked about results heard while the learner is
   * still speaking: returning true resolves with them at once instead of waiting for the end-of-speech silence.
   */
  listen(opts: { lang: "vi-VN"; timeoutMs: number; acceptEarly?: (alternatives: string[]) => boolean }): Promise<string[]>;
  abort(): void;
}
export interface VoiceRecorder {
  isAvailable(): boolean;
  record(maxMs: number, signal?: AbortSignal): Promise<Blob>; // stops at maxMs or on abort
}
