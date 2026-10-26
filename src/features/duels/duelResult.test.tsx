import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createFakeServices, FakeDuelGateway, FakeSoundPlayer, InMemoryContentSource } from "@/adapters/fakes";
import { autoOpponentRun } from "@/adapters/fakes/FakeDuelGateway";
import { lessonFixture } from "@/adapters/fakes/seed/lesson";
import { dialogueFixture } from "@/adapters/fakes/seed/dialogue";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture, treeFixture } from "@/adapters/fakes/seed/tree";
import { shopFixture } from "@/adapters/fakes/seed/shop";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import type { DuelQuestions, Settings } from "@/domain/types";
import { DuelResultScreen } from "@/features/duels";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import "@/test/routerTestEnv";

let now = "2026-10-10T10:00:00.000Z";
const clock = () => now;
const BE_NA = "bot_be_na";
const withStt = (stt: boolean): Settings => ({ ...DEFAULT_SETTINGS, capabilities: { tts: true, stt, recorder: false } });
const l01 = { ...lessonFixture, id: "l01" };
const QUESTIONS: DuelQuestions = {
  round1: ["l05_e01", "l05_e02", "l05_e03", "l05_e07"].map((exerciseId) => ({ lessonId: "l01", exerciseId })),
  round2: [{ lessonId: "l01", exerciseId: "l05_e05" }],
};
const R = fr.duels.result;
// All right, all critical: 4 × 15 + 15 = 75 against the fake opponent's 55.
const STRONG = { round1: QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), round2: QUESTIONS.round2.map(() => ({ correct: true })) };

function makeServices(): Services {
  const content = new InMemoryContentSource([l01], [dialogueFixture], examPoolFixture, [], treeFixture, [bossFixture], shopFixture);
  return createFakeServices({ clock, content });
}

const gateway = (services: Services): FakeDuelGateway => {
  if (!(services.duels instanceof FakeDuelGateway)) throw new Error("expected the fake duel gateway");
  return services.duels;
};

async function unlock(services: Services) {
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, now);
  await services.progress.appendEvent({ type: "dialogue_completed", refId: "d01", xp: 10, payload: {} }, now);
  const [snapshot, wallet] = await Promise.all([services.activity.getSnapshot(), services.activity.getWallet()]);
  useAppState.setState({ snapshot, wallet });
}

/** A duel I started against Bé Na, both runs in: settled at once. */
async function settledDuel(services: Services, run = STRONG): Promise<string> {
  const gw = gateway(services);
  const res = await gw.create(BE_NA, QUESTIONS, 1);
  if (!res.ok) throw new Error(res.error);
  const sent = await gw.submitRun(res.duelId, run.round1, run.round2);
  if (!sent.ok) throw new Error(sent.error);
  return res.duelId;
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(route: string, services: Services) {
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/duel/:id" element={<DuelResultScreen />} />
          <Route path="/duel/:id/run" element={<p>course</p>} />
          <Route path="/duels" element={<p>hub</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

beforeEach(() => {
  now = "2026-10-10T10:00:00.000Z";
  localStorage.clear();
  useAppState.setState({
    session: { userId: "me", email: "m@e.fr" },
    settings: withStt(true),
    profile: { pseudo: "Linh", avatarEmoji: "🐉" },
    snapshot: null,
    wallet: null,
    dueCount: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const skip = async () => userEvent.click(await screen.findByRole("button", { name: R.skip }));

test("an open duel I already played waits for the other player without showing anything of theirs", async () => {
  const services = makeServices();
  await unlock(services);
  const gw = gateway(services);
  const id = gw.seedIncoming(QUESTIONS, { from: BE_NA, theirRun: false });
  await gw.submitRun(id, STRONG.round1, STRONG.round2);
  renderAt(`/duel/${id}`, services);
  expect(await screen.findByRole("heading", { name: R.waiting.title("Bé Na") })).toBeInTheDocument();
  expect(screen.getByText(R.waiting.yours(75))).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: R.skip })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: new RegExp(R.rematch) })).not.toBeInTheDocument();
});

test("an open duel I have not played goes to the run", async () => {
  const services = makeServices();
  await unlock(services);
  const id = gateway(services).seedIncoming(QUESTIONS, { from: BE_NA });
  renderAt(`/duel/${id}`, services);
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/duel/${id}/run`));
});

test("a settled duel replays the fight blow by blow, then shows the bilan and pays the Kim bài once", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  await openReplay(services, id);

  expect(screen.getByRole("group", { name: R.stage("Linh", "Bé Na") })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: R.headline.win })).not.toBeInTheDocument();
  // First blow: mine (I challenged), a critical one. The HP drops on impact, not when the attacker sets off.
  await until(() => screen.queryByText(R.blow("Linh", "critical", 15)) !== null);
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 100) })).toBeInTheDocument();
  await until(() => screen.queryByRole("meter", { name: R.hp("Bé Na", 85) }) !== null, 600);

  await until(() => screen.queryByRole("heading", { name: R.headline.win }) !== null);
  expect(screen.queryByRole("button", { name: R.skip })).not.toBeInTheDocument();
  const table = screen.getByRole("table", { name: R.statsLabel });
  const row = (label: string) => within(table).getByRole("row", { name: new RegExp(`^${label}`) });
  expect(row(R.damage)).toHaveTextContent(/75.*55/);
  expect(row(R.criticals)).toHaveTextContent(/4.*2/);
  expect(row(R.time)).toHaveTextContent(`${R.seconds(4000)}${R.seconds(11000)}`);
  expect(screen.getByText(R.reward(3))).toBeInTheDocument();
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 25) })).toBeInTheDocument();
  expect(screen.getByRole("meter", { name: R.hp("Linh", 45) })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: new RegExp(R.rematch) })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: R.back })).toBeInTheDocument();
  vi.useRealTimers();
  await waitFor(async () => expect((await services.activity.getWallet()).kimBai).toBe(3));
});

const advance = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
/** Fake time in 20 ms steps (React renders between steps), until `done` holds; returns the time spent. */
async function until(done: () => boolean, maxMs = 12_000): Promise<number> {
  let t = 0;
  while (!done()) {
    if (t > maxMs) throw new Error("timed out");
    await advance(20);
    t += 20;
  }
  return t;
}
const fxNodes = () => [...document.querySelectorAll("[data-fx-beat]")].reduce((n, el) => n + el.querySelectorAll("*").length, 0);
const faceOf = (name: string) => screen.getByRole("img", { name }).querySelector("[data-expression]")?.getAttribute("data-expression");
const fxOf = (beat: number, sel = "*") => document.querySelector(`[data-fx-beat='${beat}'] ${sel}`);

async function openReplay(services: Services, id: string) {
  renderAt(`/duel/${id}`, services);
  await until(() => screen.queryByRole("button", { name: R.skip }) !== null);
}

test("a blow lands with ink, a hurt face and, for a critical, the vermilion « Chí mạng! » seal; its FX leave two beats later", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  await openReplay(services, await settledDuel(services));
  // My critical winds up (gold glint), nothing has landed yet.
  await until(() => fxOf(1, "[data-fx='glint']") !== null);
  expect(fxOf(1, "[data-fx='impact']")).toBeNull();
  expect(faceOf("Bé Na")).toBe("idle");
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 100) })).toBeInTheDocument();
  // Contact: ink slash and 10 droplets, the seal, the number, the hurt face, the HP drop, all at once.
  await until(() => fxOf(1, "[data-fx='impact']") !== null);
  expect(fxOf(1, "[data-fx='impact'][data-kind='crit']")).not.toBeNull();
  expect(document.querySelectorAll("[data-fx-beat='1'] circle")).toHaveLength(10);
  expect(screen.getByText(R.critSeal)).toHaveAttribute("lang", "vi");
  expect(fxOf(1, "[data-fx='damage']")).toHaveTextContent("−15");
  expect(faceOf("Bé Na")).toBe("hurt");
  expect(faceOf("Linh")).toBe("idle");
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 85) })).toBeInTheDocument();
  // Their critical winds up: my ink has left with my beat; my number keeps floating, the very same node (no second pop).
  const number = fxOf(1, "[data-fx='damage']");
  await until(() => fxOf(2, "[data-fx='glint']") !== null);
  expect(fxOf(1, "[data-fx='impact']")).toBeNull();
  expect(fxOf(1, "[data-fx='damage']")).toBe(number);
  // Their contact: my number has faded out by now and leaves.
  await until(() => fxOf(2, "[data-fx='impact']") !== null);
  expect(fxOf(1)).toBeNull();
  expect(faceOf("Linh")).toBe("hurt");
  expect(faceOf("Bé Na")).toBe("idle");
  // All along: the FX layer within its node budget, and at every blow's contact at most 8 animated elements — the two
  // fighters, the hit one's flash, the stage, its HP bar, plus ≤ 3 FX (ink, number, seal): no older number, no glint,
  // no « Raté » fading in or out.
  let seen = new Set<Element>();
  await until(() => {
    expect(fxNodes()).toBeLessThanOrEqual(30);
    const inks = [...document.querySelectorAll("[data-fx='impact']:not([data-kind='miss'])")];
    if (inks.some((i) => !seen.has(i))) {
      const fx = document.querySelectorAll("[data-fx-beat] [data-fx]:not([data-fx='miss'])");
      expect(fx.length).toBeLessThanOrEqual(3);
      expect(document.querySelectorAll("[data-fx='glint'], [data-fx='miss'][data-leaving='true']")).toHaveLength(0);
      expect(4 + 1 + fx.length).toBeLessThanOrEqual(8);
    }
    seen = new Set(inks);
    return screen.queryByRole("heading", { name: R.headline.win }) !== null;
  });
  expect(document.querySelectorAll("[data-fx-beat]")).toHaveLength(0);
});

test("the replay ends on the verdict within 9 s: the loser bows, its hat falls, the winner stands", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  await openReplay(services, await settledDuel(services));
  const spent = await until(() => screen.queryByRole("heading", { name: R.headline.win }) !== null);
  expect(spent).toBeLessThanOrEqual(9000);
  const loser = screen.getByRole("img", { name: "Bé Na" });
  expect(loser.querySelector("[data-pose='bow']")).not.toBeNull();
  expect(loser.querySelector("[data-hat='fallen']")).not.toBeNull();
  expect(faceOf("Bé Na")).toBe("ko");
  expect(screen.getByRole("img", { name: "Linh" }).querySelector("[data-pose='stand']")).not.toBeNull();
  expect(faceOf("Linh")).toBe("idle");
});

test("consecutive misses play as one beat: « Raté ×3 »", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  const gw = gateway(services);
  const id = gw.seedIncoming(QUESTIONS, { from: BE_NA, theirRun: false });
  const miss = { correct: false, ms: 5000 };
  await gw.submitRun(id, [miss, miss, miss, { correct: true, ms: 5000 }], STRONG.round2);
  now = "2026-10-14T10:00:00.000Z"; // forfeit: only I attack
  await openReplay(services, id);
  const spent = await until(() => screen.queryByText(R.misses(3)) !== null);
  expect(document.querySelector("[aria-live]")).toHaveTextContent(R.missed("Linh", 3));
  expect(document.querySelectorAll("[data-fx='impact'][data-kind='miss']")).toHaveLength(1);
  const mark = document.querySelector("[data-fx='miss']");
  expect(mark).toHaveAttribute("data-leaving", "false");
  // Readable for at least `celebrate` (0.8 s), whatever the tempo: same node, not leaving, past the end of its beat.
  const shown = await until(() => document.querySelector("[data-fx='miss'][data-leaving='true']") !== null || document.querySelector("[data-fx='miss']") !== mark);
  expect(shown).toBeGreaterThanOrEqual(780);
  expect(document.querySelector("[data-fx='miss']")).toBe(mark);
  expect(screen.getByText(R.misses(3))).toHaveClass("text-ink");
  // Then it fades out and leaves with the next beat.
  const gone = await until(() => document.querySelector("[data-fx='miss']") === null);
  expect(spent + shown + gone).toBeLessThan(4000);
});

test("« Passer » jumps straight to the bilan, moves the focus to the verdict and announces it", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await skip();
  const heading = await screen.findByRole("heading", { name: R.headline.win });
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 25) })).toBeInTheDocument();
  await waitFor(() => expect(heading).toHaveFocus());
  expect(screen.getByText(R.verdictAnnounce(R.headline.win, 3))).toHaveAttribute("aria-live", "polite");
  expect(screen.getByText(`${R.rewardLabel}\u202f: 3`)).toBeInTheDocument();
});

test("the round banners are announced", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await screen.findByRole("button", { name: R.skip });
  expect(document.querySelector("[aria-live]")).toHaveTextContent(R.round1);
});

const confettiPieces = () => document.querySelectorAll("div.h-2.w-2").length;

test("the confetti celebrate a win only the first time the result is shown on this device", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await skip();
  await screen.findByRole("heading", { name: R.headline.win });
  expect(confettiPieces()).toBeGreaterThan(0);
  cleanup();

  renderAt(`/duel/${id}`, services);
  await skip();
  await screen.findByRole("heading", { name: R.headline.win });
  expect(confettiPieces()).toBe(0);
});

test("a failed Kim bài claim is tried again on the next visit", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  const claim = vi.spyOn(services.activity, "claimSettledDuels").mockRejectedValueOnce(new Error("disk"));
  renderAt(`/duel/${id}`, services);
  await screen.findByRole("button", { name: R.skip });
  await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
  cleanup();
  renderAt(`/duel/${id}`, services);
  await screen.findByRole("button", { name: R.skip });
  await waitFor(() => expect(claim).toHaveBeenCalledTimes(2));
  await waitFor(async () => expect((await services.activity.getWallet()).kimBai).toBe(3));
});

test("leaving mid-replay leaves no timer behind", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const errors = vi.spyOn(console, "error");
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await screen.findByRole("button", { name: R.skip });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  const setBeatTimers = vi.getTimerCount();
  expect(setBeatTimers).toBeGreaterThan(0);
  cleanup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(vi.getTimerCount()).toBe(0);
  expect(errors).not.toHaveBeenCalled();
});

test("a loss names the winner", async () => {
  const services = makeServices();
  await unlock(services);
  const weak = { round1: QUESTIONS.round1.map(() => ({ correct: false, ms: 5000 })), round2: [{ correct: true }] };
  const id = await settledDuel(services, weak);
  renderAt(`/duel/${id}`, services);
  await skip();
  expect(await screen.findByRole("heading", { name: R.headline.loss("Bé Na") })).toBeInTheDocument();
  expect(screen.getByText(R.reward(1))).toBeInTheDocument();
});

test("a draw: same damage and same time", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services, autoOpponentRun(QUESTIONS));
  renderAt(`/duel/${id}`, services);
  await skip();
  expect(await screen.findByRole("heading", { name: R.headline.draw })).toBeInTheDocument();
  expect(screen.getByText(R.sub.draw("Bé Na"))).toBeInTheDocument();
  expect(screen.getByText(R.reward(2))).toBeInTheDocument();
});

test("forfeit win: only I attack, the absent hero is marked « Forfait »", async () => {
  const services = makeServices();
  await unlock(services);
  const gw = gateway(services);
  const id = gw.seedIncoming(QUESTIONS, { from: BE_NA, theirRun: false });
  await gw.submitRun(id, STRONG.round1, STRONG.round2);
  now = "2026-10-14T10:00:00.000Z"; // past the 72 h
  renderAt(`/duel/${id}`, services);
  expect(await screen.findAllByText(R.forfeit)).not.toHaveLength(0);
  await skip();
  expect(await screen.findByRole("heading", { name: R.headline.forfeitWin })).toBeInTheDocument();
  const table = screen.getByRole("table", { name: R.statsLabel });
  expect(within(table).getByRole("row", { name: new RegExp(`^${R.damage}`) })).toHaveTextContent(`75${R.absent}`);
  expect(screen.getByText(R.reward(3))).toBeInTheDocument();
});

test("forfeit loss: I did not play in time", async () => {
  const services = makeServices();
  await unlock(services);
  const id = gateway(services).seedIncoming(QUESTIONS, { from: BE_NA });
  now = "2026-10-14T10:00:00.000Z";
  renderAt(`/duel/${id}`, services);
  await skip();
  expect(await screen.findByRole("heading", { name: R.headline.forfeitLoss })).toBeInTheDocument();
  expect(screen.getByText(R.sub.forfeitLoss("Bé Na"))).toBeInTheDocument();
  expect(screen.queryByText(/Kim bài/)).not.toBeInTheDocument();
});

test("« Revanche » challenges the same player again and opens the new run", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await skip();
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(R.rematch) }));
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/duel\/.+\/run$/));
  expect(screen.getByTestId("where")).not.toHaveTextContent(`/duel/${id}/run`);
});

test("« Retour aux duels » goes back to the hub", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  await skip();
  await userEvent.click(await screen.findByRole("button", { name: R.back }));
  expect(screen.getByTestId("where")).toHaveTextContent("/duels");
});

test("an unknown duel says so", async () => {
  const services = makeServices();
  renderAt("/duel/nope", services);
  expect(await screen.findByText(fr.duels.run.notFound.title)).toBeInTheDocument();
});

// --- Sounds (spec sound-and-reveal §4.2–4.3) ---

const BA_NGOAI = "bot_ba_ngoai"; // wears the Thuận Thiên sword (epic): its own blow sound
const soundOf = (services: Services): FakeSoundPlayer => {
  if (!(services.sound instanceof FakeSoundPlayer)) throw new Error("expected the fake sound player");
  return services.sound;
};
/** Me with the iron fan (rare, from a pull): its family sound. */
async function wearFan(services: Services) {
  const fan = { itemId: "acc_quat_sat", rarity: "rare" as const, duplicate: false, refund: 0 };
  await services.progress.appendEvent({ type: "gacha_pulled", refId: "pull1", xp: 0, payload: { theme: "legendes_sombres", cost: 0, items: [fan] } }, now);
  await services.progress.appendEvent({ type: "item_equipped", refId: "accessory", xp: 0, payload: { slot: "accessory", itemId: "acc_quat_sat" } }, now);
  await unlock(services);
  expect(useAppState.getState().wallet?.equipped.accessory).toBe("acc_quat_sat");
}
async function settledAgainst(services: Services, opponent: string, run = STRONG): Promise<string> {
  const gw = gateway(services);
  const res = await gw.create(opponent, QUESTIONS, 1);
  if (!res.ok) throw new Error(res.error);
  const sent = await gw.submitRun(res.duelId, run.round1, run.round2);
  if (!sent.ok) throw new Error(sent.error);
  return res.duelId;
}

test("the replay sounds: the gong, each blow with its fighter's gear on contact, the hurt, the misses, the fanfare and the coins", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await wearFan(services);
  const sound = soundOf(services);
  await openReplay(services, await settledAgainst(services, BA_NGOAI));
  const cues = () => sound.played.map((p) => p.cue);
  // The gong opens the fight.
  await until(() => cues().includes("arena.start"));
  expect(cues()).toEqual(["arena.start"]);
  // My critical winds up in silence, then rings with my fan on contact, louder.
  await until(() => fxOf(1, "[data-fx='glint']") !== null);
  expect(cues()).not.toContain("blow.fan");
  await until(() => fxOf(1, "[data-fx='impact']") !== null);
  expect(sound.played.at(-1)).toEqual({ cue: "blow.fan", strong: true, soft: false });
  // Hers: the Thuận Thiên sword, and my hurt.
  await until(() => fxOf(2, "[data-fx='impact']") !== null);
  expect(sound.played.slice(-2).map((p) => p.cue)).toEqual(["blow.acc_thuan_thien", "fight.hurt"]);
  expect(sound.played.at(-2)?.strong).toBe(true); // her first answer was a critical too

  await until(() => screen.queryByRole("heading", { name: R.headline.win }) !== null);
  await advance(1000);
  const all = cues();
  expect(all.filter((c) => c === "arena.start")).toHaveLength(1);
  // Each of her blows hurts me; mine never sound « hurt ».
  expect(all.filter((c) => c === "fight.hurt")).toHaveLength(all.filter((c) => c === "blow.acc_thuan_thien").length);
  expect(all.filter((c) => c === "blow.fan").length).toBeGreaterThan(0);
  expect(all).toContain("fight.miss"); // she missed one
  // My four round-1 criticals ring louder; the round-2 blow is a plain hit.
  expect(sound.played.filter((p) => p.cue === "blow.fan").map((p) => p.strong)).toEqual([true, true, true, true, false]);
  expect(all.slice(-2)).toEqual(["arena.victory", "arena.coins"]);
  expect(all).not.toContain("arena.defeat");
});

test("« Passer » silences the blows still to come and plays the verdict at once; a loss sounds sober", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  const sound = soundOf(services);
  const weak = { round1: QUESTIONS.round1.map(() => ({ correct: false, ms: 5000 })), round2: [{ correct: true }] };
  await openReplay(services, await settledAgainst(services, BE_NA, weak));
  await act(async () => {
    screen.getByRole("button", { name: R.skip }).click();
  });
  await until(() => screen.queryByRole("heading", { name: R.headline.loss("Bé Na") }) !== null);
  const at = sound.played.length;
  await advance(10_000);
  const after = sound.played.slice(at).map((p) => p.cue);
  expect(after.filter((c) => c.startsWith("blow.") || c.startsWith("fight."))).toEqual([]);
  const cues = sound.played.map((p) => p.cue);
  expect(cues).toContain("arena.defeat");
  expect(cues).not.toContain("arena.victory");
  expect(cues.at(-1)).toBe("arena.coins"); // the consolation Kim bài still clink
  expect(sound.stopped).toBeGreaterThan(0); // what was ringing stops with the scene
});

test("the verdict cue sounds only the first time the result is shown on this device", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  const sound = soundOf(services);
  const id = await settledAgainst(services, BA_NGOAI);
  await openReplay(services, id);
  await act(async () => {
    screen.getByRole("button", { name: R.skip }).click();
  });
  await until(() => screen.queryByRole("heading", { name: R.headline.win }) !== null);
  expect(sound.played.map((p) => p.cue)).toContain("arena.victory");
  cleanup();

  const at = sound.played.length;
  await openReplay(services, id);
  await until(() => screen.queryByRole("heading", { name: R.headline.win }) !== null);
  await advance(2000);
  const again = sound.played.slice(at).map((p) => p.cue);
  expect(again).not.toContain("arena.victory");
  expect(again).not.toContain("arena.defeat");
});

test("a duel with no Kim bài to show stays without coins", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const services = makeServices();
  await unlock(services);
  const sound = soundOf(services);
  const id = gateway(services).seedIncoming(QUESTIONS, { from: BE_NA });
  now = "2026-10-14T10:00:00.000Z"; // forfeit loss: no reward
  await openReplay(services, id);
  await until(() => screen.queryByRole("heading", { name: R.headline.forfeitLoss }) !== null);
  await advance(2000);
  expect(sound.played.map((p) => p.cue)).not.toContain("arena.coins");
  expect(sound.played.map((p) => p.cue)).toContain("arena.defeat");
});
