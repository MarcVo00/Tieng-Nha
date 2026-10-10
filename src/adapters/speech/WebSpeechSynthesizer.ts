import type { SpeakOptions, SpeechSynthesizer } from "@/ports";

type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;
export type SpeechWindow = { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: UtteranceCtor; Audio?: typeof Audio };

export function pickVietnameseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("vi"));
  return vi.find((v) => /google/i.test(v.name)) ?? vi.find((v) => !v.localService) ?? vi[0] ?? null;
}

export class WebSpeechSynthesizer implements SpeechSynthesizer {
  private voice: SpeechSynthesisVoice | null = null;
  private readyPromise: Promise<void> | null = null;

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
      const audio = new this.win.Audio(opts.audioUrl);
      audio.playbackRate = opts.rate ?? 1;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("audio_failed"));
        void audio.play().catch(reject);
      });
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
    await new Promise<void>((resolve) => {
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  cancel(): void {
    this.win.speechSynthesis?.cancel();
  }
}
