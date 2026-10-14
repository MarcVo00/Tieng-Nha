import { RecognitionError, type RecognitionErrorCode, type SpeechRecognizer } from "@/ports";

type Alt = { transcript: string; confidence: number };
type RecInstance = {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alt> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
  stop(): void;
};
type RecCtor = new () => RecInstance;
export type RecognitionWindow = { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };

const MAP: Record<string, RecognitionErrorCode> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "no-speech": "no-speech",
  "language-not-supported": "unsupported",
  network: "network",
  aborted: "aborted",
  "audio-capture": "not-allowed",
};

export class WebSpeechRecognizer implements SpeechRecognizer {
  private current: RecInstance | null = null;
  constructor(private readonly win: RecognitionWindow = window as unknown as RecognitionWindow) {}

  private ctor(): RecCtor | undefined {
    return this.win.SpeechRecognition ?? this.win.webkitSpeechRecognition;
  }

  isAvailable(): boolean {
    return this.ctor() !== undefined;
  }

  listen({ lang, timeoutMs, acceptEarly }: { lang: "vi-VN"; timeoutMs: number; acceptEarly?: (alternatives: string[]) => boolean }): Promise<string[]> {
    const Ctor = this.ctor();
    if (!Ctor) return Promise.reject(new RecognitionError("unsupported"));
    this.abort();
    const rec = new Ctor();
    this.current = rec;
    rec.lang = lang;
    rec.maxAlternatives = 5;
    rec.interimResults = acceptEarly !== undefined; // partial results let a correct sentence pass without the silence
    rec.continuous = false;
    return new Promise<string[]>((resolve, reject) => {
      let settled = false;
      let result: string[] | null = null;
      let error: RecognitionErrorCode | null = null;
      const timer = setTimeout(() => {
        error = "timeout";
        rec.abort();
      }, timeoutMs);
      const finish = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.current === rec) this.current = null;
        outcome();
      };
      rec.onresult = (e) => {
        const first = e.results[0];
        if (first && first.isFinal === false) {
          // Still speaking: the transcript so far, all segments joined (interim results carry one alternative).
          const sofar = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
          if (sofar && acceptEarly?.([sofar])) {
            finish(() => resolve([sofar]));
            rec.abort();
          }
          return;
        }
        result = first ? Array.from(first).sort((a, b) => b.confidence - a.confidence).map((a) => a.transcript) : [];
      };
      rec.onerror = (e) => {
        error ??= MAP[e.error] ?? "aborted";
      };
      rec.onend = () => {
        finish(() => {
          if (result && result.length) resolve(result);
          else reject(new RecognitionError(error ?? "no-speech"));
        });
      };
      rec.start();
    });
  }

  abort(): void {
    this.current?.abort();
    this.current = null;
  }
}
