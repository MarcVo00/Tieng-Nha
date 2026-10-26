import type { PlayOptions, SoundCue } from "@/domain/sound";
import type { SoundPlayer } from "@/ports";
import { recipes, type Voice } from "@/adapters/audio/recipes";

export type WebAudioSoundPlayerOptions = {
  /** True while the Vietnamese voice speaks: cues then play much lower, never over it. */
  isVoiceBusy: () => boolean;
  /** Milliseconds, for the 50 ms dedupe. */
  now?: () => number;
  /** Returns null when Web Audio is missing. */
  createContext?: () => AudioContext | null;
};

const MASTER = 0.7;
const LEVEL = { normal: 1, strong: 1.5, soft: 0.2 } as const; // soft ≤ 0.25 × normal: the voice stays on top
const DEDUPE_MS = 50;
const MAX_VOICES = 6;
const FADE_S = 0.06; // stopAll and the voice cap fade out within 80 ms

type Sounding = { cue: SoundCue; bus: GainNode; voice: Voice };

type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

function defaultContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w: AudioWindow = window;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor({ latencyHint: "interactive" }) : null;
}

/**
 * Sound effects with the Web Audio API. Nothing is created before `unlock()` (called from a user gesture: iOS keeps a
 * context made earlier suspended), nothing plays while the context is not running, and no error ever leaves `play`.
 */
export class WebAudioSoundPlayer implements SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: AudioNode | null = null;
  private unsupported = false;
  private enabled = true;
  private readonly lastPlayed = new Map<SoundCue, number>();
  private sounding: Sounding[] = [];
  private readonly isVoiceBusy: () => boolean;
  private readonly now: () => number;
  private readonly createContext: () => AudioContext | null;

  constructor(opts: WebAudioSoundPlayerOptions) {
    this.isVoiceBusy = opts.isVoiceBusy;
    this.now = opts.now ?? (() => performance.now());
    this.createContext = opts.createContext ?? defaultContext;
  }

  unlock(): void {
    if (this.unsupported) return;
    try {
      if (!this.ctx) {
        const ctx = this.createContext();
        if (!ctx) {
          this.unsupported = true;
          return;
        }
        this.ctx = ctx;
        this.master = this.buildMaster(ctx);
      }
      // "suspended" before the first gesture, "interrupted" on iOS after a call or the app went to the background.
      if (this.ctx.state !== "running" && this.ctx.state !== "closed") void this.ctx.resume().catch(() => undefined);
    } catch {
      this.unsupported = true;
      this.ctx = null;
    }
  }

  play(cue: SoundCue, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!this.enabled || !ctx || !master || ctx.state !== "running") return;
    const now = this.now();
    const last = this.lastPlayed.get(cue);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    try {
      const at = ctx.currentTime;
      this.sounding = this.sounding.filter((s) => s.voice.end > at);
      while (this.sounding.length >= MAX_VOICES) {
        const oldest = this.sounding.shift();
        if (oldest) this.fadeOut(oldest, at);
      }
      const bus = ctx.createGain();
      bus.gain.value = this.isVoiceBusy() ? LEVEL.soft : opts.strong ? LEVEL.strong : LEVEL.normal;
      bus.connect(master);
      const voice = recipes[cue](ctx, bus, at, opts.strong ?? false);
      this.sounding.push({ cue, bus, voice });
      this.lastPlayed.set(cue, now);
    } catch {
      // A failing recipe must never break the screen that asked for a sound.
    }
  }

  stopAll(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const at = ctx.currentTime;
      for (const s of this.sounding) this.fadeOut(s, at);
    } catch {
      // nothing else to do: the context is gone
    }
    this.sounding = [];
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  private buildMaster(ctx: AudioContext): AudioNode {
    const gain = ctx.createGain();
    gain.gain.value = MASTER;
    // A gentle limiter so overlapping cues never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    gain.connect(limiter).connect(ctx.destination);
    return gain;
  }

  private fadeOut(s: Sounding, at: number): void {
    const g = s.bus.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + FADE_S);
    s.voice.stop(at + FADE_S + 0.01);
  }
}
