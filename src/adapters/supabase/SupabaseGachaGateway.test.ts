import { SupabaseGachaGateway } from "@/adapters/supabase/SupabaseGachaGateway";
import { OfflineError } from "@/domain/errors";
import type { GachaGateway } from "@/ports";

const gateway = (rpc: unknown): GachaGateway => new SupabaseGachaGateway({ rpc } as never);
const ok = (data: unknown) => vi.fn().mockResolvedValue({ data, error: null });
const offline = () => vi.fn().mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch" } });

const items = [
  { itemId: "hat_khan_vanh", rarity: "common", duplicate: false, refund: 0 },
  { itemId: "acc_giao_tre", rarity: "common", duplicate: true, refund: 8 },
];
const row = { id: "p1", theme: "legendes_sombres", count: 1, cost: 40, items, createdAt: "2026-10-24T08:00:00.000Z", claimed: false };

describe("pull", () => {
  const success = { ok: true, ...row, pity: 3, coins: 468, replayed: false };

  test("sends the RPC arguments and maps the result", async () => {
    const rpc = ok(success);
    const res = await gateway(rpc).pull("p1", "legendes_sombres", 1);
    expect(rpc).toHaveBeenCalledWith("gacha_pull", { p_pull: "p1", p_theme: "legendes_sombres", p_count: 1 });
    expect(res).toEqual({ ok: true, pull: row, pity: 3, coins: 468, replayed: false });
  });

  test("a replay is flagged; a missing flag counts as false", async () => {
    await expect(gateway(ok({ ...success, replayed: true })).pull("p1", "t", 1)).resolves.toMatchObject({ replayed: true });
    const bare: Record<string, unknown> = { ...success };
    delete bare["replayed"];
    await expect(gateway(ok(bare)).pull("p1", "t", 1)).resolves.toMatchObject({ replayed: false });
  });

  test("normalises Postgres timestamps (6 fraction digits, space)", async () => {
    const res = await gateway(ok({ ...success, createdAt: "2026-10-24 10:00:00.123456+02" })).pull("p1", "t", 1);
    expect(res).toMatchObject({ ok: true, pull: { createdAt: "2026-10-24T08:00:00.123Z" } });
    await expect(gateway(ok({ ...success, createdAt: "soon" })).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
  });

  test.each(["bad_pull", "unknown_user", "bad_count", "unknown_theme", "not_enough"])("maps the refusal %s", async (error) => {
    await expect(gateway(ok({ ok: false, error })).pull("p1", "t", 1)).resolves.toEqual({ ok: false, error });
  });

  test("an unknown error code or a malformed payload is not a refusal", async () => {
    await expect(gateway(ok({ ok: false, error: "nope" })).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
    await expect(gateway(ok(null)).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
    await expect(gateway(ok({ ok: true })).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
    await expect(gateway(ok({ ...success, items: [{ itemId: "x", rarity: "mythic", duplicate: false, refund: 0 }] })).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
    await expect(gateway(ok({ ...success, items: [{ ...items[0], refund: -1 }] })).pull("p1", "t", 1)).rejects.toThrow("invalid_gacha_response");
  });

  test("a network failure throws OfflineError", async () => {
    await expect(gateway(offline()).pull("p1", "t", 1)).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("list", () => {
  test("maps rows, unclaimed first as the server sends them", async () => {
    const rpc = ok([row, { ...row, id: "p0", claimed: true }]);
    await expect(gateway(rpc).list()).resolves.toEqual([row, { ...row, id: "p0", claimed: true }]);
    expect(rpc).toHaveBeenCalledWith("list_gacha_pulls");
  });

  test("an empty list, a malformed list and a network failure", async () => {
    await expect(gateway(ok([])).list()).resolves.toEqual([]);
    await expect(gateway(ok([{ id: "x" }])).list()).rejects.toThrow("invalid_gacha_response");
    await expect(gateway(offline()).list()).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("balance", () => {
  const dbWith = (uid: string | null, result: { data: unknown; error: unknown }) => {
    const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(result) });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const getUser = vi.fn().mockResolvedValue({ data: { user: uid ? { id: uid } : null }, error: null });
    return { db: { from, auth: { getUser } }, from, select, eq };
  };

  test("reads user_stats.coins of the current user", async () => {
    const { db, from, select, eq } = dbWith("u1", { data: { coins: 250 }, error: null });
    await expect(new SupabaseGachaGateway(db as never).balance()).resolves.toBe(250);
    expect(from).toHaveBeenCalledWith("user_stats");
    expect(select).toHaveBeenCalledWith("coins");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  test("no stats row means 0; offline throws OfflineError; no session is refused", async () => {
    await expect(new SupabaseGachaGateway(dbWith("u1", { data: null, error: null }).db as never).balance()).resolves.toBe(0);
    const failing = dbWith("u1", { data: null, error: { message: "TypeError: Failed to fetch" } });
    await expect(new SupabaseGachaGateway(failing.db as never).balance()).rejects.toBeInstanceOf(OfflineError);
    await expect(new SupabaseGachaGateway(dbWith(null, { data: null, error: null }).db as never).balance()).rejects.toThrow();
  });
});
