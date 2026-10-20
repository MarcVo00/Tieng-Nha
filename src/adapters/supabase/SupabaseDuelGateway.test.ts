import { SupabaseDuelGateway } from "@/adapters/supabase/SupabaseDuelGateway";
import { OfflineError } from "@/domain/errors";
import type { DuelGateway } from "@/ports";

const questions = { round1: [{ lessonId: "l01", exerciseId: "e1" }], round2: [{ lessonId: "l01", exerciseId: "e2" }] };
const gateway = (rpc: unknown): DuelGateway => new SupabaseDuelGateway({ rpc } as never);
const ok = (data: unknown) => vi.fn().mockResolvedValue({ data, error: null });
const offline = () => vi.fn().mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch" } });

describe("create", () => {
  test("sends the RPC arguments and maps ok", async () => {
    const rpc = ok({ ok: true, duelId: "d1" });
    await expect(gateway(rpc).create("u2", questions, 42)).resolves.toEqual({ ok: true, duelId: "d1" });
    expect(rpc).toHaveBeenCalledWith("create_duel", { p_opponent: "u2", p_questions: questions, p_seed: 42 });
  });

  test("maps a business refusal to its code", async () => {
    await expect(gateway(ok({ ok: false, error: "already_open" })).create("u2", questions, 1)).resolves.toEqual({
      ok: false,
      error: "already_open",
    });
  });

  test("an unknown error code or a malformed payload is not a refusal", async () => {
    await expect(gateway(ok({ ok: false, error: "nope" })).create("u2", questions, 1)).rejects.toThrow("invalid_duel_response");
    await expect(gateway(ok(null)).create("u2", questions, 1)).rejects.toThrow("invalid_duel_response");
    await expect(gateway(ok({ ok: true })).create("u2", questions, 1)).rejects.toThrow("invalid_duel_response");
  });

  test("a network failure throws OfflineError", async () => {
    await expect(gateway(offline()).create("u2", questions, 1)).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("submitRun", () => {
  const r1 = [{ correct: true, ms: 1200 }];
  const r2 = [{ correct: false }];

  test("sends the answers and maps ok / refusal", async () => {
    const rpc = ok({ ok: true, status: "open" });
    await expect(gateway(rpc).submitRun("d1", r1, r2)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_duel_run", { p_duel: "d1", p_round1: r1, p_round2: r2 });
    await expect(gateway(ok({ ok: false, error: "not_open" })).submitRun("d1", r1, r2)).resolves.toEqual({ ok: false, error: "not_open" });
  });

  test("a network failure throws OfflineError", async () => {
    await expect(gateway(offline()).submitRun("d1", r1, r2)).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("list", () => {
  const run = { round1: [{ correct: true, ms: 900 }], round2: [{ correct: true }], damage: 25, timeMs: 900, reward: 3, claimed: false };
  const row = {
    id: "d1", challenger: "u1", opponent: "u2", opponentPseudo: "Bé Na", opponentAvatar: "🌸",
    createdAt: "2026-10-10T08:00:00.000Z", expiresAt: "2026-10-13T08:00:00.000Z", status: "settled", winner: "u1", seed: 7,
    questions, myRun: run, theirRun: { ...run, reward: 1 },
  };

  test("maps rows; an open duel keeps theirRun null", async () => {
    const open = { ...row, id: "d2", status: "open", winner: null, theirRun: null, myRun: null };
    const rpc = ok([row, open]);
    await expect(gateway(rpc).list()).resolves.toEqual([row, open]);
    expect(rpc).toHaveBeenCalledWith("list_duels");
  });

  test("normalises Postgres timestamps to ISO-Z and refuses invalid ones", async () => {
    const pg = { ...row, createdAt: "2026-10-10T10:00:00.123456+02:00", expiresAt: "2026-10-13 08:00:00+00" };
    const [d] = await gateway(ok([pg])).list();
    expect(d).toMatchObject({ createdAt: "2026-10-10T08:00:00.123Z", expiresAt: "2026-10-13T08:00:00.000Z" });
    await expect(gateway(ok([{ ...row, expiresAt: "soon" }])).list()).rejects.toThrow("invalid_duel_response");
  });

  test("an empty list, a malformed list and a network failure", async () => {
    await expect(gateway(ok([])).list()).resolves.toEqual([]);
    await expect(gateway(ok([{ id: "x" }])).list()).rejects.toThrow("invalid_duel_response");
    await expect(gateway(offline()).list()).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("balance", () => {
  const dbWith = (uid: string | null, row: { data: unknown; error: unknown }) => {
    const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(row) });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const getUser = vi.fn().mockResolvedValue({ data: { user: uid ? { id: uid } : null }, error: null });
    return { db: { from, auth: { getUser } }, from, select, eq };
  };

  test("reads user_stats.kim_bai of the current user", async () => {
    const { db, from, select, eq } = dbWith("u1", { data: { kim_bai: 7 }, error: null });
    await expect(new SupabaseDuelGateway(db as never).balance()).resolves.toBe(7);
    expect(from).toHaveBeenCalledWith("user_stats");
    expect(select).toHaveBeenCalledWith("kim_bai");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  test("no stats row yet means 0; a network failure throws OfflineError", async () => {
    await expect(new SupabaseDuelGateway(dbWith("u1", { data: null, error: null }).db as never).balance()).resolves.toBe(0);
    const failing = dbWith("u1", { data: null, error: { message: "TypeError: Failed to fetch" } });
    await expect(new SupabaseDuelGateway(failing.db as never).balance()).rejects.toBeInstanceOf(OfflineError);
  });

  test("a missing session is refused", async () => {
    await expect(new SupabaseDuelGateway(dbWith(null, { data: null, error: null }).db as never).balance()).rejects.toThrow();
  });
});

describe("timestamps from old Safari", () => {
  test("a Postgres timestamp with 6 fraction digits and a space parses", async () => {
    const run = { round1: [], round2: [], damage: 0, timeMs: 0, reward: null, claimed: false };
    const row = {
      id: "d1", challenger: "u1", opponent: "u2", opponentPseudo: "Bé Na", opponentAvatar: "🌸",
      createdAt: "2026-10-20 08:00:00.123456+00", expiresAt: "2026-10-23 08:00:00.9876+00", status: "open", winner: null, seed: 1,
      questions, myRun: run, theirRun: null,
    };
    const parse = vi.spyOn(Date, "parse");
    const [d] = await gateway(ok([row])).list();
    expect(d).toMatchObject({ createdAt: "2026-10-20T08:00:00.123Z", expiresAt: "2026-10-23T08:00:00.987Z" });
    // Never hand more than 3 fraction digits to Date.parse.
    for (const [arg] of parse.mock.calls) expect(String(arg)).not.toMatch(/\.\d{4,}/);
    parse.mockRestore();
  });
});
