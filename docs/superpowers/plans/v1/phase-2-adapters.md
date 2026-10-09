# Phase 2 — Adapters & backend (T11–T15)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read **Global Constraints** first.
> T11, T12, T13, T14 can run in parallel after T03. T15 needs T11–T14.
> Adapters may use browser APIs and SDKs; they must implement the ports from T03 **exactly** (no signature changes).

---

### Task T11: Dexie local storage (ProgressRepository, Outbox, report queue)

**Spec:** §4.6, §6.9, §6.10 · **ADR:** 0004 · **Files:**
- Create: `src/adapters/dexie/db.ts`, `DexieProgressRepository.ts`, `DexieOutbox.ts`, `DexieReportQueue.ts`, `index.ts`, `dexie.test.ts`

**Interfaces:**
- Consumes: ports `ProgressRepository`, `Outbox`, `DEFAULT_SETTINGS` (T03); domain types (T02).
- Produces:
```ts
export class VietLearnDb extends Dexie { /* tables below */ constructor(name?: string) }
export class DexieProgressRepository implements ProgressRepository { constructor(db: VietLearnDb, storage?: Pick<Storage, "setItem">) }
export class DexieOutbox implements Outbox { constructor(db: VietLearnDb) }
export class DexieReportQueue { constructor(db: VietLearnDb); add(r: { refId: string; message: string; contentVersion?: number }): Promise<void>; all(): Promise<Array<{ id: number; refId: string; message: string; contentVersion?: number }>>; remove(id: number): Promise<void> }
export const THEME_STORAGE_KEY = "vl-theme";
```

- [ ] **Step 1: Schema** — `src/adapters/dexie/db.ts`

```ts
import Dexie, { type Table } from "dexie";
import type { AppEvent, VocabProgress } from "@/domain/types";

export type KvRow = { key: string; value: unknown };
export type ReportRow = { id?: number; refId: string; message: string; contentVersion?: number };

export class VietLearnDb extends Dexie {
  events!: Table<AppEvent, string>;
  outbox!: Table<AppEvent, string>;
  vocab!: Table<VocabProgress, string>;
  kv!: Table<KvRow, string>;
  reports!: Table<ReportRow, number>;

  constructor(name = "vietlearn") {
    super(name);
    // Never edit version(1) once shipped: add version(2) with an upgrade() instead.
    this.version(1).stores({
      events: "clientId, createdAt, type",
      outbox: "clientId, createdAt",
      vocab: "vocabId, dueAt",
      kv: "key",
      reports: "++id",
    });
  }
}
```

- [ ] **Step 2: Failing tests** — `src/adapters/dexie/dexie.test.ts`

```ts
import { VietLearnDb, DexieProgressRepository, DexieOutbox, DexieReportQueue, THEME_STORAGE_KEY } from "@/adapters/dexie";

const NOW = "2026-10-10T08:00:00.000Z";
let db: VietLearnDb;
beforeEach(() => { db = new VietLearnDb(`test-${crypto.randomUUID()}`); });
afterEach(async () => { await db.delete(); });

test("events are appended with uuid/createdAt and listed in order", async () => {
  const repo = new DexieProgressRepository(db);
  await repo.appendEvent({ type: "lesson_completed", refId: "l02", xp: 10, payload: {} }, "2026-10-10T09:00:00.000Z");
  await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  const events = await repo.listEvents();
  expect(events.map((e) => e.refId)).toEqual(["l01", "l02"]);
  expect(events[0]).toMatchObject({ schemaVersion: 1, createdAt: NOW });
});

test("vocab progress upsert, due list and count", async () => {
  const repo = new DexieProgressRepository(db);
  await repo.upsertVocabProgress({ vocabId: "v_a", box: 1, dueAt: "2026-10-09T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: NOW });
  await repo.upsertVocabProgress({ vocabId: "v_b", box: 2, dueAt: "2026-10-12T00:00:00.000Z", correct: 1, wrong: 0, lastSeenAt: NOW });
  expect((await repo.listDueVocab(NOW, 10)).map((p) => p.vocabId)).toEqual(["v_a"]);
  expect(await repo.countDueVocab(NOW)).toBe(1);
  expect(await repo.getVocabProgress("v_b")).toMatchObject({ box: 2 });
});

test("settings default, save, and theme mirrored to storage", async () => {
  const store = new Map<string, string>();
  const repo = new DexieProgressRepository(db, { setItem: (k, v) => void store.set(k, v) });
  expect(await repo.getSettings()).toEqual({ theme: "system", voiceRate: "normal", capabilities: null, onboardingDone: false });
  await repo.saveSettings({ theme: "dark", voiceRate: "slow", capabilities: { tts: true, stt: false, recorder: true }, onboardingDone: true });
  expect((await repo.getSettings()).theme).toBe("dark");
  expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
});

test("leaderboard cache roundtrip", async () => {
  const repo = new DexieProgressRepository(db);
  expect(await repo.getCachedLeaderboard("week")).toBeUndefined();
  await repo.cacheLeaderboard("week", [{ userId: "u", pseudo: "A", avatarEmoji: "🐉", xp: 3, streak: 1, lessonsDone: 1, isMe: true }], NOW);
  expect(await repo.getCachedLeaderboard("week")).toMatchObject({ fetchedAt: NOW, rows: [{ pseudo: "A" }] });
});

test("outbox enqueue/peek/ack/size", async () => {
  const repo = new DexieProgressRepository(db);
  const ob = new DexieOutbox(db);
  const a = await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  const b = await repo.appendEvent({ type: "lesson_completed", refId: "l02", xp: 10, payload: {} }, "2026-10-10T09:00:00.000Z");
  await ob.enqueue(b); await ob.enqueue(a);
  expect((await ob.peek(1)).map((e) => e.refId)).toEqual(["l01"]);
  await ob.ack([a.clientId]);
  expect(await ob.size()).toBe(1);
});

test("clearAll wipes every table", async () => {
  const repo = new DexieProgressRepository(db);
  await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await repo.clearAll();
  expect(await repo.listEvents()).toEqual([]);
});

test("report queue", async () => {
  const q = new DexieReportQueue(db);
  await q.add({ refId: "v_ly", message: "faute" });
  const all = await q.all();
  expect(all).toHaveLength(1);
  await q.remove(all[0]!.id);
  expect(await q.all()).toEqual([]);
});
```
Run: `npx vitest run src/adapters/dexie` → FAIL.

- [ ] **Step 3: Implement**

`DexieProgressRepository.ts`:
```ts
import type { ProgressRepository } from "@/ports";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import type { AppEvent, LeaderboardRow, NewEvent, Settings, VocabProgress } from "@/domain/types";
import type { VietLearnDb } from "@/adapters/dexie/db";

export const THEME_STORAGE_KEY = "vl-theme";
const SETTINGS_KEY = "settings";
const lbKey = (p: "week" | "all") => `leaderboard:${p}`;

export class DexieProgressRepository implements ProgressRepository {
  constructor(
    private readonly db: VietLearnDb,
    private readonly storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
  ) {}

  async appendEvent(e: NewEvent, nowIso: string): Promise<AppEvent> {
    const ev: AppEvent = { ...e, clientId: crypto.randomUUID(), schemaVersion: 1, createdAt: nowIso };
    await this.db.events.add(ev);
    return ev;
  }
  listEvents() { return this.db.events.orderBy("createdAt").toArray(); }
  getVocabProgress(id: string) { return this.db.vocab.get(id); }
  async upsertVocabProgress(p: VocabProgress) { await this.db.vocab.put(p); }
  listDueVocab(nowIso: string, limit: number) { return this.db.vocab.where("dueAt").belowOrEqual(nowIso).limit(limit).sortBy("dueAt"); }
  countDueVocab(nowIso: string) { return this.db.vocab.where("dueAt").belowOrEqual(nowIso).count(); }
  async getSettings(): Promise<Settings> {
    const row = await this.db.kv.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
  }
  async saveSettings(s: Settings) {
    await this.db.kv.put({ key: SETTINGS_KEY, value: s });
    try { this.storage?.setItem(THEME_STORAGE_KEY, s.theme); } catch { /* private mode: ignore */ }
  }
  async getCachedLeaderboard(period: "week" | "all") {
    const row = await this.db.kv.get(lbKey(period));
    return row?.value as { rows: LeaderboardRow[]; fetchedAt: string } | undefined;
  }
  async cacheLeaderboard(period: "week" | "all", rows: LeaderboardRow[], fetchedAt: string) {
    await this.db.kv.put({ key: lbKey(period), value: { rows, fetchedAt } });
  }
  async clearAll() {
    await this.db.transaction("rw", [this.db.events, this.db.outbox, this.db.vocab, this.db.kv, this.db.reports], async () => {
      await Promise.all([this.db.events.clear(), this.db.outbox.clear(), this.db.vocab.clear(), this.db.kv.clear(), this.db.reports.clear()]);
    });
  }
}
```
`DexieOutbox.ts`:
```ts
import type { Outbox } from "@/ports";
import type { AppEvent } from "@/domain/types";
import type { VietLearnDb } from "@/adapters/dexie/db";

export class DexieOutbox implements Outbox {
  constructor(private readonly db: VietLearnDb) {}
  async enqueue(e: AppEvent) { await this.db.outbox.put(e); }
  peek(n: number) { return this.db.outbox.orderBy("createdAt").limit(n).toArray(); }
  async ack(ids: string[]) { await this.db.outbox.bulkDelete(ids); }
  size() { return this.db.outbox.count(); }
}
```
`DexieReportQueue.ts`: straightforward wrapper over `db.reports` (`add`, `toArray()` mapped to rows with non-optional `id`, `delete`).
`index.ts`: export `VietLearnDb`, `DexieProgressRepository`, `DexieOutbox`, `DexieReportQueue`, `THEME_STORAGE_KEY`.

Note: `DEFAULT_SETTINGS` is declared `as const` in T03, so spread it into a mutable `Settings` object as shown (`{ ...DEFAULT_SETTINGS, ... }`).

- [ ] **Step 4: Run** tests → PASS; `npm run verify` → PASS. **Commit:** `feat(adapters): add Dexie progress repository, outbox and report queue`

---

### Task T12: Speech adapters (Web Speech API + MediaRecorder) and capability detection

**Spec:** §6.1 step 4, §6.4 speak, §6.5, §9 · **Files:**
- Create: `src/adapters/speech/WebSpeechSynthesizer.ts`, `WebSpeechRecognizer.ts`, `MediaRecorderVoiceRecorder.ts`, `capabilities.ts`, `index.ts`, `speech.test.ts`

**Interfaces:**
- Consumes: ports `SpeechSynthesizer`, `SpeechRecognizer`, `VoiceRecorder`, `RecognitionError` (T03).
- Produces:
```ts
export class WebSpeechSynthesizer implements SpeechSynthesizer { constructor(win?: SpeechWindow); ready(): Promise<void> }
export class WebSpeechRecognizer implements SpeechRecognizer { constructor(win?: RecognitionWindow) }
export class MediaRecorderVoiceRecorder implements VoiceRecorder { constructor(nav?: Navigator) }
export function createDetectCapabilities(tts: WebSpeechSynthesizer, stt: SpeechRecognizer, rec: VoiceRecorder): () => Promise<Capabilities>;
export function pickVietnameseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null;
```

- [ ] **Step 1: Failing tests** — `src/adapters/speech/speech.test.ts` (inject fake window objects; jsdom has no Web Speech)

```ts
import { pickVietnameseVoice, WebSpeechRecognizer, WebSpeechSynthesizer } from "@/adapters/speech";
import { RecognitionError } from "@/ports";

const voice = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

test("picks a vi-VN voice, preferring Google/network voices on Chrome", () => {
  expect(pickVietnameseVoice([voice("Thomas", "fr-FR"), voice("Linh", "vi-VN"), voice("Google Tiếng Việt", "vi-VN", false)])?.name).toBe("Google Tiếng Việt");
  expect(pickVietnameseVoice([voice("Linh", "vi_VN")])?.name).toBe("Linh"); // Android uses underscore
  expect(pickVietnameseVoice([voice("Thomas", "fr-FR")])).toBeNull();
});

test("synthesizer waits for voiceschanged (max 1.5 s) then reports availability", async () => {
  vi.useFakeTimers();
  let voices: SpeechSynthesisVoice[] = [];
  const listeners: Array<() => void> = [];
  const win = {
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => {},
      speak: vi.fn(), cancel: vi.fn(),
    },
    SpeechSynthesisUtterance: class { lang = ""; rate = 1; voice: unknown = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} },
  };
  const tts = new WebSpeechSynthesizer(win as never);
  const ready = tts.ready();
  voices = [voice("Linh", "vi-VN")];
  listeners.forEach((l) => l());
  await ready;
  expect(tts.isAvailable()).toBe(true);
  vi.useRealTimers();
});

function fakeRecognitionWindow(behaviour: (rec: Record<string, any>) => void) {
  return {
    webkitSpeechRecognition: class {
      lang = ""; maxAlternatives = 1; interimResults = true; continuous = true;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
      start() { behaviour(this as never); }
      abort() { this.onend?.(); }
      stop() { this.onend?.(); }
    },
  };
}

test("recognizer returns alternatives best-first", async () => {
  const win = fakeRecognitionWindow((rec) => {
    rec.onresult?.({ results: [[{ transcript: "xin chào", confidence: 0.9 }, { transcript: "sin chào", confidence: 0.4 }]] });
    rec.onend?.();
  });
  const stt = new WebSpeechRecognizer(win as never);
  expect(stt.isAvailable()).toBe(true);
  await expect(stt.listen({ lang: "vi-VN", timeoutMs: 8000 })).resolves.toEqual(["xin chào", "sin chào"]);
});

test.each([
  ["not-allowed", "not-allowed"], ["service-not-allowed", "not-allowed"], ["no-speech", "no-speech"],
  ["language-not-supported", "unsupported"], ["network", "network"], ["aborted", "aborted"],
])("maps error %s → %s", async (raw, code) => {
  const win = fakeRecognitionWindow((rec) => { rec.onerror?.({ error: raw }); rec.onend?.(); });
  const err = await new WebSpeechRecognizer(win as never).listen({ lang: "vi-VN", timeoutMs: 8000 }).catch((e) => e);
  expect(err).toBeInstanceOf(RecognitionError);
  expect(err.code).toBe(code);
});

test("ending without result → no-speech", async () => {
  const win = fakeRecognitionWindow((rec) => rec.onend?.());
  const err = await new WebSpeechRecognizer(win as never).listen({ lang: "vi-VN", timeoutMs: 8000 }).catch((e) => e);
  expect(err.code).toBe("no-speech");
});

test("unavailable when the API is missing", () => {
  expect(new WebSpeechRecognizer({} as never).isAvailable()).toBe(false);
});
```
Run → FAIL.

- [ ] **Step 2: Implement `WebSpeechSynthesizer.ts`**

```ts
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
      if (!synth) return resolve();
      const pick = () => { this.voice = pickVietnameseVoice(synth.getVoices()); };
      pick();
      if (this.voice) return resolve();
      const onChange = () => { pick(); if (this.voice) { synth.removeEventListener("voiceschanged", onChange); resolve(); } };
      synth.addEventListener("voiceschanged", onChange);
      setTimeout(() => { synth.removeEventListener("voiceschanged", onChange); resolve(); }, 1500);
    });
    return this.readyPromise;
  }

  isAvailable(): boolean {
    return this.voice !== null;
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    if (opts.audioUrl && this.win.Audio) {
      const audio = new this.win.Audio(opts.audioUrl);
      audio.playbackRate = opts.rate ?? 1;
      await new Promise<void>((resolve, reject) => { audio.onended = () => resolve(); audio.onerror = () => reject(new Error("audio_failed")); void audio.play().catch(reject); });
      return;
    }
    await this.ready();
    const synth = this.win.speechSynthesis, Utt = this.win.SpeechSynthesisUtterance;
    if (!synth || !Utt || !this.voice) throw new Error("tts_unavailable");
    synth.cancel();
    const u = new Utt(text);
    u.lang = "vi-VN";
    u.voice = this.voice;
    u.rate = opts.rate ?? 1;
    await new Promise<void>((resolve) => { u.onend = () => resolve(); u.onerror = () => resolve(); synth.speak(u); });
  }

  cancel(): void {
    this.win.speechSynthesis?.cancel();
  }
}
```

- [ ] **Step 3: Implement `WebSpeechRecognizer.ts`**

```ts
import { RecognitionError, type RecognitionErrorCode, type SpeechRecognizer } from "@/ports";

type Alt = { transcript: string; confidence: number };
type RecInstance = {
  lang: string; maxAlternatives: number; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alt>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void; stop(): void;
};
type RecCtor = new () => RecInstance;
export type RecognitionWindow = { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };

const MAP: Record<string, RecognitionErrorCode> = {
  "not-allowed": "not-allowed", "service-not-allowed": "not-allowed", "no-speech": "no-speech",
  "language-not-supported": "unsupported", network: "network", aborted: "aborted", "audio-capture": "not-allowed",
};

export class WebSpeechRecognizer implements SpeechRecognizer {
  private current: RecInstance | null = null;
  constructor(private readonly win: RecognitionWindow = window as unknown as RecognitionWindow) {}

  private ctor(): RecCtor | undefined { return this.win.SpeechRecognition ?? this.win.webkitSpeechRecognition; }
  isAvailable(): boolean { return this.ctor() !== undefined; }

  listen({ lang, timeoutMs }: { lang: "vi-VN"; timeoutMs: number }): Promise<string[]> {
    const Ctor = this.ctor();
    if (!Ctor) return Promise.reject(new RecognitionError("unsupported"));
    this.abort();
    const rec = new Ctor();
    this.current = rec;
    rec.lang = lang; rec.maxAlternatives = 5; rec.interimResults = false; rec.continuous = false;
    return new Promise<string[]>((resolve, reject) => {
      let settled = false;
      let result: string[] | null = null;
      let error: RecognitionErrorCode | null = null;
      const timer = setTimeout(() => { error = "timeout"; rec.abort(); }, timeoutMs);
      rec.onresult = (e) => {
        const first = e.results[0];
        result = first ? Array.from(first).sort((a, b) => b.confidence - a.confidence).map((a) => a.transcript) : [];
      };
      rec.onerror = (e) => { error ??= MAP[e.error] ?? "aborted"; };
      rec.onend = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.current = null;
        if (result && result.length) resolve(result);
        else reject(new RecognitionError(error ?? "no-speech"));
      };
      rec.start();
    });
  }

  abort(): void { this.current?.abort(); this.current = null; }
}
```

- [ ] **Step 4: Implement `MediaRecorderVoiceRecorder.ts` and `capabilities.ts`**

```ts
// MediaRecorderVoiceRecorder.ts
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
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    return new Promise<Blob>((resolve) => {
      const stop = () => { if (rec.state !== "inactive") rec.stop(); };
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
```
```ts
// capabilities.ts
import type { Capabilities } from "@/domain/types";
import type { SpeechRecognizer, VoiceRecorder } from "@/ports";
import type { WebSpeechSynthesizer } from "@/adapters/speech/WebSpeechSynthesizer";

export function createDetectCapabilities(tts: WebSpeechSynthesizer, stt: SpeechRecognizer, rec: VoiceRecorder) {
  return async (): Promise<Capabilities> => {
    await tts.ready();
    return { tts: tts.isAvailable(), stt: stt.isAvailable(), recorder: rec.isAvailable() };
  };
}
```
Note: `stt: true` only means the API exists. If a real `listen()` later fails with `unsupported` or `not-allowed`, the features set `capabilities.stt = false` in settings (spec §9) — that logic lives in the speak plugin (T20) and conversation (T25).

- [ ] **Step 5: Run** tests → PASS; `npm run verify`. **Commit:** `feat(adapters): add Web Speech TTS/STT, MediaRecorder and capability detection`

Real-device checks of speech happen in T36; this task is validated by unit tests only.

---

### Task T13: Static content source and scripted conversation engine

**Spec:** §3, §6.7 · **ADR:** 0003 · **Files:**
- Create: `src/adapters/content/StaticContentSource.ts`, `src/adapters/content/StaticContentSource.test.ts`, `src/adapters/content/index.ts`
- Create: `src/adapters/conversation/ScriptedConversationEngine.ts`, `ScriptedConversationEngine.test.ts`, `index.ts`
- Modify: `src/adapters/fakes/createFakeServices.ts` (use `ScriptedConversationEngine` over the fake content)

**Interfaces:**
- Produces:
```ts
export type ContentLoaders = {
  lessons: Record<string, () => Promise<unknown>>;   // key = file path, value = loader returning parsed JSON
  dialogues: Record<string, () => Promise<unknown>>;
  exam: () => Promise<unknown>;
  badges: () => Promise<unknown>;
};
export class StaticContentSource implements ContentSource { constructor(loaders: ContentLoaders) }
export function createStaticContentSource(): StaticContentSource; // uses import.meta.glob
export const MATCH_THRESHOLD = 0.6;
export class ScriptedConversationEngine implements ConversationEngine {
  constructor(content: Pick<ContentSource, "getDialogue">, score?: (expected: string, heard: readonly string[]) => number);
}
```

- [ ] **Step 1: Failing tests**

`StaticContentSource.test.ts`:
```ts
import { StaticContentSource } from "@/adapters/content";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";
import { examPoolFixture } from "@/test/fixtures/examFixture";
import badges from "@/content/badges.json";
import { ContentNotFoundError } from "@/domain/errors";

const l01 = { ...structuredClone(lessonFixture), id: "l01", dialogueId: "d01" };
const src = new StaticContentSource({
  lessons: { "/src/content/lessons/l05.json": async () => lessonFixture, "/src/content/lessons/l01.json": async () => l01 },
  dialogues: { "/src/content/dialogues/d05.json": async () => dialogueFixture },
  exam: async () => ({ contentVersion: 1, questions: examPoolFixture }),
  badges: async () => badges,
});

test("lists lessons ordered by id with order numbers", async () => {
  expect((await src.listLessons()).map((l) => [l.id, l.order])).toEqual([["l01", 1], ["l05", 2]]);
});
test("gets a lesson by id and validates it", async () => expect((await src.getLesson("l05")).title).toBe("Au café"));
test("unknown ids throw ContentNotFoundError", async () => {
  await expect(src.getLesson("l99")).rejects.toBeInstanceOf(ContentNotFoundError);
  await expect(src.getDialogue("d99")).rejects.toBeInstanceOf(ContentNotFoundError);
});
test("vocab index spans all lessons", async () => expect((await src.getVocabIndex()).get("v_ly")?.vi).toBe("ly"));
test("exam pool and badges", async () => {
  expect(await src.getExamPool()).toHaveLength(60);
  expect((await src.getBadges()).length).toBe(12);
});
```
`ScriptedConversationEngine.test.ts`:
```ts
import { ScriptedConversationEngine } from "@/adapters/conversation";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";

const engine = new ScriptedConversationEngine({ getDialogue: async () => dialogueFixture });

test("start plays npc turns until the first user turn", async () => {
  const s = await engine.start("d05");
  expect(s.history.map((h) => h.turnId)).toEqual(["t1"]);
  expect(s).toMatchObject({ currentTurnId: "t2", awaitingUser: true, finished: false, misunderstood: false });
});
test("choosing an option advances through the following npc turns", async () => {
  const s = await engine.answer(await engine.start("d05"), { kind: "choice", optionId: "o2" });
  expect(s.history.map((h) => `${h.speaker}:${h.turnId}`)).toEqual(["npc:t1", "user:t2", "npc:t3"]);
  expect(s.history[1]?.vi).toBe("Cho tui một ly trà đá.");
  expect(s.currentTurnId).toBe("t4");
});
test("speech picks the closest option above the threshold", async () => {
  const s = await engine.answer(await engine.start("d05"), { kind: "speech", alternatives: ["cho tui một ly cà phê sữa đá"] });
  expect(s.history[1]?.vi).toBe("Cho tui một ly cà phê sữa đá.");
});
test("unintelligible speech sets misunderstood and does not advance", async () => {
  const start = await engine.start("d05");
  const s = await engine.answer(start, { kind: "speech", alternatives: ["hello"] });
  expect(s.misunderstood).toBe(true);
  expect(s.currentTurnId).toBe("t2");
  expect(s.history).toHaveLength(1);
});
test("dialogue finishes after the last npc turn", async () => {
  let s = await engine.start("d05");
  s = await engine.answer(s, { kind: "choice", optionId: "o1" });
  s = await engine.answer(s, { kind: "choice", optionId: "o1" });
  expect(s).toMatchObject({ finished: true, currentTurnId: null, awaitingUser: false });
  expect(s.history.at(-1)?.turnId).toBe("t5");
});
```
Run → FAIL.

- [ ] **Step 2: Implement `StaticContentSource.ts`**

```ts
import type { ContentSource } from "@/ports";
import type { BadgeDef, Dialogue, ExamQuestion, Lesson, LessonSummary, VocabItem } from "@/domain/types";
import { BadgesFileSchema, DialogueSchema, ExamPoolSchema, LessonSchema } from "@/content/schema";
import { ContentNotFoundError } from "@/domain/errors";

export type ContentLoaders = {
  lessons: Record<string, () => Promise<unknown>>;
  dialogues: Record<string, () => Promise<unknown>>;
  exam: () => Promise<unknown>;
  badges: () => Promise<unknown>;
};
const idFromPath = (p: string) => p.split("/").pop()!.replace(/\.json$/, "");

export class StaticContentSource implements ContentSource {
  private lessonCache = new Map<string, Promise<Lesson>>();
  constructor(private readonly loaders: ContentLoaders) {}

  private lessonPaths() {
    return Object.keys(this.loaders.lessons).sort((a, b) => idFromPath(a).localeCompare(idFromPath(b)));
  }
  getLesson(id: string): Promise<Lesson> {
    const path = this.lessonPaths().find((p) => idFromPath(p) === id);
    if (!path) return Promise.reject(new ContentNotFoundError(id));
    let p = this.lessonCache.get(id);
    if (!p) {
      p = this.loaders.lessons[path]!().then((raw) => LessonSchema.parse(raw));
      this.lessonCache.set(id, p);
    }
    return p;
  }
  async listLessons(): Promise<LessonSummary[]> {
    const lessons = await Promise.all(this.lessonPaths().map((p) => this.getLesson(idFromPath(p))));
    return lessons.map((l, i) => ({ id: l.id, title: l.title, description: l.description, emoji: l.emoji, dialogueId: l.dialogueId, order: i + 1 }));
  }
  async getDialogue(id: string): Promise<Dialogue> {
    const path = Object.keys(this.loaders.dialogues).find((p) => idFromPath(p) === id);
    if (!path) throw new ContentNotFoundError(id);
    return DialogueSchema.parse(await this.loaders.dialogues[path]!());
  }
  async getExamPool(): Promise<ExamQuestion[]> { return ExamPoolSchema.parse(await this.loaders.exam()).questions; }
  async getBadges(): Promise<BadgeDef[]> { return BadgesFileSchema.parse(await this.loaders.badges()).badges; }
  async getVocabIndex(): Promise<ReadonlyMap<string, VocabItem>> {
    const lessons = await Promise.all(this.lessonPaths().map((p) => this.getLesson(idFromPath(p))));
    return new Map(lessons.flatMap((l) => l.vocab.map((v) => [v.id, v] as const)));
  }
}

export function createStaticContentSource(): StaticContentSource {
  const lessons = import.meta.glob("/src/content/lessons/*.json", { import: "default" });
  const dialogues = import.meta.glob("/src/content/dialogues/*.json", { import: "default" });
  const exam = import.meta.glob("/src/content/exam.json", { import: "default" });
  const badges = import.meta.glob("/src/content/badges.json", { import: "default", eager: true });
  return new StaticContentSource({
    lessons, dialogues,
    exam: async () => (exam["/src/content/exam.json"] ? exam["/src/content/exam.json"]() : { contentVersion: 1, questions: [] }),
    badges: async () => badges["/src/content/badges.json"],
  });
}
```
Each lesson file becomes its own lazy chunk (ADR 0003): verify after `npm run build` that `dist/assets/` contains one small chunk per lesson JSON once content exists.

- [ ] **Step 3: Implement `ScriptedConversationEngine.ts`**

```ts
import type { ContentSource, ConversationEngine, ConversationInput } from "@/ports";
import type { ConversationState, Dialogue, Turn } from "@/domain/types";
import { scorePronunciation } from "@/services/pronunciation";

export const MATCH_THRESHOLD = 0.6;
const defaultScore = (expected: string, heard: readonly string[]) => scorePronunciation(expected, heard).score;

export class ScriptedConversationEngine implements ConversationEngine {
  private dialogues = new Map<string, Dialogue>();
  constructor(
    private readonly content: Pick<ContentSource, "getDialogue">,
    private readonly score: (expected: string, heard: readonly string[]) => number = defaultScore,
  ) {}

  private async dialogue(id: string) {
    let d = this.dialogues.get(id);
    if (!d) { d = await this.content.getDialogue(id); this.dialogues.set(id, d); }
    return d;
  }
  private turn(d: Dialogue, id: string | null): Turn | undefined { return id ? d.turns.find((t) => t.id === id) : undefined; }

  /** Appends consecutive npc turns starting at `id`; stops at a user turn or the end. */
  private advance(d: Dialogue, state: ConversationState, id: string | null): ConversationState {
    const history = [...state.history];
    let cur = id;
    for (let t = this.turn(d, cur); t && t.speaker === "npc"; t = this.turn(d, cur)) {
      history.push({ turnId: t.id, speaker: "npc", vi: t.vi, fr: t.fr });
      cur = t.next;
    }
    const finished = cur === null;
    return { ...state, history, currentTurnId: cur, awaitingUser: !finished, finished, misunderstood: false };
  }

  async start(dialogueId: string): Promise<ConversationState> {
    const d = await this.dialogue(dialogueId);
    const empty: ConversationState = { dialogueId, history: [], currentTurnId: null, awaitingUser: false, misunderstood: false, finished: false };
    return this.advance(d, empty, d.turns[0]?.id ?? null);
  }

  async answer(state: ConversationState, input: ConversationInput): Promise<ConversationState> {
    const d = await this.dialogue(state.dialogueId);
    const t = this.turn(d, state.currentTurnId);
    if (!t || t.speaker !== "user") return state;
    let option = input.kind === "choice" ? t.options.find((o) => o.id === input.optionId) : undefined;
    if (input.kind === "speech") {
      const ranked = t.options.map((o) => ({ o, s: this.score(o.vi, input.alternatives) })).sort((a, b) => b.s - a.s);
      if (ranked[0] && ranked[0].s >= MATCH_THRESHOLD) option = ranked[0].o;
    }
    if (!option) return { ...state, misunderstood: true };
    const withUser: ConversationState = { ...state, history: [...state.history, { turnId: t.id, speaker: "user", vi: option.vi, fr: option.fr }] };
    return this.advance(d, withUser, option.next);
  }
}
```

- [ ] **Step 4: Wire fakes** — in `createFakeServices`, replace the placeholder `conversation` by `new ScriptedConversationEngine(content)` (construct `content` as a const first).
- [ ] **Step 5: Run** → PASS; `npm run verify`. **Commit:** `feat(adapters): add static content source and scripted conversation engine`

---

### Task T14: Supabase schema, security, functions and SQL tests

**Spec:** §5 (all) · **ADR:** 0005, 0006 · **Prerequisite:** Docker Desktop running (else: write files, run `npx supabase db lint` only, and mark SQL tests "to run in CI" in the report).

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261010000000_init.sql`, `supabase/seed.sql`, `supabase/tests/00_schema_test.sql`, `supabase/templates/otp.html`
- Modify: `package.json` (add `supabase@^1` to devDependencies — the CLI; allowed: dev tool only) and scripts `"db:start": "supabase start"`, `"db:reset": "supabase db reset"`, `"db:test": "supabase test db"`, `"db:types": "supabase gen types typescript --local > src/adapters/supabase/types.gen.ts"`

**Interfaces — Produces (consumed by T15):**
- Tables `groups`, `profiles`, `events`, `user_stats`, `exam_attempts`, `content_reports`; view `leaderboard`.
- RPCs: `join_group(p_invite_code text, p_pseudo text, p_avatar text) returns void` (errors `invalid_invite`, `pseudo_taken`, `not_authenticated`); `start_exam_attempt() returns json {attempt_id, remaining_today}` (error `exam_limit`); `delete_my_account() returns void`.
- Local invite code (seed): `TEST-CODE`.

- [ ] **Step 1: Init and install CLI**

```bash
npm install -D supabase@^1
npx supabase init
```
In `supabase/config.toml` set (keep the other generated defaults):
```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:4173"]

[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600

[auth.email.template.magic_link]
subject = "Ton code VietLearn"
content_path = "./supabase/templates/otp.html"

[auth.email.template.confirmation]
subject = "Ton code VietLearn"
content_path = "./supabase/templates/otp.html"
```
`supabase/templates/otp.html`:
```html
<h2>Chào bạn ! 👋</h2>
<p>Voici ton code de connexion VietLearn :</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
<p>Saisis-le dans l'application. Il expire dans une heure.</p>
```

- [ ] **Step 2: Write the migration** — `supabase/migrations/20261010000000_init.sql`

```sql
-- VietLearn initial schema. Never edit after it is applied to prod: add a new migration.
create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.paris_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;

create or replace function public.paris_week_start(d date) returns date
language sql immutable as $$ select (date_trunc('week', d::timestamp))::date $$;

-- ---------- tables ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  group_id uuid not null references public.groups,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  avatar_emoji text not null default '🐉',
  created_at timestamptz not null default now(),
  unique (group_id, pseudo)
);

create table public.events (
  id bigint generated always as identity primary key,
  client_id uuid unique not null,
  user_id uuid not null references public.profiles on delete cascade,
  schema_version int not null default 1,
  type text not null check (type in ('lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked')),
  ref_id text not null,
  xp int not null check (xp between 0 and 100),
  payload jsonb not null default '{}',
  client_created_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index events_user_created on public.events (user_id, created_at);

create table public.user_stats (
  user_id uuid primary key references public.profiles on delete cascade,
  group_id uuid not null references public.groups,
  xp_total int not null default 0,
  xp_week int not null default 0,
  week_start date not null default public.paris_week_start(public.paris_today()),
  xp_today int not null default 0,
  today date not null default public.paris_today(),
  streak int not null default 0,
  last_active_day date,
  lessons_done text[] not null default '{}',
  dialogues_done text[] not null default '{}',
  badges text[] not null default '{}',
  exam_best int,
  updated_at timestamptz not null default now()
);
create index user_stats_group_week on public.user_stats (group_id, xp_week desc);
create index user_stats_group_total on public.user_stats (group_id, xp_total desc);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null default now(),
  score int check (score between 0 and 100)
);
create index exam_attempts_user_started on public.exam_attempts (user_id, started_at);

create table public.content_reports (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  ref_id text not null,
  message text not null check (char_length(message) between 1 and 500),
  content_version int,
  created_at timestamptz not null default now()
);

-- ---------- security helpers ----------
create or replace function public.my_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.profiles where id = auth.uid()
$$;

-- ---------- RPC: join a group ----------
create or replace function public.join_group(p_invite_code text, p_pseudo text, p_avatar text) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into g from public.groups where invite_code = p_invite_code;
  if g is null then raise exception 'invalid_invite'; end if;
  begin
    insert into public.profiles (id, group_id, pseudo, avatar_emoji)
    values (auth.uid(), g, p_pseudo, p_avatar)
    on conflict (id) do update set pseudo = excluded.pseudo, avatar_emoji = excluded.avatar_emoji;
  exception when unique_violation then
    raise exception 'pseudo_taken';
  end;
  insert into public.user_stats (user_id, group_id) values (auth.uid(), g) on conflict (user_id) do nothing;
end $$;

-- ---------- trigger: project events into user_stats ----------
create or replace function public.apply_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.user_stats%rowtype;
  v_today date := public.paris_today();
  v_week date := public.paris_week_start(public.paris_today());
  v_day date := (least(new.client_created_at, now()) at time zone 'Europe/Paris')::date;
  v_score int := coalesce((new.payload->>'score')::int, 0);
  v_credit int;
begin
  select * into s from public.user_stats where user_id = new.user_id for update;
  if not found then return new; end if;

  if s.today <> v_today then s.xp_today := 0; s.today := v_today; end if;
  if s.week_start <> v_week then s.xp_week := 0; s.week_start := v_week; end if;

  if new.type = 'exam_finished' then
    v_credit := greatest(0, v_score - coalesce(s.exam_best, 0));  -- client xp ignored
    s.exam_best := greatest(coalesce(s.exam_best, 0), v_score);
  else
    v_credit := new.xp;
  end if;
  v_credit := least(v_credit, greatest(0, 200 - s.xp_today));
  s.xp_total := s.xp_total + v_credit;
  s.xp_week := s.xp_week + v_credit;
  s.xp_today := s.xp_today + v_credit;

  if new.type in ('lesson_completed','dialogue_completed','review_session_completed') then
    if s.last_active_day is null or v_day > s.last_active_day then
      s.streak := case when s.last_active_day = v_day - 1 then s.streak + 1 else 1 end;
      s.last_active_day := v_day;
    end if;
  end if;
  if new.type = 'lesson_completed' and not (new.ref_id = any(s.lessons_done)) then
    s.lessons_done := array_append(s.lessons_done, new.ref_id);
  end if;
  if new.type = 'dialogue_completed' and not (new.ref_id = any(s.dialogues_done)) then
    s.dialogues_done := array_append(s.dialogues_done, new.ref_id);
  end if;
  if new.type = 'badge_unlocked' and not (new.ref_id = any(s.badges)) then
    s.badges := array_append(s.badges, new.ref_id);
  end if;

  update public.user_stats set
    xp_total = s.xp_total, xp_week = s.xp_week, week_start = s.week_start, xp_today = s.xp_today, today = s.today,
    streak = s.streak, last_active_day = s.last_active_day, lessons_done = s.lessons_done,
    dialogues_done = s.dialogues_done, badges = s.badges, exam_best = s.exam_best, updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

create trigger events_apply after insert on public.events
for each row execute function public.apply_event();

-- ---------- RPC: exam attempts (3 per Paris day) ----------
create or replace function public.start_exam_attempt() returns json
language plpgsql security definer set search_path = public as $$
declare n int; a uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select count(*) into n from public.exam_attempts
  where user_id = auth.uid() and (started_at at time zone 'Europe/Paris')::date = public.paris_today();
  if n >= 3 then raise exception 'exam_limit'; end if;
  insert into public.exam_attempts (user_id) values (auth.uid()) returning id into a;
  return json_build_object('attempt_id', a, 'remaining_today', 2 - n);
end $$;

-- ---------- RPC: delete my account (cascades) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- leaderboard view (RLS of underlying tables applies) ----------
create or replace view public.leaderboard with (security_invoker = true) as
select
  us.user_id, us.group_id, p.pseudo, p.avatar_emoji,
  us.xp_total,
  case when us.week_start = public.paris_week_start(public.paris_today()) then us.xp_week else 0 end as xp_week,
  case when us.last_active_day >= public.paris_today() - 1 then us.streak else 0 end as streak,
  coalesce(array_length(us.lessons_done, 1), 0) as lessons_done_count,
  us.lessons_done, us.dialogues_done, us.badges, us.exam_best
from public.user_stats us
join public.profiles p on p.id = us.user_id;

-- ---------- RLS ----------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.user_stats enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.content_reports enable row level security;

create policy groups_select on public.groups for select to authenticated using (id = public.my_group_id());
create policy profiles_select on public.profiles for select to authenticated using (group_id = public.my_group_id());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy events_select on public.events for select to authenticated using (user_id = auth.uid());
create policy events_insert on public.events for insert to authenticated with check (user_id = auth.uid());
create policy stats_select on public.user_stats for select to authenticated using (group_id = public.my_group_id());
create policy exam_select on public.exam_attempts for select to authenticated using (user_id = auth.uid());
create policy exam_update on public.exam_attempts for update to authenticated using (user_id = auth.uid() and score is null) with check (user_id = auth.uid());
create policy reports_insert on public.content_reports for insert to authenticated with check (user_id = auth.uid());

-- Column-level privileges: only pseudo/avatar and score are updatable by clients.
revoke update on public.profiles from anon, authenticated;
grant update (pseudo, avatar_emoji) on public.profiles to authenticated;
revoke update on public.exam_attempts from anon, authenticated;
grant update (score) on public.exam_attempts to authenticated;
revoke all on public.user_stats from anon;
revoke insert, update, delete on public.user_stats from authenticated;
revoke all on function public.delete_my_account() from anon;
revoke all on function public.start_exam_attempt() from anon;
revoke all on function public.join_group(text, text, text) from anon;
```
`supabase/seed.sql`:
```sql
insert into public.groups (name, invite_code) values ('Famille (local)', 'TEST-CODE') on conflict do nothing;
```

- [ ] **Step 3: SQL tests (pgTAP)** — `supabase/tests/00_schema_test.sql`

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.fr'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.fr'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Autre', 'OTHER');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- join_group
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins FAM');
select throws_ok($$ select public.join_group('NOPE', 'Alice', '🐉') $$, 'P0001', 'invalid_invite', 'bad invite rejected');

-- events → stats, idempotence, exam delta
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now());
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now())
on conflict (client_id) do nothing;
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15, 'xp counted once (idempotent)');
select is((select lessons_done from public.user_stats where user_id = auth.uid()), array['l01'], 'lesson recorded');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'streak starts at 1');

insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, '{"score": 72}', now());
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, '{"score": 80}', now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15 + 72 + 8, 'exam xp = delta over best, client xp ignored');
select is((select exam_best from public.user_stats where user_id = auth.uid()), 80, 'exam best stored');

-- daily cap (already 95 today): +10 x 12 = 120 → capped at 200 total today
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
select gen_random_uuid(), auth.uid(), 'lesson_completed', 'l0' || g, 10, now() from generate_series(1, 12) g;
select is((select xp_today from public.user_stats where user_id = auth.uid()), 200, 'daily cap 200');

-- clients cannot write stats directly
select throws_ok($$ update public.user_stats set xp_total = 9999 where user_id = auth.uid() $$, '42501', null, 'stats not writable');

-- exam limit
select lives_ok($$ select public.start_exam_attempt() $$, 'attempt 1');
select lives_ok($$ select public.start_exam_attempt() $$, 'attempt 2');
select is((public.start_exam_attempt()->>'remaining_today')::int, 0, 'attempt 3 leaves 0');
select throws_ok($$ select public.start_exam_attempt() $$, 'P0001', 'exam_limit', '4th attempt refused');

-- bob, same group: sees alice's stats, not her events
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐯') $$, 'bob joins FAM');
select is((select count(*)::int from public.leaderboard), 2, 'bob sees 2 rows in his group leaderboard');
select is((select count(*)::int from public.events), 0, 'bob cannot read alice events');

-- carol, other group: isolated
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.join_group('OTHER', 'Carol', '🐼');
select is((select count(*)::int from public.leaderboard), 1, 'carol only sees her own group');

select * from finish();
rollback;
```
Note on the daily-cap test: alice's `xp_today` before the 12 inserts is 15 + 72 + 8 = 95; 95 + 120 = 215 → capped to 200.

- [ ] **Step 4: Run**

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```
Expected: `All tests successful. Files=1, Tests=17`. Then `npm run db:types` → creates `src/adapters/supabase/types.gen.ts` (commit it).

- [ ] **Step 5: Commit** — `feat(db): add Supabase schema, RLS, triggers, exam limit and pgTAP tests`

**Acceptance:** 17/17 pgTAP tests pass; `npx supabase db lint` reports no errors; no `service_role` key anywhere in the repo.

---

### Task T15: Supabase adapters and composition root wiring

**Spec:** §2.3, §5, §6.1, §9 · **ADR:** 0001, 0005, 0008 · **Depends on:** T11, T12, T13, T14

**Files:**
- Create: `src/adapters/supabase/client.ts`, `errors.ts`, `SupabaseAuthService.ts`, `SupabaseEventSink.ts`, `SupabaseLeaderboardRepository.ts`, `SupabaseExamGateway.ts`, `SupabaseContentReporter.ts`, `index.ts`, `supabase.test.ts`
- Modify: `src/app/container.ts` (real wiring)

**Interfaces:**
- Consumes: everything in phase 2, `types.gen.ts` (T14).
- Produces: `createServices(env: Env): Services` that returns real adapters when `env.VITE_USE_FAKES === false`, and real speech unless `env.VITE_FAKE_SPEECH`.

- [ ] **Step 1: Client and error mapping**

`client.ts`:
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/adapters/supabase/types.gen";

export type Db = SupabaseClient<Database>;
export function createSupabase(url: string, anonKey: string): Db {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
}
```
`errors.ts`:
```ts
import { ExamLimitError, InvalidInviteError, NotAuthenticatedError, OfflineError, PseudoTakenError } from "@/domain/errors";

/** Maps Supabase/PostgREST/network errors to domain errors. */
export function mapError(err: { message?: string; code?: string } | null | undefined): Error {
  const msg = err?.message ?? "";
  if (typeof navigator !== "undefined" && !navigator.onLine) return new OfflineError();
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return new OfflineError();
  if (msg.includes("invalid_invite")) return new InvalidInviteError();
  if (msg.includes("pseudo_taken") || err?.code === "23505") return new PseudoTakenError();
  if (msg.includes("exam_limit")) return new ExamLimitError();
  if (msg.includes("not_authenticated") || err?.code === "PGRST301") return new NotAuthenticatedError();
  return new Error(msg || "unknown_error");
}
```

- [ ] **Step 2: Failing unit tests with a stubbed client** — `supabase.test.ts`

```ts
import { mapError } from "@/adapters/supabase/errors";
import { SupabaseEventSink } from "@/adapters/supabase/SupabaseEventSink";
import { SupabaseExamGateway } from "@/adapters/supabase/SupabaseExamGateway";
import { ExamLimitError, InvalidInviteError, OfflineError } from "@/domain/errors";

test("error mapping", () => {
  expect(mapError({ message: "invalid_invite" })).toBeInstanceOf(InvalidInviteError);
  expect(mapError({ message: "exam_limit" })).toBeInstanceOf(ExamLimitError);
  expect(mapError({ message: "TypeError: Failed to fetch" })).toBeInstanceOf(OfflineError);
});

test("event sink upserts with ignoreDuplicates and maps columns", async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const db = { from: vi.fn(() => ({ upsert })), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) } };
  const sink = new SupabaseEventSink(db as never);
  const ev = { clientId: "c1", schemaVersion: 1 as const, type: "lesson_completed" as const, refId: "l01", xp: 10, payload: { a: 1 }, createdAt: "2026-10-10T08:00:00.000Z" };
  await expect(sink.push([ev])).resolves.toEqual({ accepted: ["c1"] });
  expect(db.from).toHaveBeenCalledWith("events");
  expect(upsert).toHaveBeenCalledWith(
    [{ client_id: "c1", user_id: "u1", schema_version: 1, type: "lesson_completed", ref_id: "l01", xp: 10, payload: { a: 1 }, client_created_at: "2026-10-10T08:00:00.000Z" }],
    { onConflict: "client_id", ignoreDuplicates: true },
  );
});

test("exam gateway maps exam_limit", async () => {
  const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "exam_limit" } }) };
  await expect(new SupabaseExamGateway(db as never).startAttempt()).rejects.toBeInstanceOf(ExamLimitError);
});
```
Run → FAIL.

- [ ] **Step 3: Implement adapters** (each method: call Supabase, `if (error) throw mapError(error)`)

| Adapter | Implementation notes |
|---|---|
| `SupabaseAuthService(db)` | `getSession`: `db.auth.getSession()` → `{ userId: session.user.id, email: session.user.email ?? "" }` or null. `onChange`: `db.auth.onAuthStateChange((_, s) => cb(map(s)))`, return `() => data.subscription.unsubscribe()`. `requestOtp(email)`: `db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. `verifyOtp(email, token)`: `db.auth.verifyOtp({ email, token, type: "email" })`; on error throw `new Error("invalid_otp")`. `hasProfile`: `select id from profiles where id = uid` → boolean. `joinGroup`: `db.rpc("join_group", { p_invite_code, p_pseudo, p_avatar })`. `getMyProfile`: select `pseudo, avatar_emoji`. `updateProfile`: `update profiles set pseudo, avatar_emoji where id = uid`. `signOut`: `db.auth.signOut()`. `deleteAccount`: `db.rpc("delete_my_account")` then `db.auth.signOut()`. |
| `SupabaseEventSink(db)` | as tested above; user id from `db.auth.getUser()`; no user → throw `NotAuthenticatedError`; accepted = all sent clientIds when no error (duplicates are ignored server-side, which is still "accepted"). |
| `SupabaseLeaderboardRepository(db)` | `list(period)`: `from("leaderboard").select("user_id,pseudo,avatar_emoji,xp_week,xp_total,streak,lessons_done_count").order(period === "week" ? "xp_week" : "xp_total", { ascending: false }).limit(100)`; map to `LeaderboardRow` (`xp` = chosen column, `isMe` = `user_id === current uid`). `getPublicProfile(userId)`: `from("leaderboard").select("*").eq("user_id", userId).maybeSingle()`; null → `ContentNotFoundError(userId)`. |
| `SupabaseExamGateway(db)` | `startAttempt`: `rpc("start_exam_attempt")` → `{ attemptId: data.attempt_id, remainingToday: data.remaining_today }`. `submitAttempt(id, score)`: `from("exam_attempts").update({ score }).eq("id", id)`. |
| `SupabaseContentReporter(db, queue: DexieReportQueue)` | `report(r)`: `queue.add(r)` then `flushReports()`; `flushReports()`: for each queued row insert into `content_reports` (`user_id` = uid, `ref_id`, `message`, `content_version`), remove on success, stop at first `OfflineError`. Called also once at startup. |

- [ ] **Step 4: Composition root** — `src/app/container.ts`

```ts
import type { Env } from "@/domain/config";
import type { Services } from "@/app/services";
import { flags } from "@/app/flags";
import { createFakeServices, FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { VietLearnDb, DexieProgressRepository, DexieOutbox, DexieReportQueue } from "@/adapters/dexie";
import { WebSpeechSynthesizer, WebSpeechRecognizer, MediaRecorderVoiceRecorder, createDetectCapabilities } from "@/adapters/speech";
import { createStaticContentSource } from "@/adapters/content";
import { ScriptedConversationEngine } from "@/adapters/conversation";
import {
  createSupabase, SupabaseAuthService, SupabaseEventSink, SupabaseLeaderboardRepository, SupabaseExamGateway, SupabaseContentReporter,
} from "@/adapters/supabase";
import { createActivityService } from "@/services/activity";
import { createSyncService } from "@/services/sync";

export function createServices(env: Env): Services {
  const clock = () => new Date().toISOString();
  const db = new VietLearnDb();
  const progress = new DexieProgressRepository(db);
  const outbox = new DexieOutbox(db);
  const content = createStaticContentSource();

  // Speech
  const tts = env.VITE_FAKE_SPEECH ? new FakeSpeechSynthesizer() : new WebSpeechSynthesizer();
  const stt = env.VITE_FAKE_SPEECH ? new FakeSpeechRecognizer() : new WebSpeechRecognizer();
  const recorder = env.VITE_FAKE_SPEECH ? new FakeVoiceRecorder() : new MediaRecorderVoiceRecorder();
  const detectCapabilities = tts instanceof WebSpeechSynthesizer
    ? createDetectCapabilities(tts, stt, recorder)
    : async () => ({ tts: true, stt: true, recorder: true });

  // Remote (fake or Supabase)
  const remote = env.VITE_USE_FAKES
    ? (() => { const f = createFakeServices({ clock, progress }); return { sink: f.sink, auth: f.auth, leaderboard: f.leaderboard, exam: f.exam, reporter: f.reporter }; })()
    : (() => {
        const sb = createSupabase(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!);
        const reporter = new SupabaseContentReporter(sb, new DexieReportQueue(db));
        void reporter.flushReports();
        return {
          sink: new SupabaseEventSink(sb), auth: new SupabaseAuthService(sb), leaderboard: new SupabaseLeaderboardRepository(sb),
          exam: new SupabaseExamGateway(sb), reporter,
        };
      })();

  const sync = createSyncService({ outbox, sink: remote.sink });
  const activity = createActivityService({ progress, outbox, content, clock, onEventAppended: () => sync.notifyEnqueued() });

  return {
    env, flags, clock, content, progress, outbox, ...remote, tts, stt, recorder, detectCapabilities,
    conversation: new ScriptedConversationEngine(content), activity, sync,
  };
}
```
In fakes mode, `createFakeServices({ clock, progress })` builds its fake leaderboard on top of the Dexie `progress` passed in (T03 already honours overrides), so the fake leaderboard reflects real local progress.
`parseEnv` guarantees both Supabase keys when `VITE_USE_FAKES` is false. Replace the `!` assertions by an explicit guard to satisfy lint:
```ts
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase env missing");
const sb = createSupabase(url, key);
```

End-to-end behaviour against a real Supabase is verified manually in T36 (OTP e-mails cannot be automated without the forbidden `service_role` key).

- [ ] **Step 5: Run** `npm run verify` → PASS. With `.env.local` = local Supabase URL/anon key (`npx supabase status` prints them) and `VITE_USE_FAKES=false`, `npm run dev` starts without errors in the console.
**Commit:** `feat(adapters): add Supabase adapters and wire the composition root`
