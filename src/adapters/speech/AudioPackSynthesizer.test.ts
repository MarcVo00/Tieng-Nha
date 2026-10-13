import { AudioPackSynthesizer, createDetectCapabilities, type AudioLike, type GestureTarget } from "@/adapters/speech";
import { FakeSpeechRecognizer, FakeSpeechSynthesizer, FakeVoiceRecorder } from "@/adapters/fakes";
import type { VoiceId } from "@/domain/types";
import { speechKey } from "@/services/speechKey";

class FakeAudio implements AudioLike {
  src = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  duration = Number.NaN;
  onended: ((ev: Event) => unknown) | null = null;
  onerror: ((ev: Event | string) => unknown) | null = null;
  onpause: ((ev: Event) => unknown) | null = null;
  onloadedmetadata: ((ev: Event) => unknown) | null = null;
  playLog: Array<{ src: string; rate: number }> = [];
  pauses = 0;
  playError: Error | null = null;
  play(): Promise<void> {
    this.playLog.push({ src: this.src, rate: this.playbackRate });
    return this.playError ? Promise.reject(this.playError) : Promise.resolve();
  }
  pause(): void {
    this.pauses++;
  }
  end(): void {
    this.onended?.(new Event("ended"));
  }
  fail(): void {
    this.onerror?.(new Event("error"));
  }
  interrupt(): void {
    this.onpause?.(new Event("pause"));
  }
  loaded(duration: number): void {
    this.duration = duration;
    this.onloadedmetadata?.(new Event("loadedmetadata"));
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type SetupOptions = {
  mapKeys?: boolean;
  voice?: VoiceId;
  manifest?: unknown;
  manifestStatus?: number;
  failingFiles?: boolean;
  playError?: Error;
  gestureTarget?: GestureTarget | null;
  now?: () => number;
  waitForServiceWorker?: () => Promise<void>;
};

async function setup(over: SetupOptions = {}) {
  const southKeys = [await speechKey("xin chào"), await speechKey("cảm ơn")];
  const manifest = over.manifest ?? {
    version: 2,
    keys: over.mapKeys === false ? {} : { "xin chào": southKeys[0], "cảm ơn": southKeys[1] },
    voices: [
      { id: "south-f", accent: "south", gender: "female", label: "Mỹ Duyên", keys: southKeys },
      { id: "north-f", accent: "north", gender: "female", label: "Đoan Trang", keys: [] },
    ],
  };
  const fetched: string[] = [];
  let manifestStatus = over.manifestStatus ?? 200;
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify(manifest), { status: manifestStatus });
    return new Response(new Uint8Array([1, 2, 3]), { status: over.failingFiles ? 404 : 200 });
  }) as typeof fetch;
  const fallback = new FakeSpeechSynthesizer();
  const cancelFallback = vi.spyOn(fallback, "cancel");
  const voiceRef = { current: over.voice ?? "south-f" };
  const elements: FakeAudio[] = [];
  const tts = new AudioPackSynthesizer(fallback, {
    getVoice: () => voiceRef.current,
    fetchFn,
    gestureTarget: over.gestureTarget ?? null,
    ...(over.now ? { now: over.now } : {}),
    waitForServiceWorker: over.waitForServiceWorker ?? (async () => undefined),
    audioFactory: () => {
      const audio = new FakeAudio();
      if (over.playError) audio.playError = over.playError;
      elements.push(audio);
      return audio;
    },
  });
  const audio = (): FakeAudio => {
    const a = elements[0];
    if (!a) throw new Error("no audio element yet");
    return a;
  };
  return { tts, fallback, cancelFallback, fetched, voiceRef, southKeys, elements, audio, setManifestStatus: (s: number) => (manifestStatus = s) };
}

afterEach(() => {
  vi.useRealTimers();
});

test("plays the pack file for the selected voice at the requested rate", async () => {
  const { tts, fallback, southKeys, audio } = await setup();
  const done = tts.speak("xin chào", { rate: 0.6 });
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  expect(audio().playLog[0]).toEqual({ src: `/audio/south-f/${southKeys[0]}.mp3`, rate: 0.6 });
  expect(audio().defaultPlaybackRate).toBe(0.6);
  audio().end();
  await done;
  expect(fallback.spoken).toEqual([]);
});

test("falls back to device TTS when the key is missing from the manifest", async () => {
  const { tts, fallback, elements } = await setup();
  await tts.speak("bao nhiêu tiền", { rate: 1 });
  expect(elements.flatMap((e) => e.playLog)).toHaveLength(0);
  expect(fallback.spoken).toEqual(["bao nhiêu tiền"]);
});

test("falls back when the voice has no files, and when the voice is device", async () => {
  const north = await setup({ voice: "north-f" });
  await north.tts.speak("xin chào");
  expect(north.fallback.spoken).toEqual(["xin chào"]);
  const device = await setup({ voice: "device" });
  await device.tts.speak("xin chào");
  expect(device.fallback.spoken).toEqual(["xin chào"]);
  expect([...north.elements, ...device.elements].flatMap((e) => e.playLog)).toHaveLength(0);
});

test("uses the fallback for explicit audio urls and stops the pack audio that was playing", async () => {
  const { tts, fallback, audio } = await setup();
  const first = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  await tts.speak("xin chào", { audioUrl: "/x.mp3" });
  await first; // superseded: resolved by the stop
  expect(audio().pauses).toBeGreaterThan(0);
  expect(fallback.lastOptions).toEqual({ audioUrl: "/x.mp3" });
  expect(audio().playLog).toHaveLength(1);
});

test("falls back to device TTS when the audio element errors", async () => {
  const { tts, fallback, audio } = await setup();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  audio().fail();
  await done;
  expect(fallback.spoken).toEqual(["xin chào"]);
});

test("falls back to device TTS when play() is rejected (autoplay blocked)", async () => {
  const { tts, fallback } = await setup({ playError: new Error("NotAllowedError") });
  await tts.speak("xin chào");
  expect(fallback.spoken).toEqual(["xin chào"]);
});

test("behaves as the fallback when the manifest cannot be loaded", async () => {
  for (const bad of [{ manifestStatus: 404 }, { manifest: { nope: true } }, { manifest: { version: 1, voices: [] } }]) {
    const { tts, fallback } = await setup(bad);
    await tts.speak("xin chào");
    expect(fallback.spoken).toEqual(["xin chào"]);
    expect(tts.isAvailable()).toBe(true);
  }
});

test("loads the manifest once when it succeeds", async () => {
  const { tts, fetched, audio } = await setup();
  const first = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  audio().end();
  await first;
  await tts.speak("autre texte");
  expect(fetched.filter((u) => u.endsWith("manifest.json"))).toHaveLength(1);
});

test("a failed manifest load is retried by a later speak, but not more often than every 30 s", async () => {
  let clock = 1_000_000;
  const { tts, fetched, fallback, setManifestStatus, audio } = await setup({ manifestStatus: 500, now: () => clock });
  await flush();
  const manifestFetches = () => fetched.filter((u) => u.endsWith("manifest.json")).length;
  expect(manifestFetches()).toBe(1);
  await tts.speak("xin chào"); // too soon: no new request
  expect(manifestFetches()).toBe(1);
  expect(fallback.spoken).toEqual(["xin chào"]);
  setManifestStatus(200);
  clock += 31_000;
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  expect(manifestFetches()).toBe(2);
  audio().end();
  await done;
});

test("cancel stops the playing audio and the fallback, and speak resolves", async () => {
  const { tts, cancelFallback, audio } = await setup();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  cancelFallback.mockClear();
  tts.cancel();
  await done;
  expect(audio().pauses).toBeGreaterThan(0);
  expect(cancelFallback).toHaveBeenCalled();
});

test("cancel while the key is being resolved prevents any playback", async () => {
  const { tts, fallback, elements } = await setup({ mapKeys: false });
  await tts.ready();
  const done = tts.speak("xin chào"); // not in the map: hashed asynchronously
  tts.cancel();
  await done;
  await flush();
  expect(elements.flatMap((e) => e.playLog)).toHaveLength(0);
  expect(fallback.spoken).toEqual([]);
});

test("every speak cancels the previous one: the old audio is stopped and the fallback cancelled", async () => {
  const { tts, cancelFallback, audio } = await setup();
  const first = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  cancelFallback.mockClear();
  const second = tts.speak("cảm ơn");
  await first;
  expect(cancelFallback).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(2));
  audio().end();
  await second;
});

test("starts playback synchronously inside the call once the manifest is loaded (iOS user gesture)", async () => {
  const { tts, fallback, elements } = await setup();
  await tts.ready();
  const done = tts.speak("  xin chào ".normalize("NFD"));
  expect(elements).toHaveLength(1); // the element exists and play() was already called, before any await
  expect(elements[0]?.playLog).toHaveLength(1);
  elements[0]?.end();
  await done;
  expect(fallback.spoken).toEqual([]);
});

test("preloads the manifest at construction", async () => {
  const { tts, fetched } = await setup();
  await flush();
  expect(fetched.filter((u) => u.endsWith("manifest.json"))).toHaveLength(1);
  expect(tts.isAvailable()).toBe(true);
});

test("a text missing from the key map is hashed as a fallback and still played", async () => {
  const { tts, southKeys, audio } = await setup({ mapKeys: false });
  await tts.ready();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  expect(audio().playLog[0]?.src).toBe(`/audio/south-f/${southKeys[0]}.mp3`);
  audio().end();
  await done;
});

test("a pause the player did not ask for (call, Siri, other app) settles the speak without `ended`", async () => {
  const { tts, fallback, audio } = await setup();
  await tts.ready();
  const done = tts.speak("xin chào");
  await vi.waitFor(() => expect(audio().playLog).toHaveLength(1));
  audio().interrupt();
  await done;
  expect(fallback.spoken).toEqual([]);
});

test("never stays pending: no event at all falls back to the device voice after the load cap", async () => {
  const { tts, fallback, elements } = await setup();
  await tts.ready();
  vi.useFakeTimers();
  const done = tts.speak("xin chào");
  let settled = false;
  void done.then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(7000);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  await done;
  expect(elements[0]?.pauses).toBeGreaterThan(0);
  expect(fallback.spoken).toEqual(["xin chào"]);
});

test("never stays pending: once the duration is known it gives up after duration / rate + 2 s", async () => {
  const { tts, fallback, audio } = await setup();
  await tts.ready();
  vi.useFakeTimers();
  const done = tts.speak("xin chào", { rate: 0.5 });
  audio().loaded(2); // 2 s of audio at half speed = 4 s, plus the 2 s margin
  let settled = false;
  void done.then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(5900);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(200);
  await done;
  expect(settled).toBe(true);
  expect(fallback.spoken).toEqual([]); // it did play: nothing to repeat with the device voice
});

test("one audio element is reused for every speak", async () => {
  const { tts, elements, audio } = await setup();
  await tts.ready();
  for (const text of ["xin chào", "cảm ơn", "xin chào"]) {
    const done = tts.speak(text);
    audio().end();
    await done;
  }
  expect(elements).toHaveLength(1);
  expect(audio().playLog).toHaveLength(3);
});

function fakeGestureTarget() {
  const listeners = new Map<string, () => void>();
  const target: GestureTarget = {
    addEventListener: (type, listener) => void listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  return { target, listeners };
}

test("the first gesture unlocks the shared element with a silent clip, once, then removes its listeners", async () => {
  const { target, listeners } = fakeGestureTarget();
  const { tts, audio, southKeys } = await setup({ gestureTarget: target });
  await tts.ready();
  expect([...listeners.keys()].sort()).toEqual(["keydown", "pointerdown", "touchend"]);
  const fire = listeners.get("pointerdown");
  fire?.();
  expect(listeners.size).toBe(0);
  expect(audio().playLog).toHaveLength(1);
  expect(audio().playLog[0]?.src).toMatch(/^data:audio\/wav;base64,/);
  await flush();
  expect(audio().pauses).toBe(1); // the silent clip is paused again
  fire?.(); // a second event is ignored
  expect(audio().playLog).toHaveLength(1);
  // the same element then plays the real clip
  const done = tts.speak("xin chào");
  expect(audio().playLog[1]?.src).toBe(`/audio/south-f/${southKeys[0]}.mp3`);
  audio().end();
  await done;
});

test("the unlock does not cut a playback started by the same gesture", async () => {
  const { target, listeners } = fakeGestureTarget();
  const { tts, audio, southKeys } = await setup({ gestureTarget: target });
  await tts.ready();
  const done = tts.speak("xin chào"); // the tap's click handler ran first
  listeners.get("keydown")?.();
  await flush();
  expect(audio().playLog).toHaveLength(1);
  expect(audio().playLog[0]?.src).toBe(`/audio/south-f/${southKeys[0]}.mp3`);
  expect(audio().pauses).toBe(0);
  audio().end();
  await done;
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
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify({ version: 2, keys: {}, voices: [{ id: "south-m", keys }] }));
    fetched.push(url);
    inFlight++;
    peak = Math.max(peak, inFlight);
    await flush();
    inFlight--;
    return new Response(new Uint8Array([1]));
  }) as typeof fetch;
  const tts = new AudioPackSynthesizer(new FakeSpeechSynthesizer(), {
    getVoice: () => "south-m",
    fetchFn,
    gestureTarget: null,
    waitForServiceWorker: async () => undefined,
  });
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

test("selecting another voice aborts the download of the previous one", async () => {
  const signals = new Map<string, AbortSignal | undefined>();
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("manifest.json")) {
      return Promise.resolve(
        new Response(JSON.stringify({ version: 2, keys: {}, voices: [{ id: "south-f", keys: ["a", "b"] }, { id: "north-f", keys: ["c"] }] })),
      );
    }
    signals.set(url, init?.signal ?? undefined);
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      if (url.includes("north-f")) resolve(new Response(new Uint8Array([1])));
    });
  }) as typeof fetch;
  const tts = new AudioPackSynthesizer(new FakeSpeechSynthesizer(), {
    getVoice: () => "south-f",
    fetchFn,
    gestureTarget: null,
    waitForServiceWorker: async () => undefined,
  });
  const south = tts.prefetchVoice("south-f");
  await vi.waitFor(() => expect(signals.size).toBe(2));
  const north = tts.prefetchVoice("north-f");
  expect(await north).toEqual({ done: 1, total: 1 });
  expect(await south).toEqual({ done: 0, total: 2 });
  expect(signals.get("/audio/south-f/a.mp3")?.aborted).toBe(true);
});

test("prefetch waits for the service worker before downloading", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { tts, fetched } = await setup({ waitForServiceWorker: () => gate });
  const job = tts.prefetchVoice("south-f");
  await flush();
  expect(fetched.filter((u) => u.endsWith(".mp3"))).toHaveLength(0);
  release();
  expect(await job).toEqual({ done: 2, total: 2 });
});

test("detectCapabilities reports tts through the audio pack even without device voices", async () => {
  const { tts, fallback } = await setup();
  fallback.available = false;
  const detect = createDetectCapabilities(tts, new FakeSpeechRecognizer(), new FakeVoiceRecorder());
  await expect(detect()).resolves.toEqual({ tts: true, stt: true, recorder: true });
});
