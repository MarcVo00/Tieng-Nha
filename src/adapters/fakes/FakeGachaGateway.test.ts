import { createFakeServices } from "@/adapters/fakes/createFakeServices";
import { DEMO_GACHA_KEY, FakeGachaGateway } from "@/adapters/fakes/FakeGachaGateway";
import { OfflineError } from "@/domain/errors";
import type { Services } from "@/app/services";

const THEME = "legendes_sombres";
/** Always rolls 0: the first common (acc_giao_tre) every time, until the pity forces a legendary. */
const LOW = () => 0;

function setup(rng: () => number = LOW, storage?: Pick<Storage, "getItem" | "setItem">) {
  const services: Services = createFakeServices({}, { gachaRng: rng, ...(storage ? { gachaStorage: storage } : {}) });
  return { services, gacha: services.gacha as FakeGachaGateway };
}
const fund = (s: Services, coins: number) => s.activity.demoGrant(coins, 0);
function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[DEMO_GACHA_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test("a single pull debits 40 xu on the server view and returns the server result", async () => {
  const { services, gacha } = setup();
  await fund(services, 100);
  const res = await gacha.pull("p1", THEME, 1);
  expect(res).toMatchObject({ ok: true, replayed: false, pity: 1, coins: 60, pull: { id: "p1", theme: THEME, count: 1, cost: 40, claimed: false } });
  if (!res.ok) throw new Error("unreachable");
  expect(res.pull.items).toEqual([{ itemId: "acc_giao_tre", rarity: "common", duplicate: false, refund: 0 }]);
  expect(await gacha.balance()).toBe(60);
});

test("same id replays the stored pull without a second debit; the claimed flag follows the journal", async () => {
  const { services, gacha } = setup();
  await fund(services, 100);
  const first = await gacha.pull("p1", THEME, 1);
  const again = await gacha.pull("p1", "other", 10); // other params are ignored on a replay
  expect(again).toMatchObject({ ok: true, replayed: true, coins: 60 });
  if (!first.ok || !again.ok) throw new Error("unreachable");
  expect(again.pull.items).toEqual(first.pull.items);
  await services.activity.claimGachaPulls([first.pull]);
  expect(await gacha.balance()).toBe(60); // the journal mirrors it, no double count
  expect((await gacha.list())[0]?.claimed).toBe(true);
});

test("duplicates are refunded in xu; a x10 costs 360", async () => {
  const { services, gacha } = setup();
  await fund(services, 500);
  const res = await gacha.pull("p1", THEME, 10);
  if (!res.ok) throw new Error("unreachable");
  expect(res.pull.cost).toBe(360);
  // rolls 0: commons (the first is new, the next ones refund 8 xu), the 10th forced to at least rare
  expect(res.pull.items[0]).toMatchObject({ duplicate: false, refund: 0 });
  expect(res.pull.items[1]).toMatchObject({ duplicate: true, refund: 8 });
  expect(res.pull.items[9]?.rarity).not.toBe("common");
  const refunds = res.pull.items.reduce((n, i) => n + i.refund, 0);
  expect(res.coins).toBe(500 - 360 + refunds);
});

test("the pity counter persists across pulls and forces the 40th legendary", async () => {
  const { services, gacha } = setup();
  await fund(services, 5000);
  let last = 0;
  for (let i = 1; i <= 39; i++) {
    const r = await gacha.pull(`p${i}`, THEME, 1);
    if (!r.ok) throw new Error(`pull ${i} refused`);
    last = r.pity;
  }
  expect(last).toBe(39);
  const r40 = await gacha.pull("p40", THEME, 1);
  if (!r40.ok) throw new Error("unreachable");
  expect(r40.pull.items[0]?.rarity).toBe("legendary");
  expect(r40.pity).toBe(0);
});

test("same validation and order as the server", async () => {
  const { services, gacha } = setup();
  expect(await gacha.pull("", THEME, 1)).toEqual({ ok: false, error: "bad_pull" });
  expect(await gacha.pull("p", THEME, 3)).toEqual({ ok: false, error: "bad_count" });
  expect(await gacha.pull("p", "arene", 1)).toEqual({ ok: false, error: "unknown_theme" });
  expect(await gacha.pull("p", "nope", 1)).toEqual({ ok: false, error: "unknown_theme" });
  expect(await gacha.pull("p", THEME, 1)).toEqual({ ok: false, error: "not_enough" });
  await fund(services, 39);
  expect(await gacha.pull("p", THEME, 1)).toEqual({ ok: false, error: "not_enough" });
  expect(await gacha.list()).toEqual([]); // refusals leave no trace
});

test("an unclaimed pull's items count as owned for the next pull (duplicate whatever the origin)", async () => {
  const { services, gacha } = setup();
  await fund(services, 200);
  await gacha.pull("p1", THEME, 1);
  const second = await gacha.pull("p2", THEME, 1);
  if (!second.ok) throw new Error("unreachable");
  expect(second.pull.items[0]).toMatchObject({ itemId: "acc_giao_tre", duplicate: true, refund: 8 });
});

test("list: unclaimed first, newest first", async () => {
  const { services, gacha } = setup();
  await fund(services, 300);
  const a = await gacha.pull("a", THEME, 1);
  await gacha.pull("b", THEME, 1);
  await gacha.pull("c", THEME, 1);
  if (!a.ok) throw new Error("unreachable");
  await services.activity.claimGachaPulls([a.pull]);
  expect((await gacha.list()).map((p) => [p.id, p.claimed])).toEqual([["c", false], ["b", false], ["a", true]]);
});

test("serverCoins overrides the balance; offline throws OfflineError everywhere", async () => {
  const { gacha } = setup();
  gacha.serverCoins = 7;
  expect(await gacha.balance()).toBe(7);
  gacha.online = false;
  await expect(gacha.pull("p", THEME, 1)).rejects.toBeInstanceOf(OfflineError);
  await expect(gacha.list()).rejects.toBeInstanceOf(OfflineError);
  await expect(gacha.balance()).rejects.toBeInstanceOf(OfflineError);
});

describe("persistence (demo)", () => {
  test("pulls and pity survive a new gateway on the same storage", async () => {
    const storage = memoryStorage();
    const a = setup(LOW, storage);
    await fund(a.services, 200);
    await a.gacha.pull("p1", THEME, 1);
    const events = await a.services.progress.listEvents();
    const b = new FakeGachaGateway({
      getMyEvents: async () => events,
      getShop: () => a.services.content.getShop(),
      getBadges: () => a.services.content.getBadges(),
      rng: LOW,
      storage,
    });
    expect((await b.list()).map((p) => p.id)).toEqual(["p1"]);
    expect(await b.pull("p2", THEME, 1)).toMatchObject({ ok: true, pity: 2 });
    expect(await b.pull("p1", THEME, 1)).toMatchObject({ ok: true, replayed: true });
  });

  test("corrupt storage starts empty", async () => {
    for (const raw of ["{not json", "42", '{"pulls":[{"id":1}],"pity":{}}', '{"pulls":[],"pity":3}']) {
      const { gacha } = setup(LOW, memoryStorage(raw));
      expect(await gacha.list()).toEqual([]);
    }
  });
});
