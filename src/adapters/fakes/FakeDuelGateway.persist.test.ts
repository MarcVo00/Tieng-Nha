import { FakeDuelGateway, DEMO_DUELS_KEY } from "@/adapters/fakes/FakeDuelGateway";
import type { DuelQuestions } from "@/domain/types";

const questions: DuelQuestions = {
  round1: [{ lessonId: "l01", exerciseId: "a" }],
  round2: [{ lessonId: "l01", exerciseId: "b" }],
};

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[DEMO_DUELS_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test("duels and runs survive a new gateway on the same storage", async () => {
  const storage = memoryStorage();
  const a = new FakeDuelGateway(async () => [], undefined, { storage });
  const id = a.seedIncoming(questions);
  const b = new FakeDuelGateway(async () => [], undefined, { storage });
  const list = await b.list();
  expect(list.map((d) => d.id)).toEqual([id]);
  expect(list[0]?.status).toBe("open");
  expect(await b.submitRun(id, [{ correct: true, ms: 1000 }], [{ correct: true }])).toEqual({ ok: true });
  const c = new FakeDuelGateway(async () => [], undefined, { storage });
  const after = await c.list();
  expect(after[0]?.status).toBe("settled");
  expect(after[0]?.myRun).not.toBeNull();
});

test("corrupt storage starts empty", async () => {
  for (const raw of ["{not json", "42", '[{"id":1}]']) {
    const g = new FakeDuelGateway(async () => [], undefined, { storage: memoryStorage(raw) });
    expect(await g.list()).toEqual([]);
  }
});

test("without storage nothing is persisted", async () => {
  const g = new FakeDuelGateway(async () => []);
  g.seedIncoming(questions);
  expect(await new FakeDuelGateway(async () => []).list()).toEqual([]);
});
