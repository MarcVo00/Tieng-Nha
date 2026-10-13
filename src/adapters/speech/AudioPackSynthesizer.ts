import { z } from "zod";
import type { VoiceId } from "@/domain/types";
import type { SpeakOptions, SpeechSynthesizer } from "@/ports";
import { speechKey } from "@/services/speechKey";

const ManifestSchema = z.object({
  version: z.literal(1),
  voices: z.array(z.object({ id: z.string(), keys: z.array(z.string()) })),
});

/** Voice id -> set of text keys that have a pre-generated MP3. */
type Manifest = ReadonlyMap<string, ReadonlySet<string>>;

/** The few HTMLAudioElement members we use (lets tests inject a fake). */
export type AudioLike = {
  playbackRate: number;
  onended: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event | string) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
};

export type FallbackSynthesizer = SpeechSynthesizer & { ready?(): Promise<void> };

export type AudioPackOptions = {
  getVoice: () => VoiceId;
  manifestUrl?: string;
  baseUrl?: string; // folder holding <voiceId>/<key>.mp3
  fetchFn?: typeof fetch;
  audioFactory?: (url: string) => AudioLike;
};

export type PrefetchResult = { done: number; total: number };

const PREFETCH_CONCURRENCY = 6;

type Playing = { audio: AudioLike; stop(): void };

/** Plays pre-generated MP3 voice packs; anything it cannot play goes to the device TTS fallback. */
export class AudioPackSynthesizer implements SpeechSynthesizer {
  private manifest: Manifest | null = null;
  private manifestPromise: Promise<Manifest | null> | null = null;
  private playing: Playing | null = null;
  private generation = 0;
  private readonly prefetches = new Map<string, Promise<PrefetchResult>>();
  private readonly getVoice: () => VoiceId;
  private readonly manifestUrl: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly audioFactory: (url: string) => AudioLike;

  constructor(private readonly fallback: FallbackSynthesizer, opts: AudioPackOptions) {
    this.getVoice = opts.getVoice;
    this.baseUrl = (opts.baseUrl ?? "/audio").replace(/\/$/, "");
    this.manifestUrl = opts.manifestUrl ?? `${this.baseUrl}/manifest.json`;
    this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
    this.audioFactory = opts.audioFactory ?? ((url) => new Audio(url));
  }

  /** Resolves once the manifest (cached after the first load) and the fallback voices are known. */
  async ready(): Promise<void> {
    await Promise.all([this.loadManifest(), this.fallback.ready?.()]);
  }

  isAvailable(): boolean {
    const voice = this.getVoice();
    if (voice !== "device" && (this.manifest?.get(voice)?.size ?? 0) > 0) return true;
    return this.fallback.isAvailable();
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    if (opts.audioUrl) return this.fallback.speak(text, opts);
    const generation = ++this.generation;
    this.stopAudio();
    const voice = opts.voice ?? this.getVoice();
    if (voice !== "device") {
      const manifest = await this.loadManifest();
      const key = await speechKey(text);
      if (generation !== this.generation) return; // cancelled or superseded while resolving the key
      if (manifest?.get(voice)?.has(key)) {
        try {
          await this.play(`${this.baseUrl}/${voice}/${key}.mp3`, opts.rate ?? 1);
          return;
        } catch {
          if (generation !== this.generation) return;
          // The file is missing or undecodable: speak with the device voice instead.
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

  /** Downloads every file of a voice (so the service worker caches them). Safe to call repeatedly. */
  prefetchVoice(voice: VoiceId): Promise<PrefetchResult> {
    if (voice === "device") return Promise.resolve({ done: 0, total: 0 });
    const running = this.prefetches.get(voice);
    if (running) return running;
    const job = this.runPrefetch(voice).then((result) => {
      // Allow a retry later when some files failed (e.g. offline).
      if (result.done < result.total) this.prefetches.delete(voice);
      return result;
    });
    this.prefetches.set(voice, job);
    return job;
  }

  private async runPrefetch(voice: string): Promise<PrefetchResult> {
    const manifest = await this.loadManifest();
    const keys = [...(manifest?.get(voice) ?? [])];
    let done = 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < keys.length) {
        const key = keys[next++];
        if (key === undefined) return;
        try {
          const res = await this.fetchFn(`${this.baseUrl}/${voice}/${key}.mp3`);
          if (res.ok) {
            await res.arrayBuffer(); // drain the body so the whole file is cached
            done++;
          }
        } catch {
          // Offline or interrupted: counted as not done.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, keys.length) }, worker));
    return { done, total: keys.length };
  }

  private loadManifest(): Promise<Manifest | null> {
    this.manifestPromise ??= (async () => {
      try {
        const res = await this.fetchFn(this.manifestUrl);
        if (!res.ok) return null;
        const parsed = ManifestSchema.parse(await res.json());
        this.manifest = new Map(parsed.voices.map((v) => [v.id, new Set(v.keys)]));
        return this.manifest;
      } catch {
        return null; // behaves as the fallback
      }
    })();
    return this.manifestPromise;
  }

  private play(url: string, rate: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const audio = this.audioFactory(url);
      audio.playbackRate = rate;
      const entry: Playing = {
        audio,
        stop: () => {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          resolve();
        },
      };
      const finish = () => {
        if (this.playing === entry) this.playing = null;
      };
      audio.onended = () => {
        finish();
        resolve();
      };
      audio.onerror = () => {
        finish();
        reject(new Error("audio_failed"));
      };
      this.playing = entry;
      audio.play().catch((e: unknown) => {
        finish();
        reject(e instanceof Error ? e : new Error("audio_failed"));
      });
    });
  }

  private stopAudio(): void {
    const current = this.playing;
    this.playing = null;
    current?.stop();
  }
}
