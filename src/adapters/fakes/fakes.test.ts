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
