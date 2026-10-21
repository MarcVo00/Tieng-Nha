import type { AppEvent, AppEventType, EnergyState, SessionKind } from "@/domain/types";

export const ENERGY = { max: 5, refillMs: 10_800_000, cost: { lesson: 1, dialogue: 1, boss: 3 }, reviewGain: 1 } as const;

/** Recorded in the local journal only: the server neither accepts nor needs them (energy is not checked server-side). */
export const LOCAL_ONLY_EVENT_TYPES: readonly AppEventType[] = ["session_started", "demo_grant"];

const isKind = (v: unknown): v is SessionKind => v === "lesson" || v === "dialogue" || v === "boss";

/**
 * Replays the journal: session starts spend, finished reviews give, and +1 comes back every 3 h counted from the
 * moment energy dropped below the maximum (the timer stops while full). Each bought refill (`refills`, ISO times)
 * puts energy back to the maximum. Pure: `nowIso` is injected.
 */
export function energyAt(events: readonly AppEvent[], nowIso: string, refills: readonly string[] = []): EnergyState {
  let current: number = ENERGY.max;
  let anchor = 0; // start of the running refill period (ms), meaningful only below the maximum
  const regen = (t: number) => {
    if (current >= ENERGY.max) return;
    const gained = Math.floor((t - anchor) / ENERGY.refillMs);
    if (gained <= 0) return;
    current = Math.min(ENERGY.max, current + gained);
    anchor += gained * ENERGY.refillMs;
  };
  const now = Date.parse(nowIso);
  type Step = { at: string; event: AppEvent | null };
  const sorted: Step[] = [
    ...events.map((event) => ({ at: event.createdAt, event })),
    ...refills.map((at) => ({ at, event: null })),
  ].sort((a, b) => a.at.localeCompare(b.at)); // stable: on a tie an event goes before a refill (events are listed first)
  for (const { at, event: e } of sorted) {
    // A future or unparseable date (device clock moved back) counts as now, so a spend cannot freeze the gauge.
    const parsed = Date.parse(at);
    const t = Number.isNaN(parsed) ? now : Math.min(parsed, now);
    regen(t);
    if (e === null) {
      current = ENERGY.max;
      continue;
    }
    const wasFull = current >= ENERGY.max;
    const kind = e.payload["kind"];
    if (e.type === "session_started" && isKind(kind)) {
      current = Math.max(0, current - ENERGY.cost[kind]);
      if (wasFull && current < ENERGY.max) anchor = t;
    } else if (e.type === "review_session_completed") {
      current = Math.min(ENERGY.max, current + ENERGY.reviewGain);
    }
  }
  regen(now);
  return { current, max: ENERGY.max, nextAt: current >= ENERGY.max ? null : new Date(anchor + ENERGY.refillMs).toISOString() };
}

/** `HH:MM:SS`, zero-padded; hours may exceed 24. Negative or non-finite input reads 00:00:00. */
export function formatCountdown(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Whole minutes (rounded up) left in a wait, split for a minute-precision phrase. */
export function waitParts(ms: number): { hours: number; minutes: number } {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Time until the gauge is full: the wait for the next point plus one full period per further point needed. */
export function msUntilFull(msToNext: number, energy: EnergyState): number {
  const further = Math.max(0, energy.max - energy.current - 1);
  return Math.max(0, msToNext) + further * ENERGY.refillMs;
}
