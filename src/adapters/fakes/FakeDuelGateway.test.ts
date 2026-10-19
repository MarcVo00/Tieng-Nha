import { FakeDuelGateway } from "@/adapters/fakes/FakeDuelGateway";
import { OfflineError } from "@/domain/errors";
import type { AppEvent, DuelQuestions, Round1Answer, Round2Answer } from "@/domain/types";

const T0 = "2026-10-10T08:00:00.000Z";
const ev = (type: AppEvent["type"], refId: string): AppEvent => ({ clientId: `${type}${refId}`, schemaVersion: 1, type, refId, xp: 0, payload: {}, createdAt: T0 });
const READY = [ev("lesson_completed", "l01"), ev("lesson_completed", "l02"), ev("dialogue_completed", "d01")];
const refs = (lessonId: string, n: number) => Array.from({ length: n }, (_, i) => ({ lessonId, exerciseId: `${lessonId}_e${i}` }));
const q = (n1 = 4, n2 = 1, lessonId = "l01"): DuelQuestions => ({ round1: refs(lessonId, n1), round2: refs(lessonId, n2) });
const BOT = "bot_ba_ngoai";

function setup(events: AppEvent[] = READY, autoOpponent = true) {
  let now = T0;
  const gw = new FakeDuelGateway(async () => events, () => now, { autoOpponent });
  return { gw, setNow: (v: string) => (now = v) };
}
const answers = (n1: number, n2: number, correct: boolean, ms = 1000): { r1: Round1Answer[]; r2: Round2Answer[] } => ({
  r1: Array.from({ length: n1 }, () => ({ correct, ms })),
  r2: Array.from({ length: n2 }, () => ({ correct })),
});
async function create(gw: FakeDuelGateway, opponent = BOT, questions = q()) {
  const r = await gw.create(opponent, questions, 1);
  if (!r.ok) throw new Error(r.error);
  return r.duelId;
}

describe("create refusals", () => {
  test("self, unknown member, prerequisites on either side", async () => {
    const { gw } = setup();
    expect(await gw.create("me", q(), 1)).toEqual({ ok: false, error: "self" });
    expect(await gw.create("stranger", q(), 1)).toEqual({ ok: false, error: "not_same_group" });
    expect(await setup([ev("lesson_completed", "l01")]).gw.create(BOT, q(), 1)).toEqual({ ok: false, error: "prerequisites" });
    const members = [{ userId: "x", pseudo: "X", avatarEmoji: "x", lessonsDone: ["l01"], dialoguesDone: [] }];
    const gw2 = new FakeDuelGateway(async () => READY, () => T0, { members });
    expect(await gw2.create("x", q(), 1)).toEqual({ ok: false, error: "prerequisites" });
  });

  test("question counts and common lessons", async () => {
    const { gw } = setup();
    expect(await gw.create(BOT, q(3, 1), 1)).toEqual({ ok: false, error: "bad_questions" });
    expect(await gw.create(BOT, q(9, 1), 1)).toEqual({ ok: false, error: "bad_questions" });
    expect(await gw.create(BOT, q(4, 0), 1)).toEqual({ ok: false, error: "bad_questions" });
    expect(await gw.create(BOT, q(4, 4), 1)).toEqual({ ok: false, error: "bad_questions" });
    expect(await gw.create("bot_chu_tu", q(4, 1, "l03"), 1)).toEqual({ ok: false, error: "not_common_lesson" });
    expect(await gw.create(BOT, q(8, 3, "l02"), 1)).toMatchObject({ ok: true });
  });

  test("one open duel per pair, then a new one once settled", async () => {
    const { gw } = setup();
    const id = await create(gw);
    expect(await gw.create(BOT, q(), 2)).toEqual({ ok: false, error: "already_open" });
    expect(await create(gw, "bot_chu_tu")).not.toBe(id);
    const { r1, r2 } = answers(4, 1, true);
    await gw.submitRun(id, r1, r2);
    expect(await gw.create(BOT, q(), 3)).toMatchObject({ ok: true });
  });

  test("max 5 duels created per Paris day, back to normal the next day", async () => {
    const members = Array.from({ length: 6 }, (_, i) => ({ userId: `m${i}`, pseudo: `M${i}`, avatarEmoji: "x", lessonsDone: ["l01"], dialoguesDone: ["d01"] }));
    let now = T0;
    const gw = new FakeDuelGateway(async () => READY, () => now, { members, autoOpponent: false });
    for (let i = 0; i < 5; i++) expect(await gw.create(`m${i}`, q(), 1)).toMatchObject({ ok: true });
    expect(await gw.create("m5", q(), 1)).toEqual({ ok: false, error: "daily_limit" });
    now = "2026-10-11T08:00:00.000Z";
    expect(await gw.create("m5", q(), 1)).toMatchObject({ ok: true });
  });

  test("the Paris day, not the UTC day, bounds the quota", async () => {
    const members = Array.from({ length: 6 }, (_, i) => ({ userId: `m${i}`, pseudo: `M${i}`, avatarEmoji: "x", lessonsDone: ["l01"], dialoguesDone: ["d01"] }));
    let now = "2026-10-10T21:30:00.000Z"; // 23:30 in Paris
    const gw = new FakeDuelGateway(async () => READY, () => now, { members, autoOpponent: false });
    for (let i = 0; i < 5; i++) await create(gw, `m${i}`);
    now = "2026-10-10T22:30:00.000Z"; // 00:30 in Paris, the next day
    expect(await gw.create("m5", q(), 1)).toMatchObject({ ok: true });
  });

  test("offline throws", async () => {
    const { gw } = setup();
    gw.online = false;
    await expect(gw.create(BOT, q(), 1)).rejects.toBeInstanceOf(OfflineError);
    await expect(gw.submitRun("x", [], [])).rejects.toBeInstanceOf(OfflineError);
    await expect(gw.list()).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("runs and settlement", () => {
  test("theirRun is hidden while open and shown once settled; a win pays 3, a loss 1", async () => {
    const { gw } = setup();
    const id = await create(gw, BOT, q(8, 3));
    expect((await gw.list())[0]).toMatchObject({ id, status: "open", myRun: null, theirRun: null });

    // auto-opponent: 5/8 correct (2 critical), 1/3 oral => 2*15 + 3*10 + 15 = 75
    const win = answers(8, 3, true);
    expect(await gw.submitRun(id, win.r1, win.r2)).toEqual({ ok: true });
    const [settled] = await gw.list();
    expect(settled).toMatchObject({ status: "settled", winner: "me" });
    expect(settled?.theirRun).toMatchObject({ damage: 75, reward: 1 });
    expect(settled?.myRun).toMatchObject({ reward: 3 });
  });

  test("the player's open run stays visible but the opponent's is hidden", async () => {
    const { gw } = setup(READY, false);
    const id = await create(gw);
    const { r1, r2 } = answers(4, 1, true);
    await gw.submitRun(id, r1, r2);
    expect((await gw.list())[0]).toMatchObject({ status: "open", myRun: { damage: 75 }, theirRun: null });
  });

  test("a loss pays 1", async () => {
    const { gw } = setup();
    const id = await create(gw, BOT, q(8, 3));
    const none = answers(8, 3, false);
    await gw.submitRun(id, none.r1, none.r2);
    expect((await gw.list())[0]).toMatchObject({ status: "settled", winner: BOT, myRun: { damage: 0, reward: 1 }, theirRun: { reward: 3 } });
  });

  test("equal damage and time is a draw: 2 each", async () => {
    const { gw } = setup();
    const id = await create(gw, BOT, q(4, 1));
    // auto opponent on 4 questions: 3 correct (two criticals at 1500 ms, one at 4000), the 4th wrong at 4000, 1 oral
    const same = [
      { correct: true, ms: 1500 }, { correct: true, ms: 1500 }, { correct: true, ms: 4000 }, { correct: false, ms: 4000 },
    ];
    await gw.submitRun(id, same, [{ correct: true }]);
    expect((await gw.list())[0]).toMatchObject({ status: "settled", winner: null, myRun: { damage: 55, timeMs: 11000, reward: 2 }, theirRun: { reward: 2 } });
  });

  test("equal damage, lower time wins", async () => {
    const { gw } = setup();
    const id = await create(gw, BOT, q(4, 1));
    const faster = [
      { correct: true, ms: 1500 }, { correct: true, ms: 1500 }, { correct: true, ms: 4000 }, { correct: false, ms: 100 },
    ];
    await gw.submitRun(id, faster, [{ correct: true }]);
    expect((await gw.list())[0]).toMatchObject({ winner: "me", myRun: { reward: 3 } });
  });

  test("validation: not_found, bad_run, already_submitted", async () => {
    const { gw } = setup(READY, false);
    const id = await create(gw);
    expect(await gw.submitRun("nope", [], [])).toEqual({ ok: false, error: "not_found" });
    expect(await gw.submitRun(id, [], [])).toEqual({ ok: false, error: "bad_run" });
    expect(await gw.submitRun(id, [{ correct: true, ms: -1 }, ...answers(3, 0, true).r1], [{ correct: true }])).toEqual({ ok: false, error: "bad_run" });
    const { r1, r2 } = answers(4, 1, true);
    expect(await gw.submitRun(id, r1, r2)).toEqual({ ok: true });
    expect(await gw.submitRun(id, r1, r2)).toEqual({ ok: false, error: "already_submitted" });
  });

  test("not_open once settled", async () => {
    const { gw } = setup();
    const id = await create(gw);
    const { r1, r2 } = answers(4, 1, true);
    await gw.submitRun(id, r1, r2);
    expect(await gw.submitRun(id, r1, r2)).toEqual({ ok: false, error: "not_open" });
  });
});

describe("expiry (72 h, injected clock)", () => {
  test("one run: that player wins by forfeit (3)", async () => {
    const { gw, setNow } = setup(READY, false);
    const id = await create(gw);
    const { r1, r2 } = answers(4, 1, false);
    await gw.submitRun(id, r1, r2);
    setNow("2026-10-13T07:59:59.000Z");
    expect((await gw.list())[0]?.status).toBe("open");
    setNow("2026-10-13T08:00:00.000Z");
    expect((await gw.list())[0]).toMatchObject({ status: "settled", winner: "me", myRun: { reward: 3 }, theirRun: null });
  });

  test("only the opponent played: the absentee has no run, hence no reward", async () => {
    const { gw, setNow } = setup();
    await create(gw);
    setNow("2026-10-14T08:00:00.000Z");
    expect((await gw.list())[0]).toMatchObject({ status: "settled", winner: BOT, myRun: null });
  });

  test("nobody played: cancelled, and submitting afterwards is not_open", async () => {
    const { gw, setNow } = setup(READY, false);
    const id = await create(gw);
    setNow("2026-10-14T08:00:00.000Z");
    const { r1, r2 } = answers(4, 1, true);
    expect(await gw.submitRun(id, r1, r2)).toEqual({ ok: false, error: "not_open" });
    expect((await gw.list())[0]).toMatchObject({ status: "cancelled", winner: null, myRun: null });
  });

  test("an expired duel no longer blocks a new challenge to the same member", async () => {
    const { gw, setNow } = setup(READY, false);
    await create(gw);
    setNow("2026-10-14T08:00:00.000Z");
    expect(await gw.create(BOT, q(), 2)).toMatchObject({ ok: true });
  });
});

test("list returns copies, newest first", async () => {
  const { gw } = setup();
  const a = await create(gw, BOT);
  const b = await create(gw, "bot_chu_tu");
  const list = await gw.list();
  expect(list.map((d) => d.id)).toEqual([b, a]);
  list[0]?.questions.round1.pop();
  expect((await gw.list())[0]?.questions.round1).toHaveLength(4);
});
