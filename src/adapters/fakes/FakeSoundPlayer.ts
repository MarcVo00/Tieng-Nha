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
  /** When false, `unlock()` leaves the audio locked (an iOS gesture that was refused): use `setRunning(true)` later. */
  unlockWorks = true;
  private running = false;
  private readonly listeners = new Set<(running: boolean) => void>();

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
    if (this.unlockWorks) this.setRunning(true);
  }

  isRunning(): boolean {
    return this.running;
  }

  onStateChange(listener: (running: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Simulates the context entering or leaving "running" (a resume, an interruption). */
  setRunning(running: boolean): void {
    if (this.running === running) return;
    this.running = running;
    for (const l of [...this.listeners]) l(running);
  }

  setEnabled(on: boolean): void {
    this.enabledCalls.push(on);
    this.enabled = on;
    if (!on) this.stopAll();
  }
}
