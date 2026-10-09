import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSyncService } from "@/services/sync";
import { InMemoryOutbox, InMemoryProgressRepository, FakeEventSink } from "@/adapters/fakes";

async function seed(outbox: InMemoryOutbox, n: number) {
  const repo = new InMemoryProgressRepository();
  for (let i = 0; i < n; i++) await outbox.enqueue(await repo.appendEvent({ type: "lesson_completed", refId: `l${i}`, xp: 1, payload: {} }, "2026-10-10T08:00:00.000Z"));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("flush sends everything in batches and empties the outbox", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 120);
  const sync = createSyncService({ outbox, sink, batchSize: 50, addOnlineListener: () => () => {} });
  expect(await sync.flush()).toEqual({ sent: 120 });
  expect(await outbox.size()).toBe(0);
  expect(sink.received).toHaveLength(120);
});

test("offline: keeps events and retries with backoff", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  sink.online = false;
  await seed(outbox, 2);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  sync.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(2);
  sink.online = true;
  await vi.advanceTimersByTimeAsync(2000);
  expect(await outbox.size()).toBe(0);
  sync.stop();
});

test("online event triggers a flush", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  let fire: () => void = () => {};
  const sync = createSyncService({ outbox, sink, addOnlineListener: (cb) => { fire = cb; return () => {}; } });
  sync.start();
  await sync.flush();
  await seed(outbox, 1);
  fire();
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(0);
});

test("size listeners are notified", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 3);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  const sizes: number[] = [];
  sync.onSizeChange((n) => sizes.push(n));
  await sync.flush();
  expect(sizes.at(-1)).toBe(0);
});

test("concurrent flushes share one run", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 5);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  const [a, b] = await Promise.all([sync.flush(), sync.flush()]);
  expect(a).toBe(b);
  expect(sink.received).toHaveLength(5);
});

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test("an event enqueued while a flush is in flight is still sent", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 1);
  const gate = deferred();
  const realPush = sink.push.bind(sink);
  let first = true;
  sink.push = async (events) => {
    if (first) { first = false; await gate.promise; }
    return realPush(events);
  };
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  const p = sync.flush();
  await vi.advanceTimersByTimeAsync(0);
  await seed(outbox, 1);
  sync.notifyEnqueued();
  gate.resolve();
  await p;
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(0);
  expect(sink.received).toHaveLength(2);
});

test("a fully rejected batch is retried with backoff", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 2);
  const realPush = sink.push.bind(sink);
  let first = true;
  sink.push = async (events) => {
    if (first) { first = false; return { accepted: [] }; }
    return realPush(events);
  };
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  sync.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(2);
  await vi.advanceTimersByTimeAsync(2000);
  expect(await outbox.size()).toBe(0);
  sync.stop();
});

test("a failing outbox.size does not reject flush", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 1);
  outbox.size = async () => { throw new Error("boom"); };
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  await expect(sync.flush()).resolves.toEqual({ sent: 1 });
  expect(() => sync.notifyEnqueued()).not.toThrow();
  await vi.advanceTimersByTimeAsync(0);
});

test("backoff grows 2s then 4s while the sink keeps failing", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  sink.online = false;
  await seed(outbox, 1);
  const spy = vi.spyOn(sink, "push");
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  sync.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(spy).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1999);
  expect(spy).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(spy).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(3999);
  expect(spy).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(spy).toHaveBeenCalledTimes(3);
  sync.stop();
});

test("stop cancels the pending retry", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  sink.online = false;
  await seed(outbox, 1);
  const spy = vi.spyOn(sink, "push");
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  sync.start();
  await vi.advanceTimersByTimeAsync(0);
  sync.stop();
  await vi.advanceTimersByTimeAsync(600000);
  expect(spy).toHaveBeenCalledTimes(1);
});
