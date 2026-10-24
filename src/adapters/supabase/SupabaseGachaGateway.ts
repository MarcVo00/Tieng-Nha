import { z } from "zod";
import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import { IsoSchema } from "@/adapters/supabase/iso";
import { NotAuthenticatedError } from "@/domain/errors";
import type { GachaPull } from "@/domain/types";
import { GACHA_ERRORS, type GachaError, type GachaGateway, type GachaPullResult } from "@/ports";

const ItemSchema = z.object({
  itemId: z.string(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  duplicate: z.boolean(),
  refund: z.number().int().nonnegative(),
});
const PullSchema = z.object({
  id: z.string(),
  theme: z.string(),
  count: z.number().int().positive(),
  cost: z.number().int().nonnegative(),
  items: z.array(ItemSchema),
  createdAt: IsoSchema,
  claimed: z.boolean(),
});
const OkSchema = PullSchema.extend({
  ok: z.literal(true),
  pity: z.number().int().nonnegative(),
  coins: z.number().int(),
  replayed: z.boolean().optional(),
});
const RefusalSchema = z.object({ ok: z.literal(false), error: z.string() });

const invalid = () => new Error("invalid_gacha_response");

export class SupabaseGachaGateway implements GachaGateway {
  constructor(private readonly db: Db) {}

  async pull(pullId: string, theme: string, count: number): Promise<({ ok: true } & GachaPullResult) | { ok: false; error: GachaError }> {
    const { data, error } = await this.db.rpc("gacha_pull", { p_pull: pullId, p_theme: theme, p_count: count });
    if (error) throw mapError(error);
    const refusal = RefusalSchema.safeParse(data);
    if (refusal.success) {
      const known = GACHA_ERRORS.find((c) => c === refusal.data.error);
      if (!known) throw invalid();
      return { ok: false, error: known };
    }
    const parsed = OkSchema.safeParse(data);
    if (!parsed.success) throw invalid();
    const d = parsed.data;
    const pull: GachaPull = { id: d.id, theme: d.theme, count: d.count, cost: d.cost, items: d.items, createdAt: d.createdAt, claimed: d.claimed };
    return { ok: true, pull, pity: d.pity, coins: d.coins, replayed: d.replayed ?? false };
  }

  async list(): Promise<GachaPull[]> {
    const { data, error } = await this.db.rpc("list_gacha_pulls");
    if (error) throw mapError(error);
    const parsed = z.array(PullSchema).safeParse(data);
    if (!parsed.success) throw invalid();
    return parsed.data;
  }

  async balance(): Promise<number> {
    const { data: auth, error: authError } = await this.db.auth.getUser();
    if (authError) throw mapError(authError);
    const uid = auth.user?.id;
    if (!uid) throw new NotAuthenticatedError();
    const { data, error } = await this.db.from("user_stats").select("coins").eq("user_id", uid).maybeSingle();
    if (error) throw mapError(error);
    return data?.coins ?? 0;
  }
}
