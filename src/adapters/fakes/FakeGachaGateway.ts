import { OfflineError } from "@/domain/errors";
import type { AppEvent, BadgeDef, GachaPull, ShopItem } from "@/domain/types";
import { type GachaError, type GachaGateway, type GachaPullResult } from "@/ports";
import { gachaCost, gachaDraw, themeItems } from "@/services/gacha";
import { walletAt } from "@/services/wallet";

export const DEMO_GACHA_KEY = "tn-demo-gacha";
const KEEP_CLAIMED = 20;

type Deps = {
  getMyEvents: () => Promise<AppEvent[]>;
  getShop: () => Promise<ShopItem[]>;
  getBadges: () => Promise<BadgeDef[]>;
  clock?: () => string;
  /** Uniform [0,1) source; inject a scripted one in tests. */
  rng?: () => number;
  /** Opt-in persistence (demo mode): pulls and pity are saved under `storageKey` and loaded at construction. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  storageKey?: string;
};

type Stored = Omit<GachaPull, "claimed">;

/** In-memory gacha with the server's rules (shared `services/gacha` draw) and the same validation order as `gacha_pull`. */
export class FakeGachaGateway implements GachaGateway {
  online = true;
  /** Tests: the server xu balance, when it differs from the local journal. */
  serverCoins: number | null = null;
  private pulls: Stored[] = [];
  private pity: Record<string, number> = {};
  private readonly clock: () => string;
  private readonly rng: () => number;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | null;
  private readonly storageKey: string;

  constructor(private readonly deps: Deps) {
    this.clock = deps.clock ?? (() => new Date().toISOString());
    this.rng = deps.rng ?? Math.random;
    this.storage = deps.storage ?? null;
    this.storageKey = deps.storageKey ?? DEMO_GACHA_KEY;
    this.load();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (typeof data !== "object" || data === null) return;
      const { pulls, pity } = data as { pulls?: unknown; pity?: unknown };
      if (!Array.isArray(pulls) || typeof pity !== "object" || pity === null) return;
      if (!pulls.every((p) => typeof p === "object" && p !== null && typeof (p as Stored).id === "string" && Array.isArray((p as Stored).items))) return;
      this.pulls = pulls as Stored[];
      this.pity = pity as Record<string, number>;
    } catch {
      this.pulls = []; // corrupt storage: start empty
      this.pity = {};
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify({ pulls: this.pulls, pity: this.pity }));
    } catch {
      // storage full or unavailable: the demo keeps working in memory
    }
  }

  /** The server's view: the local journal plus the pulls the journal has not mirrored yet. */
  private async serverState(): Promise<{ coins: number; inventory: string[]; claimed: Set<string> }> {
    const [events, shop, badges] = await Promise.all([this.deps.getMyEvents(), this.deps.getShop(), this.deps.getBadges()]);
    const w = walletAt(events, shop, badges);
    const claimed = new Set(events.filter((e) => e.type === "gacha_pulled").map((e) => e.refId));
    let coins = w.coins;
    const inventory = new Set(w.inventory);
    for (const p of this.pulls) {
      if (claimed.has(p.id)) continue;
      coins -= p.cost;
      for (const i of p.items) {
        coins += i.refund;
        inventory.add(i.itemId);
      }
    }
    return { coins: this.serverCoins ?? coins, inventory: [...inventory], claimed };
  }

  async pull(pullId: string, theme: string, count: number): Promise<({ ok: true } & GachaPullResult) | { ok: false; error: GachaError }> {
    if (!this.online) throw new OfflineError();
    const refuse = (error: GachaError) => ({ ok: false as const, error });
    const state = await this.serverState();
    const existing = this.pulls.find((p) => p.id === pullId);
    if (existing) {
      return { ok: true, pull: { ...structuredClone(existing), claimed: state.claimed.has(existing.id) }, pity: this.pity[existing.theme] ?? 0, coins: state.coins, replayed: true };
    }
    if (pullId.trim() === "") return refuse("bad_pull");
    const cost = gachaCost(count);
    if (cost === null) return refuse("bad_count");
    const shop = await this.deps.getShop();
    const items = themeItems(shop, theme);
    if (items.length === 0) return refuse("unknown_theme");
    if (state.coins < cost) return refuse("not_enough");

    const rolls = Array.from({ length: 2 * count }, () => this.rng());
    const draw = gachaDraw({ pity: this.pity[theme] }, items, state.inventory, count, rolls);
    const stored: Stored = { id: pullId, theme, count, cost, items: draw.items, createdAt: this.clock() };
    this.pulls.push(stored);
    this.pity[theme] = draw.pity;
    this.persist();
    const refunds = draw.items.reduce((n, i) => n + i.refund, 0);
    return { ok: true, pull: { ...structuredClone(stored), claimed: false }, pity: draw.pity, coins: state.coins - cost + refunds, replayed: false };
  }

  async list(): Promise<GachaPull[]> {
    if (!this.online) throw new OfflineError();
    const { claimed } = await this.serverState();
    const all = [...this.pulls].reverse().map((p): GachaPull => ({ ...structuredClone(p), claimed: claimed.has(p.id) }));
    return [...all.filter((p) => !p.claimed), ...all.filter((p) => p.claimed).slice(0, KEEP_CLAIMED)];
  }

  async balance(): Promise<number> {
    if (!this.online) throw new OfflineError();
    return (await this.serverState()).coins;
  }
}
