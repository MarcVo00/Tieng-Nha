import type { RecognitionError, SpeakOptions, SpeechRecognizer, SpeechSynthesizer, VoiceRecorder } from "@/ports";

export class FakeSpeechSynthesizer implements SpeechSynthesizer {
  available = true;
  spoken: string[] = [];
  lastOptions: SpeakOptions | undefined;
  /** Calls still speaking (lets the fake sound player tell when the voice is busy). */
  speaking = 0;

  constructor(private readonly delayMs = 0) {}

  isAvailable(): boolean {
    return this.available;
  }

  async speak(text: string, opts?: SpeakOptions): Promise<void> {
    this.lastOptions = opts;
    this.spoken.push(text);
    this.speaking++;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    } finally {
      this.speaking = Math.max(0, this.speaking - 1);
    }
  }

  cancel(): void {
    this.speaking = 0;
  }
}

export class FakeSpeechRecognizer implements SpeechRecognizer {
  available = true;
  queue: Array<string[] | RecognitionError> = [];

  isAvailable(): boolean {
    return this.available;
  }

  async listen(opts?: Parameters<SpeechRecognizer["listen"]>[0]): Promise<string[]> {
    void opts; // queued answers stand for what the learner said; early acceptance is the real adapter's job
    const next = this.queue.shift();
    if (next === undefined) return ["xin chào"];
    if (next instanceof Error) throw next;
    return next;
  }

  abort(): void {}
}

export class FakeVoiceRecorder implements VoiceRecorder {
  available = true;

  isAvailable(): boolean {
    return this.available;
  }

  async record(): Promise<Blob> {
    return new Blob(["fake"], { type: "audio/webm" });
  }
}
