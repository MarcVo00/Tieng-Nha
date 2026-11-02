import { LANGUAGES, type Language } from "@/domain/languages";
import type { SpeakOptions, SpeechSynthesizer } from "@/ports";

type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;
export type SpeechWindow = { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: UtteranceCtor; Audio?: typeof Audio };

/** Primary language subtags a device voice may carry for a speech language (Filipino is `fil`, older engines say `tl`). */
const PRIMARY_SUBTAGS: Record<Language["speechLang"], readonly string[]> = { "vi-VN": ["vi"], "fil-PH": ["fil", "tl"] };

/** The best device voice of the language; never a voice of another language. */
export function pickVoiceFor(voices: readonly SpeechSynthesisVoice[], speechLang: Language["speechLang"]): SpeechSynthesisVoice | null {
  const wanted = PRIMARY_SUBTAGS[speechLang];
  const matching = voices.filter((v) => wanted.includes(v.lang.toLowerCase().replace("_", "-").split("-")[0] ?? ""));
  return matching.find((v) => /google/i.test(v.name)) ?? matching.find((v) => !v.localService) ?? matching[0] ?? null;
}

const LOAD_TIMEOUT_MS = 8000; // cap before the clip's length is known (stalled network)
const END_MARGIN_MS = 2000; // slack after the expected end before a silent clip is given up on

export class WebSpeechSynthesizer implements SpeechSynthesizer {
  private voice: SpeechSynthesisVoice | null = null;
  private voiceLang: Language["speechLang"] | null = null; // the language `voice` was picked for
  private readonly readyPromises = new Map<Language["speechLang"], Promise<void>>();
  // iOS can garbage-collect an utterance mid-speech and never fire `end`; keeping a reference helps.
  private current: SpeechSynthesisUtterance | null = null;

  constructor(
    private readonly getLanguage: () => Language = () => LANGUAGES.vi,
    private readonly win: SpeechWindow = window as unknown as SpeechWindow,
  ) {}

  /** Resolves once voices are loaded (Chrome loads them asynchronously) or after 1.5 s. */
  ready(): Promise<void> {
    const speechLang = this.getLanguage().speechLang;
    const existing = this.readyPromises.get(speechLang);
    if (existing) return existing;
    const synth = this.win.speechSynthesis;
    const promise = new Promise<void>((resolve) => {
      if (!synth) {
        resolve();
        return;
      }
      const pick = () => {
        this.refreshVoice();
      };
      pick();
      if (this.currentVoice()) {
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
        if (this.currentVoice()) finish();
      };
      const timer = setTimeout(finish, 1500);
      synth.addEventListener("voiceschanged", onChange);
    });
    this.readyPromises.set(speechLang, promise);
    return promise;
  }

  isAvailable(): boolean {
    this.refreshVoice();
    return this.currentVoice() !== null;
  }

  /** The picked voice, only if it belongs to the active language. */
  private currentVoice(): SpeechSynthesisVoice | null {
    return this.voiceLang === this.getLanguage().speechLang ? this.voice : null;
  }

  /** Voices may arrive after the 1.5 s cutoff, and the language may change: retry the lookup lazily. */
  private refreshVoice(): void {
    const speechLang = this.getLanguage().speechLang;
    if (this.voiceLang === speechLang && this.voice) return;
    const synth = this.win.speechSynthesis;
    this.voice = synth ? pickVoiceFor(synth.getVoices(), speechLang) : null;
    this.voiceLang = speechLang;
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
    const voice = this.currentVoice();
    if (!synth || !Utt || !voice) throw new Error("tts_unavailable");
    synth.cancel();
    const u = new Utt(text);
    u.lang = this.getLanguage().speechLang;
    u.voice = voice;
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
        timer = setTimeout(() => {
          audio.pause();
          settle(resolve);
        }, (length / (rate > 0 ? rate : 1)) * 1000 + END_MARGIN_MS);
      };
      timer = setTimeout(() => {
        audio.pause();
        settle(() => reject(new Error("audio_stalled")));
      }, LOAD_TIMEOUT_MS);
      void audio.play().catch((e: unknown) => settle(() => reject(e instanceof Error ? e : new Error("audio_failed"))));
    });
  }

  cancel(): void {
    this.win.speechSynthesis?.cancel();
  }
}
