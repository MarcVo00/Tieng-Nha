import type { VoiceRecorder } from "@/ports";

export class MediaRecorderVoiceRecorder implements VoiceRecorder {
  constructor(private readonly nav: Navigator = navigator) {}

  isAvailable(): boolean {
    return typeof MediaRecorder !== "undefined" && typeof this.nav.mediaDevices?.getUserMedia === "function";
  }

  async record(maxMs: number, signal?: AbortSignal): Promise<Blob> {
    const stream = await this.nav.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    return new Promise<Blob>((resolve) => {
      const stop = () => {
        if (rec.state !== "inactive") rec.stop();
      };
      const timer = setTimeout(stop, maxMs);
      signal?.addEventListener("abort", stop, { once: true });
      rec.onstop = () => {
        clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start();
    });
  }
}
