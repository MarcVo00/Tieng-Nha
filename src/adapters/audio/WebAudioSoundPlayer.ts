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
const PENDING_MS = 300; // the cue of the unlocking gesture waits this long for the context to run
const DUCK_S = 0.03; // a cue already sounding drops under (or comes back from) the voice in 30 ms

type Sounding = { cue: SoundCue; bus: GainNode; voice: Voice; level: number; bornSoft: boolean };

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
  private wasRunning = false;
  private readonly stateListeners = new Set<(running: boolean) => void>();
  private pending: { cue: SoundCue; opts: PlayOptions; at: number } | null = null;
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
        ctx.addEventListener?.("statechange", () => this.syncState());
      }
      // "suspended" before the first gesture, "interrupted" on iOS after a call or the app went to the background.
      if (this.ctx.state !== "running" && this.ctx.state !== "closed") {
        void this.ctx.resume().then(
          () => this.syncState(),
          () => this.syncState(),
        );
      }
      this.syncState();
    } catch {
      this.unsupported = true;
      this.ctx = null;
    }
  }

  isRunning(): boolean {
    return this.wasRunning;
  }

  onStateChange(listener: (running: boolean) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  play(cue: SoundCue, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!this.enabled || !ctx || !master) return;
    if (ctx.state !== "running") {
      // The context exists, so a gesture has come: this cue is probably the one of the tap that is waking the audio.
      this.pending = { cue, opts, at: this.now() };
      return;
    }
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
      const level = opts.strong ? LEVEL.strong : LEVEL.normal;
      const bornSoft = this.isVoiceBusy();
      bus.gain.value = bornSoft ? LEVEL.soft : level;
      bus.connect(master);
      const voice = recipes[cue](ctx, bus, at, opts.strong ?? false);
      this.sounding.push({ cue, bus, voice, level, bornSoft });
      this.lastPlayed.set(cue, now);
    } catch {
      // A failing recipe must never break the screen that asked for a sound.
    }
  }

  stopAll(): void {
    this.pending = null;
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

  /**
   * Called when the voice starts or stops speaking: cues already sounding ramp down to the soft level, then back up
   * (a cue that began under the voice stays soft). Cues starting later read `isVoiceBusy` themselves.
   */
  setVoiceBusy(busy: boolean): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    try {
      const at = ctx.currentTime;
      this.sounding = this.sounding.filter((s) => s.voice.end > at);
      for (const s of this.sounding) {
        const g = s.bus.gain;
        g.cancelScheduledValues(at);
        g.setValueAtTime(g.value, at);
        g.linearRampToValueAtTime(busy || s.bornSoft ? LEVEL.soft : s.level, at + DUCK_S);
      }
    } catch {
      // The context is gone: nothing left to duck.
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  /** Tells listeners when the context enters or leaves "running"; on entering, plays the cue that was waiting. */
  private syncState(): void {
    const running = this.ctx?.state === "running";
    if (running === this.wasRunning) return;
    this.wasRunning = running;
    for (const l of [...this.stateListeners]) l(running);
    const pending = this.pending;
    this.pending = null;
    if (running && pending && this.now() - pending.at <= PENDING_MS) this.play(pending.cue, pending.opts);
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
