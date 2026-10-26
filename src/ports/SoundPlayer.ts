import type { PlayOptions, SoundCue } from "@/domain/sound";

export interface SoundPlayer {
  play(cue: SoundCue, opts?: PlayOptions): void; // never throws; no-op when disabled, locked or unsupported
  stopAll(): void; // fades out everything sounding (≤ 80 ms)
  unlock(): void; // call from a user gesture: creates/resumes the AudioContext
  setEnabled(on: boolean): void;
}
