import { InMemoryProgressRepository, InMemoryOutbox, FakeEventSink, FakeAuthService, FakeExamGateway } from "@/adapters/fakes";
import { ExamLimitError, InvalidInviteError } from "@/domain/errors";

const now = "2026-10-10T08:00:00.000Z";

test("progress repo appends events with uuid and timestamp", async () => {
  const repo = new InMemoryProgressRepository();
  const e = await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, now);
  expect(e.clientId).toMatch(/^[0-9a-f-]{36}$/);
  expect(e.createdAt).toBe(now);
  expect(await repo.listEvents()).toHaveLength(1);
});

test("due vocab is filtered and sorted", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsertVocabProgress({ vocabId: "v_b", box: 1, dueAt: "2026-10-09T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  await repo.upsertVocabProgress({ vocabId: "v_a", box: 1, dueAt: "2026-10-08T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  await repo.upsertVocabProgress({ vocabId: "v_c", box: 1, dueAt: "2026-10-20T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  expect((await repo.listDueVocab(now, 10)).map((p) => p.vocabId)).toEqual(["v_a", "v_b"]);
  expect(await repo.countDueVocab(now)).toBe(2);
});

test("outbox peek/ack", async () => {
  const ob = new InMemoryOutbox();
  const repo = new InMemoryProgressRepository();
  const e = await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, now);
  await ob.enqueue(e);
  expect(await ob.size()).toBe(1);
  await ob.ack([e.clientId]);
  expect(await ob.size()).toBe(0);
});

test("fake sink can simulate offline", async () => {
  const sink = new FakeEventSink();
  sink.online = false;
  await expect(sink.push([])).rejects.toThrow("offline");
});

test("fake auth rejects bad invite and accepts OTP 123456", async () => {
  const auth = new FakeAuthService();
  await auth.requestOtp("a@b.c");
  await expect(auth.verifyOtp("a@b.c", "000000")).rejects.toThrow("invalid_otp");
  await auth.verifyOtp("a@b.c", "123456");
  await expect(auth.joinGroup("WRONG", "Marc", "🐉")).rejects.toBeInstanceOf(InvalidInviteError);
  await auth.joinGroup("TEST-CODE", "Marc", "🐉");
  expect(await auth.hasProfile()).toBe(true);
});

test("fake exam gateway limits to 3 attempts", async () => {
  const g = new FakeExamGateway();
  await g.startAttempt(); await g.startAttempt();
  expect((await g.startAttempt()).remainingToday).toBe(0);
  await expect(g.startAttempt()).rejects.toBeInstanceOf(ExamLimitError);
});

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test("fake auth persists to the given storage and reloads from it", async () => {
  const storage = memoryStorage();
  const first = new FakeAuthService({ persist: true, storage });
  await first.verifyOtp("a@b.c", "123456");
  await first.setPassword("secret123");
  await first.joinGroup("TEST-CODE", "Marc", "🐉");
  const second = new FakeAuthService({ persist: true, storage });
  expect((await second.getSession())?.email).toBe("a@b.c");
  expect(await second.hasProfile()).toBe(true);
  expect((await second.signInWithPassword("a@b.c", "secret123")).email).toBe("a@b.c");
});

test("fake auth survives storage that throws", async () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  const auth = new FakeAuthService({ persist: true, storage: broken });
  await auth.verifyOtp("a@b.c", "123456");
  expect((await auth.getSession())?.email).toBe("a@b.c");
});

test("fake auth accepts any non-empty invite only with anyInvite", async () => {
  const strict = new FakeAuthService();
  await strict.verifyOtp("a@b.c", "123456");
  await expect(strict.joinGroup("whatever", "Marc", "🐉")).rejects.toBeInstanceOf(InvalidInviteError);
  const demo = new FakeAuthService({ anyInvite: true });
  await demo.verifyOtp("a@b.c", "123456");
  await expect(demo.joinGroup("  ", "Marc", "🐉")).rejects.toBeInstanceOf(InvalidInviteError);
  await demo.joinGroup("whatever", "Marc", "🐉");
  expect(await demo.hasProfile()).toBe(true);
});
