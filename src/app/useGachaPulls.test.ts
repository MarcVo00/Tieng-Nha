import { createFakeServices, FakeGachaGateway } from "@/adapters/fakes";
import { addPendingPull, isPullActive, readPendingPulls, recoverGachaPulls, runGachaPull, useRecoveredPulls } from "@/app/useGachaPulls";
import { OfflineError } from "@/domain/errors";

const THEME = "legendes_sombres";
const FakeProto = FakeGachaGateway.prototype;
const make = () => {
  const services = createFakeServices({}, { gachaRng: () => 0 });
  return { services, gacha: services.gacha as FakeGachaGateway };
};
const fund = (s: ReturnType<typeof make>["services"], n: number) => s.activity.demoGrant(n, 0);
const journal = async (s: ReturnType<typeof make>["services"]) => (await s.progress.listEvents()).filter((e) => e.type === "gacha_pulled");

beforeEach(() => {
  localStorage.clear();
  useRecoveredPulls.setState({ recovered: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("runGachaPull", () => {
  test("pulls, mirrors the server result in the journal and forgets the pending id", async () => {
    const { services } = make();
    await fund(services, 100);
    const seen: string[] = [];
    const spy = vi.spyOn(services.gacha, "pull").mockImplementation(async (id, ...rest) => {
      seen.push(id);
      expect(readPendingPulls()).toEqual([{ id: "id1", theme: THEME, count: 1 }]); // pending BEFORE the request
      expect(isPullActive(id)).toBe(true);
      return FakeProto.pull.call(services.gacha, id, ...rest);
    });
    const res = await runGachaPull(services, THEME, 1, () => "id1");
    expect(res.ok).toBe(true);
    expect(seen).toEqual(["id1"]);
    expect(spy).toHaveBeenCalledWith("id1", THEME, 1);
    expect(readPendingPulls()).toEqual([]);
    expect(isPullActive("id1")).toBe(false);
    expect((await journal(services)).map((e) => e.refId)).toEqual(["id1"]);
    expect((await services.activity.getWallet()).coins).toBe(60);
  });

  test("a refusal is returned and the id forgotten; nothing reaches the journal", async () => {
    const { services } = make();
    const res = await runGachaPull(services, THEME, 1, () => "id1");
    expect(res).toEqual({ ok: false, error: "not_enough" });
    expect(readPendingPulls()).toEqual([]);
    expect(await journal(services)).toEqual([]);
  });

  test("offline: throws OfflineError, keeps the id pending, releases the screen lock", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    gacha.online = false;
    await expect(runGachaPull(services, THEME, 1, () => "id1")).rejects.toBeInstanceOf(OfflineError);
    expect(readPendingPulls()).toEqual([{ id: "id1", theme: THEME, count: 1 }]);
    expect(isPullActive("id1")).toBe(false);
  });
});

describe("recoverGachaPulls", () => {
  test("a crash after the server pulled but before the claim: the unclaimed pull is mirrored and announced once", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    await gacha.pull("lost", THEME, 1); // server done, journal never told
    expect((await services.activity.getWallet()).coins).toBe(100);
    const recovered = await recoverGachaPulls(services);
    expect(recovered.map((p) => p.id)).toEqual(["lost"]);
    expect((await services.activity.getWallet()).coins).toBe(60);
    expect(await recoverGachaPulls(services)).toEqual([]); // once
    expect(await journal(services)).toHaveLength(1);
  });

  test("a pending id whose request never reached the server is re-sent with the same id, then claimed", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    addPendingPull({ id: "p1", theme: THEME, count: 1 });
    const spy = vi.spyOn(gacha, "pull");
    const recovered = await recoverGachaPulls(services);
    expect(spy).toHaveBeenCalledWith("p1", THEME, 1);
    expect(recovered.map((p) => p.id)).toEqual(["p1"]);
    expect(readPendingPulls()).toEqual([]);
    expect((await services.activity.getWallet()).coins).toBe(60);
    expect(await journal(services)).toHaveLength(1);
  });

  test("a pending id the server already knows is a replay: one debit, one event", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    await gacha.pull("p1", THEME, 1);
    addPendingPull({ id: "p1", theme: THEME, count: 1 });
    const recovered = await recoverGachaPulls(services);
    expect(recovered.map((p) => p.id)).toEqual(["p1"]);
    expect(await gacha.balance()).toBe(60);
    expect(await journal(services)).toHaveLength(1);
  });

  test("a refused pending id is forgotten", async () => {
    const { services } = make();
    addPendingPull({ id: "p1", theme: THEME, count: 1 }); // no xu
    expect(await recoverGachaPulls(services)).toEqual([]);
    expect(readPendingPulls()).toEqual([]);
  });

  test("pulls the server already applied for another device are mirrored silently", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    const res = await gacha.pull("p1", THEME, 1);
    if (!res.ok) throw new Error("unreachable");
    vi.spyOn(gacha, "list").mockResolvedValue([{ ...res.pull, claimed: true }]);
    expect(await recoverGachaPulls(services)).toEqual([]);
    expect(await journal(services)).toHaveLength(1);
  });

  test("offline: quiet, pending kept for the next start", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    addPendingPull({ id: "p1", theme: THEME, count: 1 });
    gacha.online = false;
    expect(await recoverGachaPulls(services)).toEqual([]);
    expect(readPendingPulls()).toHaveLength(1);
    expect(await journal(services)).toEqual([]);
  });

  test("a pull being driven by a screen is left to its owner", async () => {
    const { services, gacha } = make();
    await fund(services, 100);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const real = FakeProto.pull;
    vi.spyOn(gacha, "pull").mockImplementation(async (...a) => {
      const res = await real.call(gacha, ...a);
      await gate; // the screen is mid-flight: server done, claim not yet made
      return res;
    });
    const running = runGachaPull(services, THEME, 1, () => "live");
    await vi.waitFor(async () => expect((await gacha.list()).map((p) => p.id)).toEqual(["live"]));
    expect(await recoverGachaPulls(services)).toEqual([]); // not claimed, not announced
    expect(await journal(services)).toEqual([]);
    release();
    await running;
    expect(await journal(services)).toHaveLength(1);
  });

  test("a failing list is swallowed", async () => {
    const { services, gacha } = make();
    vi.spyOn(gacha, "list").mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await recoverGachaPulls(services)).toEqual([]);
  });
});

test("the recovered store keeps one entry per pull until dismissed", () => {
  const p = { id: "a", theme: "t", count: 1, cost: 40, items: [], createdAt: "x", claimed: false };
  useRecoveredPulls.getState().push([p]);
  useRecoveredPulls.getState().push([p, { ...p, id: "b" }]);
  expect(useRecoveredPulls.getState().recovered.map((x) => x.id)).toEqual(["a", "b"]);
  useRecoveredPulls.getState().dismiss("a");
  expect(useRecoveredPulls.getState().recovered.map((x) => x.id)).toEqual(["b"]);
});
