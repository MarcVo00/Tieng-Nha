import type { SpeechSynthesizer } from "@/ports";
import { trackSpeaking } from "@/app/speakingTracker";

/** A synthesizer whose speak() calls settle only when the test says so. */
function controllable() {
  const pending: { resolve(): void; reject(e: Error): void }[] = [];
  const calls: string[] = [];
  let cancels = 0;
  const tts: SpeechSynthesizer = {
    isAvailable: () => true,
    speak: (text) => {
      calls.push(text);
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    },
    cancel: () => {
      cancels++;
    },
  };
  return { tts, pending, calls, cancels: () => cancels };
}

test("is speaking between speak() and its resolution", async () => {
  const c = controllable();
  const tracked = trackSpeaking(c.tts);
  expect(tracked.isSpeaking()).toBe(false);
  const done = tracked.speak("xin chào", { rate: 1 });
  expect(c.calls).toEqual(["xin chào"]); // forwarded synchronously (iOS gesture)
  expect(tracked.isSpeaking()).toBe(true);
  c.pending[0]!.resolve();
  await done;
  expect(tracked.isSpeaking()).toBe(false);
});

test("stops speaking after a rejection, and the rejection still reaches the caller", async () => {
  const c = controllable();
  const tracked = trackSpeaking(c.tts);
  const done = tracked.speak("cảm ơn");
  c.pending[0]!.reject(new Error("audio failed"));
  await expect(done).rejects.toThrow("audio failed");
  expect(tracked.isSpeaking()).toBe(false);
});

test("cancel() ends speaking at once, and late settlements do not go negative", async () => {
  const c = controllable();
  const tracked = trackSpeaking(c.tts);
  const a = tracked.speak("một");
  const b = tracked.speak("hai");
  tracked.cancel();
  expect(c.cancels()).toBe(1);
  expect(tracked.isSpeaking()).toBe(false);
  c.pending[0]!.resolve();
  c.pending[1]!.resolve();
  await Promise.all([a, b]);
  const d = tracked.speak("ba");
  expect(tracked.isSpeaking()).toBe(true);
  c.pending[2]!.resolve();
  await d;
  expect(tracked.isSpeaking()).toBe(false);
});

test("counts overlapping calls", async () => {
  const c = controllable();
  const tracked = trackSpeaking(c.tts);
  const a = tracked.speak("một");
  const b = tracked.speak("hai");
  c.pending[0]!.resolve();
  await a;
  expect(tracked.isSpeaking()).toBe(true);
  c.pending[1]!.resolve();
  await b;
  expect(tracked.isSpeaking()).toBe(false);
  expect(tracked.isAvailable()).toBe(true);
});
