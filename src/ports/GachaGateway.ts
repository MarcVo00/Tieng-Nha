import type { GachaPull } from "@/domain/types";

/** Business refusals of `gacha_pull` (never thrown: returned as `{ ok: false, error }`). */
export type GachaError = "bad_pull" | "unknown_user" | "bad_count" | "unknown_theme" | "not_enough";

export const GACHA_ERRORS: readonly GachaError[] = ["bad_pull", "unknown_user", "bad_count", "unknown_theme", "not_enough"];

export type GachaPullResult = {
  pull: GachaPull;
  /** The player's pity counter for the theme after the pull (the current one on a replay). */
  pity: number;
  /** Server xu balance after the pull (the current one on a replay). */
  coins: number;
  /** True when the server already knew this pull id: nothing was debited a second time. */
  replayed: boolean;
};

/**
 * Server-authoritative gacha. The caller generates `pullId` BEFORE calling and keeps it until the result is claimed:
 * calling `pull` again with the same id is idempotent. A network failure throws `OfflineError`.
 */
export interface GachaGateway {
  pull(pullId: string, theme: string, count: number): Promise<({ ok: true } & GachaPullResult) | { ok: false; error: GachaError }>;
  /** All unclaimed pulls, then the latest claimed ones; unclaimed first. */
  list(): Promise<GachaPull[]>;
  /** Server-side xu of the current user (the safety net of the pull price check). */
  balance(): Promise<number>;
}
