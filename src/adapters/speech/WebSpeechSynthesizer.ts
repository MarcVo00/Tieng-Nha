import type { SpeakOptions, SpeechSynthesizer } from "@/ports";

type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;
export type SpeechWindow = { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: UtteranceCtor; Audio?: typeof Audio };

export function pickVietnameseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("vi"));
  return vi.find((v) => /google/i.test(v.name)) ?? vi.find((v) => !v.localService) ?? vi[0] ?? null;
}

const LOAD_TIMEOUT_MS = 8000; // cap before the clip's length is known (stalled network)
const END_MARGIN_MS = 2000; // slack after the expected end before a silent clip is given up on

export class WebSpeechSynthesizer implements SpeechSynthesizer {
  private voice: SpeechSynthesisVoice | null = null;
  private readyPromise: Promise<void> | null = null;
  // iOS can garbage-collect an utterance mid-speech and never fire `end`; keeping a reference helps.
  private current: SpeechSynthesisUtterance | null = null;

  constructor(private readonly win: SpeechWindow = window as unknown as SpeechWindow) {}

  /** Resolves once voices are loaded (Chrome loads them asynchronously) or after 1.5 s. */
  ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    const synth = this.win.speechSynthesis;
    this.readyPromise = new Promise<void>((resolve) => {
      if (!synth) {
        resolve();
        return;
      }
      const pick = () => {
        this.voice = pickVietnameseVoice(synth.getVoices());
      };
      pick();
      if (this.voice) {
        resolve();
        return;
      }
      const finish = () => {
        synth.removeEventListener("voiceschanged", onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        pick();
        if (this.voice) finish();
      };
      const timer = setTimeout(finish, 1500);
      synth.addEventListener("voiceschanged", onChange);
    });
    return this.readyPromise;
  }

  isAvailable(): boolean {
    this.refreshVoice();
    return this.voice !== null;
  }

  /** Voices may arrive after the 1.5 s cutoff: retry the lookup lazily. */
  private refreshVoice(): void {
    if (this.voice) return;
    const synth = this.win.speechSynthesis;
    if (synth) this.voice = pickVietnameseVoice(synth.getVoices());
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    if (opts.audioUrl && this.win.Audio) {
      await this.playClip(new this.win.Audio(opts.audioUrl), opts.rate ?? 1);
      return;
    }
    await this.ready();
    this.refreshVoice();
    const synth = this.win.speechSynthesis;
    const Utt = this.win.SpeechSynthesisUtterance;
    if (!synth || !Utt || !this.voice) throw new Error("tts_unavailable");
    synth.cancel();
    const u = new Utt(text);
    u.lang = "vi-VN";
    u.voice = this.voice;
    u.rate = opts.rate ?? 1;
    this.current = u;
    const rate = u.rate > 0 ? u.rate : 1;
    const safetyMs = Math.max(3000, (text.length * 150) / rate + 2000);
    await new Promise<void>((resolve) => {
      // A dropped utterance must never leave the caller waiting forever.
      const timer = setTimeout(() => {
        if (this.current === u) synth.cancel();
        done();
      }, safetyMs);
      const done = () => {
        clearTimeout(timer);
        if (this.current === u) this.current = null;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }

  /** Never stays pending: it ends, errors, or gives up when the clip stalls (the caller then falls back or moves on). */
  private playClip(audio: HTMLAudioElement, rate: number): Promise<void> {
    audio.playbackRate = rate;
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (fn: () => void) => {
        clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        fn();
      };
      audio.onended = () => settle(resolve);
      audio.onerror = () => settle(() => reject(new Error("audio_failed")));
      // Once the length is known, wait for what is left of the clip (plus a margin) instead of the load cap.
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const length = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 5;
        timer = setTimeout(() => settle(resolve), (length / (rate > 0 ? rate : 1)) * 1000 + END_MARGIN_MS);
      };
      timer = setTimeout(() => settle(() => reject(new Error("audio_stalled"))), LOAD_TIMEOUT_MS);
      void audio.play().catch((e: unknown) => settle(() => reject(e instanceof Error ? e : new Error("audio_failed"))));
    });
  }

  cancel(): void {
    this.win.speechSynthesis?.cancel();
  }
}
