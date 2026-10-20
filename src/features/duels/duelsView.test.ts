import type { Duel, DuelRun } from "@/domain/types";
import { hoursLeft, otherId, outcomeOf, splitDuels } from "@/features/duels/duelsView";

const NOW = "2026-10-10T10:00:00.000Z";
const run = (reward: number | null): DuelRun => ({ round1: [], round2: [], damage: 0, timeMs: 0, reward, claimed: false });
const duel = (id: string, over: Partial<Duel> = {}): Duel => ({
  id, challenger: "me", opponent: "x", opponentPseudo: "X", opponentAvatar: "x", createdAt: "2026-10-09T10:00:00.000Z",
  expiresAt: "2026-10-12T10:00:00.000Z", status: "open", winner: null, seed: 1, questions: { round1: [], round2: [] }, myRun: null, theirRun: null, ...over,
});

describe("splitDuels", () => {
  test("open without my run is to play, open with my run is waiting, the rest is done", () => {
    const s = splitDuels([duel("a"), duel("b", { myRun: run(null) }), duel("c", { status: "settled", myRun: run(3) }), duel("d", { status: "cancelled" })], NOW);
    expect(s.toPlay.map((d) => d.id)).toEqual(["a"]);
    expect(s.waiting.map((d) => d.id)).toEqual(["b"]);
    expect(s.done.map((d) => d.id).sort()).toEqual(["c", "d"]);
  });

  test("works whichever side I am on", () => {
    const s = splitDuels([duel("in", { challenger: "x", opponent: "me" })], NOW);
    expect(s.toPlay.map((d) => d.id)).toEqual(["in"]);
  });

  test("drops open duels past their expiry and compares Postgres timestamps with Date.parse", () => {
    const s = splitDuels([duel("old", { expiresAt: "2026-10-10 09:59:59+00" }), duel("ok", { expiresAt: "2026-10-10 10:00:01+00" })], NOW);
    expect([...s.toPlay, ...s.waiting].map((d) => d.id)).toEqual(["ok"]);
  });

  test("keeps the 10 newest finished duels", () => {
    const list = Array.from({ length: 13 }, (_, i) => duel(`d${i}`, { status: "settled", createdAt: `2026-09-${String(i + 1).padStart(2, "0")} 08:00:00+00` }));
    const done = splitDuels(list, NOW).done;
    expect(done).toHaveLength(10);
    expect(done[0]?.id).toBe("d12");
    expect(done[9]?.id).toBe("d3");
  });
});

describe("outcomeOf", () => {
  test.each([
    ["cancelled", duel("a", { status: "cancelled" }), "cancelled"],
    ["forfeit (I never played)", duel("a", { status: "settled", winner: "x" }), "forfeit"],
    ["draw", duel("a", { status: "settled", myRun: run(2) }), "draw"],
    ["win", duel("a", { status: "settled", myRun: run(3), winner: "me" }), "win"],
    ["loss", duel("a", { status: "settled", myRun: run(1), winner: "x" }), "loss"],
  ] as const)("%s", (_, d, expected) => {
    expect(outcomeOf(d, "me")).toBe(expected);
  });

  test("without my id the reward tells win from loss", () => {
    expect(outcomeOf(duel("a", { status: "settled", myRun: run(3), winner: "q" }), undefined)).toBe("win");
    expect(outcomeOf(duel("a", { status: "settled", myRun: run(1), winner: "q" }), undefined)).toBe("loss");
  });
});

test("otherId and hoursLeft", () => {
  expect(otherId(duel("a"), "me")).toBe("x");
  expect(otherId(duel("a", { challenger: "x", opponent: "me" }), "me")).toBe("x");
  expect(hoursLeft(duel("a"), NOW)).toBe(48);
  expect(hoursLeft(duel("a"), "2027-01-01T00:00:00.000Z")).toBe(0);
});
