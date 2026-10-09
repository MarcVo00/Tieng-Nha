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

test("listDueVocab orders by dueAt ascending and respects the limit", async () => {
  const repo = new DexieProgressRepository(db);
  const base = { box: 1, correct: 0, wrong: 0, lastSeenAt: NOW } as const;
  await repo.upsertVocabProgress({ ...base, vocabId: "v_c", dueAt: "2026-10-09T03:00:00.000Z" });
  await repo.upsertVocabProgress({ ...base, vocabId: "v_a", dueAt: "2026-10-09T01:00:00.000Z" });
  await repo.upsertVocabProgress({ ...base, vocabId: "v_b", dueAt: "2026-10-09T02:00:00.000Z" });
  expect((await repo.listDueVocab(NOW, 10)).map((p) => p.vocabId)).toEqual(["v_a", "v_b", "v_c"]);
  expect((await repo.listDueVocab(NOW, 2)).map((p) => p.vocabId)).toEqual(["v_a", "v_b"]);
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
