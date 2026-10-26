import type { PlayOptions, SoundCue } from "@/domain/sound";
import type { SoundPlayer } from "@/ports";

export type PlayedSound = { cue: SoundCue; strong: boolean; soft: boolean };

/**
 * Records what would have sounded. Mirrors the « Sons » setting (nothing is recorded while disabled) but not the
 * iOS lock: tests and e2e need not dispatch a gesture first. `soft` = the voice was speaking when the cue fired.
 */
export class FakeSoundPlayer implements SoundPlayer {
  played: PlayedSound[] = [];
  stopped = 0;
  unlocks = 0;
  enabled = true;
  readonly enabledCalls: boolean[] = [];

  constructor(private readonly isVoiceBusy: () => boolean = () => false) {}

  play(cue: SoundCue, opts: PlayOptions = {}): void {
    if (!this.enabled) return;
    this.played.push({ cue, strong: opts.strong ?? false, soft: this.isVoiceBusy() });
  }

  stopAll(): void {
    this.stopped++;
  }

  unlock(): void {
    this.unlocks++;
  }

  setEnabled(on: boolean): void {
    this.enabledCalls.push(on);
    this.enabled = on;
    if (!on) this.stopAll();
  }
}
