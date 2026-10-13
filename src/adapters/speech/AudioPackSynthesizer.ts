import { z } from "zod";
import type { VoiceId } from "@/domain/types";
import type { SpeakOptions, SpeechSynthesizer } from "@/ports";
import { normalizeSpeechText, speechKey } from "@/services/speechKey";

export const AudioPackManifestSchema = z.object({
  version: z.literal(2),
  keys: z.record(z.string()), // normalised text -> key, so playback can start without hashing
  voices: z.array(z.object({ id: z.string(), keys: z.array(z.string()) })),
});

type Manifest = {
  keys: ReadonlyMap<string, string>; // normalised text -> key
  voices: ReadonlyMap<string, ReadonlySet<string>>; // voice id -> keys that have a pre-generated MP3
};

/** The few HTMLAudioElement members we use (lets tests inject a fake). */
export type AudioLike = {
  src: string;
  playbackRate: number;
  defaultPlaybackRate: number;
  readonly duration: number;
  onended: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event | string) => unknown) | null;
  onpause: ((ev: Event) => unknown) | null;
  onloadedmetadata: ((ev: Event) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
};

/** The window members used for the one-time audio unlock. */
export type GestureTarget = {
  addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: () => void, options?: EventListenerOptions): void;
};

export type FallbackSynthesizer = SpeechSynthesizer & { ready?(): Promise<void> };

export type AudioPackOptions = {
  getVoice: () => VoiceId;
  manifestUrl?: string;
  baseUrl?: string; // folder holding <voiceId>/<key>.mp3
  fetchFn?: typeof fetch;
  /** Creates THE audio element (called once, lazily). */
  audioFactory?: () => AudioLike;
  /** Where the first user gesture is observed to unlock audio on iOS. `null` disables it. */
  gestureTarget?: GestureTarget | null;
  now?: () => number;
  /** Resolves when a service worker controls fetches (prefetch waits for it so files get cached). */
  waitForServiceWorker?: () => Promise<void>;
};

export type PrefetchResult = { done: number; total: number };

const PREFETCH_CONCURRENCY = 6;
const MANIFEST_RETRY_MS = 30_000;
const LOAD_TIMEOUT_MS = 8000; // cap before the file's duration is known (stalled network)
const END_MARGIN_MS = 2000; // after duration / rate
const SERVICE_WORKER_WAIT_MS = 5000;
const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"] as const;
// 2 samples of silence: just enough for play() to be accepted inside a gesture.
const SILENT_WAV = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

type Playing = { stop(): void };

function defaultWaitForServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve();
  // `ready` never resolves without a registered worker (dev server): do not wait forever.
  return Promise.race([
    navigator.serviceWorker.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, SERVICE_WORKER_WAIT_MS)),
  ]);
}

/** Plays pre-generated MP3 voice packs; anything it cannot play goes to the device TTS fallback. */
export class AudioPackSynthesizer implements SpeechSynthesizer {
  private manifest: Manifest | null = null;
  private manifestPromise: Promise<Manifest | null> | null = null;
  private lastManifestFailure = Number.NEGATIVE_INFINITY;
  private audio: AudioLike | null = null;
  private playing: Playing | null = null;
  private generation = 0;
  private readonly prefetches = new Map<string, { job: Promise<PrefetchResult>; abort: AbortController }>();
  private readonly getVoice: () => VoiceId;
  private readonly manifestUrl: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly audioFactory: () => AudioLike;
  private readonly now: () => number;
  private readonly waitForServiceWorker: () => Promise<void>;
  private unlockListener: (() => void) | null = null;
  private unlockTarget: GestureTarget | null = null;

  constructor(private readonly fallback: FallbackSynthesizer, opts: AudioPackOptions) {
    this.getVoice = opts.getVoice;
    this.baseUrl = (opts.baseUrl ?? "/audio").replace(/\/$/, "");
    this.manifestUrl = opts.manifestUrl ?? `${this.baseUrl}/manifest.json`;
    this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
    this.audioFactory = opts.audioFactory ?? (() => new Audio());
    this.now = opts.now ?? (() => Date.now());
    this.waitForServiceWorker = opts.waitForServiceWorker ?? defaultWaitForServiceWorker;
    void this.loadManifest(); // preload at startup so speak() can start playback synchronously
    const target = opts.gestureTarget === undefined ? (typeof window === "undefined" ? null : window) : opts.gestureTarget;
    if (target) this.installUnlock(target);
  }

  /** Resolves once the manifest (cached after the first load) and the fallback voices are known. */
  async ready(): Promise<void> {
    await Promise.all([this.loadManifest(), this.fallback.ready?.()]);
  }

  isAvailable(): boolean {
    const voice = this.getVoice();
    if (voice !== "device" && (this.manifest?.voices.get(voice)?.size ?? 0) > 0) return true;
    return this.fallback.isAvailable();
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    // Every speak supersedes whatever is still playing, whichever engine plays it.
    const generation = ++this.generation;
    this.stopAudio();
    this.fallback.cancel();
    if (opts.audioUrl) return this.fallback.speak(text, opts);
    const voice = opts.voice ?? this.getVoice();
    if (voice !== "device") {
      // Fast path: manifest already loaded and text known -> play() starts synchronously inside the user gesture (iOS).
      // Nothing may be awaited before this.play() on that path.
      let manifest = this.manifest;
      let key = manifest?.keys.get(normalizeSpeechText(text));
      if (!manifest) {
        manifest = await this.loadManifest();
        key = manifest?.keys.get(normalizeSpeechText(text));
      }
      if (manifest && key === undefined) key = await speechKey(text); // text not in the map: hash it
      if (generation !== this.generation) return; // cancelled or superseded while resolving
      if (key !== undefined && manifest?.voices.get(voice)?.has(key)) {
        try {
          await this.play(`${this.baseUrl}/${voice}/${key}.mp3`, opts.rate ?? 1);
          return;
        } catch {
          if (generation !== this.generation) return;
          // The file is missing, stalled or undecodable: speak with the device voice instead.
        }
      }
    }
    return this.fallback.speak(text, opts);
  }

  cancel(): void {
    this.generation++;
    this.stopAudio();
    this.fallback.cancel();
  }

  /**
   * Downloads every file of a voice (so the service worker caches them). Safe to call repeatedly.
   * Selecting another voice aborts the download of the previous one.
   */
  prefetchVoice(voice: VoiceId): Promise<PrefetchResult> {
    for (const [other, entry] of this.prefetches) {
      if (other !== voice) entry.abort.abort();
    }
    if (voice === "device") return Promise.resolve({ done: 0, total: 0 });
    const running = this.prefetches.get(voice);
    if (running && !running.abort.signal.aborted) return running.job;
    const abort = new AbortController();
    const job = this.runPrefetch(voice, abort.signal).then((result) => {
      // Allow a retry later when some files failed or the download was aborted.
      if (result.done < result.total && this.prefetches.get(voice)?.job === job) this.prefetches.delete(voice);
      return result;
    });
    this.prefetches.set(voice, { job, abort });
    return job;
  }

  private async runPrefetch(voice: string, signal: AbortSignal): Promise<PrefetchResult> {
    await this.waitForServiceWorker().catch(() => undefined);
    const manifest = await this.loadManifest();
    const keys = [...(manifest?.voices.get(voice) ?? [])];
    let done = 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < keys.length && !signal.aborted) {
        const key = keys[next++];
        if (key === undefined) return;
        try {
          const res = await this.fetchFn(`${this.baseUrl}/${voice}/${key}.mp3`, { signal });
          if (res.ok) {
            await res.arrayBuffer(); // drain the body so the whole file is cached
            done++;
          }
        } catch {
          // Offline, interrupted or aborted: counted as not done.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, keys.length) }, worker));
    return { done, total: keys.length };
  }

  /** Loads the manifest once; a failed load is retried by a later call, at most every 30 s. */
  private loadManifest(): Promise<Manifest | null> {
    if (this.manifestPromise) return this.manifestPromise;
    if (this.now() - this.lastManifestFailure < MANIFEST_RETRY_MS) return Promise.resolve(null);
    const promise: Promise<Manifest | null> = (async () => {
      try {
        const res = await this.fetchFn(this.manifestUrl);
        if (!res.ok) return null;
        const parsed = AudioPackManifestSchema.parse(await res.json());
        this.manifest = {
          keys: new Map(Object.entries(parsed.keys)),
          voices: new Map(parsed.voices.map((v) => [v.id, new Set(v.keys)])),
        };
        return this.manifest;
      } catch {
        return null; // behaves as the fallback
      }
    })().then((manifest) => {
      if (!manifest) {
        this.lastManifestFailure = this.now();
        if (this.manifestPromise === promise) this.manifestPromise = null;
      }
      return manifest;
    });
    this.manifestPromise = promise;
    return promise;
  }

  /** THE audio element: created once and reused, so the one-time iOS unlock stays valid for every later speak. */
  private getAudio(): AudioLike {
    this.audio ??= this.audioFactory();
    return this.audio;
  }

  /**
   * iOS only lets an audio element start inside a user gesture. Lesson auto-play and dialogue lines run without one,
   * so the first gesture anywhere plays a silent clip on the shared element, which unlocks it for good.
   */
  private installUnlock(target: GestureTarget): void {
    const listener = () => {
      if (this.unlockListener !== listener) return; // already used
      this.removeUnlock();
      if (this.playing) return; // a real playback started in this gesture already unlocks the element
      const audio = this.getAudio();
      audio.src = SILENT_WAV;
      audio
        .play()
        .then(() => {
          if (!this.playing) audio.pause();
        })
        .catch(() => undefined); // not unlocked: the next gesture cannot retry, speak() falls back as before
    };
    this.unlockListener = listener;
    this.unlockTarget = target;
    for (const type of UNLOCK_EVENTS) target.addEventListener(type, listener, { passive: true });
  }

  private removeUnlock(): void {
    const { unlockTarget: target, unlockListener: listener } = this;
    if (!target || !listener) return;
    this.unlockTarget = null;
    this.unlockListener = null;
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, listener);
  }

  /**
   * Resolves when the clip ended, was paused by the system, was stopped by us, or went silent for too long
   * (never stays pending). Rejects when it cannot start (error, blocked, or nothing loaded before the cap).
   */
  private play(url: string, rate: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const audio = this.getAudio();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        audio.onloadedmetadata = null;
        if (this.playing === entry) this.playing = null;
        fn();
      };
      const entry: Playing = {
        stop: () => {
          settle(resolve);
          audio.pause();
        },
      };
      audio.onended = () => settle(resolve);
      audio.onpause = () => settle(resolve); // an interruption (call, Siri, other app) only fires `pause`
      audio.onerror = () => settle(() => reject(new Error("audio_failed")));
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration / (rate > 0 ? rate : 1) : 5;
        timer = setTimeout(
          () =>
            settle(() => {
              audio.pause();
              resolve();
            }),
          seconds * 1000 + END_MARGIN_MS,
        );
      };
      timer = setTimeout(() => {
        audio.pause();
        settle(() => reject(new Error("audio_stalled")));
      }, LOAD_TIMEOUT_MS);
      this.playing = entry;
      // Setting `src` resets the rate to the default one, so set both after it.
      audio.src = url;
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      audio.play().catch((e: unknown) => settle(() => reject(e instanceof Error ? e : new Error("audio_failed"))));
    });
  }

  private stopAudio(): void {
    const current = this.playing;
    this.playing = null;
    current?.stop();
  }
}
