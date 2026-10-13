import { AudioPackSynthesizer, createDetectCapabilities, type AudioLike } from "@/adapters/speech";
import { FakeSpeechRecognizer, FakeSpeechSynthesizer, FakeVoiceRecorder } from "@/adapters/fakes";
import type { VoiceId } from "@/domain/types";
import { speechKey } from "@/services/speechKey";

class FakeAudio implements AudioLike {
  static instances: FakeAudio[] = [];
  playbackRate = 1;
  onended: ((ev: Event) => unknown) | null = null;
  onerror: ((ev: Event | string) => unknown) | null = null;
  paused = false;
  playError: Error | null = null;
  constructor(readonly url: string) {
    FakeAudio.instances.push(this);
  }
  play(): Promise<void> {
    return this.playError ? Promise.reject(this.playError) : Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  end(): void {
    this.onended?.(new Event("ended"));
  }
  fail(): void {
    this.onerror?.(new Event("error"));
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type SetupOptions = { voice?: VoiceId; manifest?: unknown; manifestStatus?: number; failingFiles?: boolean; playError?: Error };

async function setup(over: SetupOptions = {}) {
  const southKeys = [await speechKey("xin chào"), await speechKey("cảm ơn")];
  const manifest = over.manifest ?? {
    version: 1,
    voices: [
      { id: "south-f", accent: "south", gender: "female", label: "Mỹ Duyên", keys: southKeys },
      { id: "north-f", accent: "north", gender: "female", label: "Đoan Trang", keys: [] },
    ],
  };
  const fetched: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify(manifest), { status: over.manifestStatus ?? 200 });
    return new Response(new Uint8Array([1, 2, 3]), { status: over.failingFiles ? 404 : 200 });
  }) as typeof fetch;
  const fallback = new FakeSpeechSynthesizer();
  const cancelFallback = vi.spyOn(fallback, "cancel");
  const voiceRef = { current: over.voice ?? "south-f" };
  const tts = new AudioPackSynthesizer(fallback, {
    getVoice: () => voiceRef.current,
    fetchFn,
    audioFactory: (url) => {
      const audio = new FakeAudio(url);
      if (over.playError) audio.playError = over.playError;
      return audio;
    },
  });
  return { tts, fallback, cancelFallback, fetched, voiceRef, southKeys };
}

const instance = (i: number): FakeAudio => {
  const a = FakeAudio.instances[i];
  if (!a) throw new Error(`no audio #${i}`);
  return a;
};

beforeEach(() => {
  FakeAudio.instances = [];
});

test("plays the pack file for the selected voice at the requested rate", async () => {
  const { tts, fallback, southKeys } = await setup();
  const done = tts.speak("xin chào", { rate: 0.6 });
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  expect(instance(0).url).toBe(`/audio/south-f/${southKeys[0]}.mp3`);
  expect(instance(0).playbackRate).toBe(0.6);
  instance(0).end();
  await done;
  expect(fallback.spoken).toEqual([]);
});

test("falls back to device TTS when the key is missing from the manifest", async () => {
  const { tts, fallback } = await setup();
  await tts.speak("bao nhiêu tiền", { rate: 1 });
  expect(FakeAudio.instances).toHaveLength(0);
  expect(fallback.spoken).toEqual(["bao nhiêu tiền"]);
});

test("falls back when the voice has no files, and when the voice is device", async () => {
  const north = await setup({ voice: "north-f" });
  await north.tts.speak("xin chào");
  expect(north.fallback.spoken).toEqual(["xin chào"]);
  const device = await setup({ voice: "device" });
  await device.tts.speak("xin chào");
  expect(device.fallback.spoken).toEqual(["xin chào"]);
  expect(FakeAudio.instances).toHaveLength(0);
});

test("uses the fallback for explicit audio urls", async () => {
  const { tts, fallback } = await setup();
  await tts.speak("xin chào", { audioUrl: "/x.mp3" });
  expect(fallback.lastOptions).toEqual({ audioUrl: "/x.mp3" });
  expect(FakeAudio.instances).toHaveLength(0);
});

test("falls back to device TTS when the audio element errors", async () => {
  const { tts, fallback } = await setup();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  instance(0).fail();
  await done;
  expect(fallback.spoken).toEqual(["xin chào"]);
});

test("falls back to device TTS when play() is rejected (autoplay blocked)", async () => {
  const { tts, fallback } = await setup({ playError: new Error("NotAllowedError") });
  await tts.speak("xin chào");
  expect(fallback.spoken).toEqual(["xin chào"]);
});

test("behaves as the fallback when the manifest cannot be loaded", async () => {
  for (const bad of [{ manifestStatus: 404 }, { manifest: { nope: true } }]) {
    const { tts, fallback } = await setup(bad);
    await tts.speak("xin chào");
    expect(fallback.spoken).toEqual(["xin chào"]);
    expect(tts.isAvailable()).toBe(true);
  }
});

test("loads the manifest once", async () => {
  const { tts, fetched } = await setup();
  const first = tts.speak("xin chào");
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  instance(0).end();
  await first;
  await tts.speak("autre texte");
  expect(fetched.filter((u) => u.endsWith("manifest.json"))).toHaveLength(1);
});

test("cancel stops the playing audio and the fallback, and speak resolves", async () => {
  const { tts, cancelFallback } = await setup();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  tts.cancel();
  await done;
  expect(instance(0).paused).toBe(true);
  expect(cancelFallback).toHaveBeenCalled();
});

test("cancel while the key is being resolved prevents any playback", async () => {
  const { tts, fallback } = await setup();
  const done = tts.speak("xin chào");
  tts.cancel();
  await done;
  await flush();
  expect(FakeAudio.instances).toHaveLength(0);
  expect(fallback.spoken).toEqual([]);
});

test("a new speak interrupts the audio that is playing", async () => {
  const { tts } = await setup();
  const first = tts.speak("xin chào");
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  const second = tts.speak("cảm ơn");
  await first;
  expect(instance(0).paused).toBe(true);
  await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2));
  instance(1).end();
  await second;
});

test("isAvailable: pack files for the current voice, otherwise the fallback", async () => {
  const { tts, fallback, voiceRef } = await setup();
  fallback.available = false;
  expect(tts.isAvailable()).toBe(false); // manifest not loaded yet
  await tts.ready();
  expect(tts.isAvailable()).toBe(true);
  voiceRef.current = "north-f"; // no files for this voice
  expect(tts.isAvailable()).toBe(false);
  voiceRef.current = "device";
  expect(tts.isAvailable()).toBe(false);
  fallback.available = true;
  expect(tts.isAvailable()).toBe(true);
});

test("prefetchVoice fetches every file of the voice, at most 6 at a time, once per voice", async () => {
  const keys = Array.from({ length: 20 }, (_, i) => `k${String(i).padStart(2, "0")}`);
  let inFlight = 0;
  let peak = 0;
  const fetched: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify({ version: 1, voices: [{ id: "south-m", keys }] }));
    fetched.push(url);
    inFlight++;
    peak = Math.max(peak, inFlight);
    await flush();
    inFlight--;
    return new Response(new Uint8Array([1]));
  }) as typeof fetch;
  const tts = new AudioPackSynthesizer(new FakeSpeechSynthesizer(), { getVoice: () => "south-m", fetchFn });
  expect(await tts.prefetchVoice("south-m")).toEqual({ done: 20, total: 20 });
  expect([...fetched].sort()).toEqual(keys.map((k) => `/audio/south-m/${k}.mp3`));
  expect(peak).toBeLessThanOrEqual(6);
  expect(peak).toBeGreaterThan(1);
  await tts.prefetchVoice("south-m");
  expect(fetched).toHaveLength(20);
  expect(await tts.prefetchVoice("device")).toEqual({ done: 0, total: 0 });
});

test("prefetchVoice counts failed files and may be retried", async () => {
  const { tts, fetched } = await setup({ failingFiles: true });
  expect(await tts.prefetchVoice("south-f")).toEqual({ done: 0, total: 2 });
  await tts.prefetchVoice("south-f");
  expect(fetched.filter((u) => u.endsWith(".mp3"))).toHaveLength(4);
});

test("detectCapabilities reports tts through the audio pack even without device voices", async () => {
  const { tts, fallback } = await setup();
  fallback.available = false;
  const detect = createDetectCapabilities(tts, new FakeSpeechRecognizer(), new FakeVoiceRecorder());
  await expect(detect()).resolves.toEqual({ tts: true, stt: true, recorder: true });
});
