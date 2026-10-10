import { createDetectCapabilities, MediaRecorderVoiceRecorder, pickVietnameseVoice, WebSpeechRecognizer, WebSpeechSynthesizer } from "@/adapters/speech";
import { RecognitionError } from "@/ports";

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

test("picks a vi-VN voice, preferring Google/network voices on Chrome", () => {
  expect(pickVietnameseVoice([voice("Thomas", "fr-FR"), voice("Linh", "vi-VN"), voice("Google Tiếng Việt", "vi-VN", false)])?.name).toBe("Google Tiếng Việt");
  expect(pickVietnameseVoice([voice("Linh", "vi_VN")])?.name).toBe("Linh"); // Android uses underscore
  expect(pickVietnameseVoice([voice("Thomas", "fr-FR")])).toBeNull();
});

function fakeSynthWindow(getVoices: () => SpeechSynthesisVoice[], listeners: Array<() => void>) {
  return {
    speechSynthesis: {
      getVoices,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => {},
      speak: vi.fn(),
      cancel: vi.fn(),
    },
    SpeechSynthesisUtterance: class {
      lang = "";
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  };
}

test("synthesizer waits for voiceschanged (max 1.5 s) then reports availability", async () => {
  vi.useFakeTimers();
  try {
    let voices: SpeechSynthesisVoice[] = [];
    const listeners: Array<() => void> = [];
    const tts = new WebSpeechSynthesizer(fakeSynthWindow(() => voices, listeners) as never);
    const ready = tts.ready();
    voices = [voice("Linh", "vi-VN")];
    listeners.forEach((l) => l());
    await ready;
    expect(tts.isAvailable()).toBe(true);
    expect(vi.getTimerCount()).toBe(0); // the 1.5 s fallback timer was cleared
  } finally {
    vi.useRealTimers();
  }
});

test("synthesizer gives up after 1.5 s without a Vietnamese voice", async () => {
  vi.useFakeTimers();
  try {
    const tts = new WebSpeechSynthesizer(fakeSynthWindow(() => [], []) as never);
    const ready = tts.ready();
    await vi.advanceTimersByTimeAsync(1500);
    await ready;
    expect(tts.isAvailable()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test("speak uses the Vietnamese voice and resolves on end", async () => {
  const win = fakeSynthWindow(() => [voice("Linh", "vi-VN")], []);
  win.speechSynthesis.speak.mockImplementation((u: { onend: (() => void) | null }) => u.onend?.());
  const tts = new WebSpeechSynthesizer(win as never);
  await tts.speak("xin chào", { rate: 0.7 });
  expect(win.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  expect(win.speechSynthesis.speak.mock.calls[0]?.[0]).toMatchObject({ text: "xin chào", lang: "vi-VN", rate: 0.7 });
});

test("speak gives up after a safety timeout when the utterance is dropped", async () => {
  vi.useFakeTimers();
  try {
    const win = fakeSynthWindow(() => [voice("Linh", "vi-VN")], []); // speak() never fires end
    const tts = new WebSpeechSynthesizer(win as never);
    let settled = false;
    const p = tts.speak("xin chào", { rate: 1 }).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(3199);
    expect(settled).toBe(false);
    const cancels = win.speechSynthesis.cancel.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe(true);
    expect(win.speechSynthesis.cancel.mock.calls.length).toBe(cancels + 1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test("the safety timeout scales with text length and slow rate, and is cleared on a normal end", async () => {
  vi.useFakeTimers();
  try {
    const win = fakeSynthWindow(() => [voice("Linh", "vi-VN")], []);
    win.speechSynthesis.speak.mockImplementation((u: { onend: (() => void) | null }) => u.onend?.());
    await new WebSpeechSynthesizer(win as never).speak("xin chào");
    expect(vi.getTimerCount()).toBe(0);
    const slow = fakeSynthWindow(() => [voice("Linh", "vi-VN")], []);
    const text = "a".repeat(40);
    let settled = false;
    void new WebSpeechSynthesizer(slow as never).speak(text, { rate: 0.5 }).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(40 * 150 / 0.5 + 1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

type FakeRec = {
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function fakeRecognitionWindow(behaviour: (rec: FakeRec) => void) {
  return {
    webkitSpeechRecognition: class {
      lang = "";
      maxAlternatives = 1;
      interimResults = true;
      continuous = true;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        behaviour(this);
      }
      abort() {
        this.onend?.();
      }
      stop() {
        this.onend?.();
      }
    },
  };
}

test("recognizer returns alternatives best-first", async () => {
  const win = fakeRecognitionWindow((rec) => {
    rec.onresult?.({ results: [[{ transcript: "sin chào", confidence: 0.4 }, { transcript: "xin chào", confidence: 0.9 }]] });
    rec.onend?.();
  });
  const stt = new WebSpeechRecognizer(win as never);
  expect(stt.isAvailable()).toBe(true);
  await expect(stt.listen({ lang: "vi-VN", timeoutMs: 8000 })).resolves.toEqual(["xin chào", "sin chào"]);
});

test.each([
  ["not-allowed", "not-allowed"],
  ["service-not-allowed", "not-allowed"],
  ["no-speech", "no-speech"],
  ["language-not-supported", "unsupported"],
  ["network", "network"],
  ["aborted", "aborted"],
])("maps error %s → %s", async (raw, code) => {
  const win = fakeRecognitionWindow((rec) => {
    rec.onerror?.({ error: raw });
    rec.onend?.();
  });
  const err = await new WebSpeechRecognizer(win as never).listen({ lang: "vi-VN", timeoutMs: 8000 }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(RecognitionError);
  expect((err as RecognitionError).code).toBe(code);
});

test("ending without result → no-speech", async () => {
  const win = fakeRecognitionWindow((rec) => rec.onend?.());
  const err = await new WebSpeechRecognizer(win as never).listen({ lang: "vi-VN", timeoutMs: 8000 }).catch((e: unknown) => e);
  expect((err as RecognitionError).code).toBe("no-speech");
});

test("no result before timeoutMs → timeout", async () => {
  vi.useFakeTimers();
  try {
    const win = fakeRecognitionWindow(() => {});
    const p = new WebSpeechRecognizer(win as never).listen({ lang: "vi-VN", timeoutMs: 8000 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(8000);
    expect(((await p) as RecognitionError).code).toBe("timeout");
  } finally {
    vi.useRealTimers();
  }
});

test("unavailable when the API is missing", async () => {
  const stt = new WebSpeechRecognizer({} as never);
  expect(stt.isAvailable()).toBe(false);
  await expect(stt.listen({ lang: "vi-VN", timeoutMs: 1000 })).rejects.toMatchObject({ code: "unsupported" });
});

test("recorder is unavailable without getUserMedia", () => {
  expect(new MediaRecorderVoiceRecorder({} as never).isAvailable()).toBe(false);
});

test("detectCapabilities combines the three adapters", async () => {
  const tts = new WebSpeechSynthesizer(fakeSynthWindow(() => [voice("Linh", "vi-VN")], []) as never);
  const detect = createDetectCapabilities(
    tts,
    { isAvailable: () => true, listen: async () => [], abort() {} },
    { isAvailable: () => false, record: async () => new Blob() },
  );
  await expect(detect()).resolves.toEqual({ tts: true, stt: true, recorder: false });
});

test("synthesizer picks up voices that arrive after the cutoff", async () => {
  vi.useFakeTimers();
  try {
    let voices: SpeechSynthesisVoice[] = [];
    const tts = new WebSpeechSynthesizer(fakeSynthWindow(() => voices, []) as never);
    const ready = tts.ready();
    await vi.advanceTimersByTimeAsync(1500);
    await ready;
    expect(tts.isAvailable()).toBe(false);
    voices = [voice("Linh", "vi-VN")];
    expect(tts.isAvailable()).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

describe("MediaRecorderVoiceRecorder.record", () => {
  type Handlers = { ondataavailable: ((e: { data: Blob }) => void) | null; onstop: (() => void) | null; onerror: (() => void) | null };
  type Inst = Handlers & { state: string; mimeType: string };
  let created: Inst[];
  let startError: Error | null;
  let tracks: Array<{ stop: ReturnType<typeof vi.fn> }>;
  const nav = () =>
    ({
      mediaDevices: {
        getUserMedia: async () => {
          tracks = [{ stop: vi.fn() }];
          return { getTracks: () => tracks };
        },
      },
    }) as never;

  beforeEach(() => {
    created = [];
    startError = null;
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported = () => true;
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: Handlers["ondataavailable"] = null;
        onstop: Handlers["onstop"] = null;
        onerror: Handlers["onerror"] = null;
        constructor() {
          created.push(this);
        }
        start() {
          if (startError) throw startError;
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["abc"]) });
          this.onstop?.();
        }
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("stops at maxMs, returns a Blob and releases the mic", async () => {
    vi.useFakeTimers();
    const p = new MediaRecorderVoiceRecorder(nav()).record(3000);
    await vi.advanceTimersByTimeAsync(3000);
    const blob = await p;
    expect(blob.size).toBe(3);
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  test("recorder error rejects and releases the mic", async () => {
    const p = new MediaRecorderVoiceRecorder(nav()).record(3000).catch((e: unknown) => e);
    await vi.waitFor(() => expect(created).toHaveLength(1));
    created[0]?.onerror?.();
    expect(await p).toBeInstanceOf(Error);
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  test("start() throwing rejects and releases the mic", async () => {
    startError = new Error("boom");
    await expect(new MediaRecorderVoiceRecorder(nav()).record(3000)).rejects.toThrow("boom");
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  test("pre-aborted signal releases the mic and resolves with an empty Blob", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const blob = await new MediaRecorderVoiceRecorder(nav()).record(3000, ctrl.signal);
    expect(blob.size).toBe(0);
    expect(tracks[0]?.stop).toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
});
