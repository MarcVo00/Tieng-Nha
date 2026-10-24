import { create } from "zustand";
import { OfflineError } from "@/domain/errors";
import type { GachaPull } from "@/domain/types";
import type { GachaError, GachaPullResult } from "@/ports";
import type { Services } from "@/app/services";

const PENDING_KEY = "tn-gacha-pending";

/** A pull the app asked for and has not yet seen claimed: kept on the phone so a crash can be recovered. */
export type PendingPull = { id: string; theme: string; count: number };

export function readPendingPulls(): PendingPull[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is PendingPull =>
        typeof p === "object" && p !== null && typeof (p as PendingPull).id === "string" && typeof (p as PendingPull).theme === "string" && Number.isInteger((p as PendingPull).count),
    );
  } catch {
    return [];
  }
}

function writePending(list: PendingPull[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: the pull can still be recovered from the server list
  }
}

export function addPendingPull(p: PendingPull): void {
  writePending([...readPendingPulls().filter((x) => x.id !== p.id), p]);
}

export function clearPendingPull(id: string): void {
  writePending(readPendingPulls().filter((x) => x.id !== id));
}

/** Pulls being driven by a screen right now: the recovery leaves them alone (their owner claims them). */
const active = new Set<string>();
export const isPullActive = (id: string): boolean => active.has(id);

type Deps = Pick<Services, "gacha" | "activity">;

/**
 * One pull, end to end: generates the id, keeps it pending, asks the server (idempotent per id), mirrors the SERVER
 * result into the journal and forgets the id. A network failure throws `OfflineError` and leaves the pull pending
 * (recovered later by `recoverGachaPulls`). A business refusal is returned and forgotten.
 */
export async function runGachaPull(
  { gacha, activity }: Deps,
  theme: string,
  count: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<({ ok: true } & GachaPullResult) | { ok: false; error: GachaError }> {
  const id = newId();
  active.add(id);
  addPendingPull({ id, theme, count });
  try {
    const res = await gacha.pull(id, theme, count);
    if (res.ok) await activity.claimGachaPulls([res.pull]);
    clearPendingPull(id);
    return res;
  } finally {
    active.delete(id);
  }
}

/**
 * Brings the journal back in line with the server: retries the locally pending pulls (same id, idempotent), then
 * mirrors every pull the journal does not have. Returns the pulls to announce: those this device never applied
 * (`claimed` false on the server) that it just recovered; pulls already applied from another device are mirrored silently.
 * Offline: stops quietly (the caller retries on `online`).
 */
export async function recoverGachaPulls({ gacha, activity }: Deps): Promise<GachaPull[]> {
  const recovered: GachaPull[] = [];
  const announce = (added: GachaPull[], serverClaimed: (p: GachaPull) => boolean) => {
    for (const p of added) if (!serverClaimed(p)) recovered.push(p);
  };
  try {
    for (const p of readPendingPulls()) {
      if (active.has(p.id)) continue;
      try {
        const res = await gacha.pull(p.id, p.theme, p.count);
        if (res.ok) announce(await activity.claimGachaPulls([res.pull]), (x) => x.claimed);
        clearPendingPull(p.id);
      } catch (e) {
        if (e instanceof OfflineError) return recovered;
        // any other failure keeps the id: retried at the next start
      }
    }
    const pulls = (await gacha.list()).filter((p) => !active.has(p.id));
    announce(await activity.claimGachaPulls(pulls), (x) => x.claimed);
  } catch (e) {
    if (!(e instanceof OfflineError)) console.warn("Could not recover gacha pulls", e);
  }
  return recovered.filter((p) => !active.has(p.id));
}

type RecoveredStore = { recovered: GachaPull[]; push: (pulls: GachaPull[]) => void; dismiss: (id: string) => void };

/** Recovered pulls waiting to be shown (« Tirage récupéré »); the shop renders them and calls `dismiss`. */
export const useRecoveredPulls = create<RecoveredStore>((set) => ({
  recovered: [],
  push: (pulls) => set((s) => ({ recovered: [...s.recovered, ...pulls.filter((p) => !s.recovered.some((r) => r.id === p.id))] })),
  dismiss: (id) => set((s) => ({ recovered: s.recovered.filter((p) => p.id !== id) })),
}));
