import type { VoiceRecorder } from "@/ports";

export class MediaRecorderVoiceRecorder implements VoiceRecorder {
  constructor(private readonly nav: Navigator = navigator) {}

  isAvailable(): boolean {
    return typeof MediaRecorder !== "undefined" && typeof this.nav.mediaDevices?.getUserMedia === "function";
  }

  /** Stops at maxMs or on abort. An already-aborted signal resolves immediately with an empty Blob. */
  async record(maxMs: number, signal?: AbortSignal): Promise<Blob> {
    const stream = await this.nav.mediaDevices.getUserMedia({ audio: true });
    const release = () => stream.getTracks().forEach((t) => t.stop());
    try {
      if (signal?.aborted) {
        release();
        return new Blob([], { type: "audio/webm" });
      }
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      return await new Promise<Blob>((resolve, reject) => {
        const stop = () => {
          if (rec.state !== "inactive") rec.stop();
        };
        const timer = setTimeout(stop, maxMs);
        const cleanup = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", stop);
          release();
        };
        signal?.addEventListener("abort", stop, { once: true });
        rec.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        rec.onerror = () => {
          cleanup();
          reject(new Error("recorder_failed"));
        };
        try {
          rec.start();
        } catch (e) {
          cleanup();
          reject(e);
        }
      });
    } catch (e) {
      release();
      throw e;
    }
  }
}
