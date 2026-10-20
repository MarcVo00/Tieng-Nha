import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createFakeServices, FakeDuelGateway, InMemoryContentSource } from "@/adapters/fakes";
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
  // Their critical: my ink leaves with my beat, my number keeps floating until the next beat starts.
  await until(() => fxOf(2, "[data-fx='impact']") !== null);
  expect(fxOf(1, "[data-fx='impact']")).toBeNull();
  expect(fxOf(1, "[data-fx='damage']")).not.toBeNull();
  expect(faceOf("Linh")).toBe("hurt");
  expect(faceOf("Bé Na")).toBe("idle");
  await until(() => document.querySelector("[data-fx-beat='3']") !== null);
  expect(document.querySelector("[data-fx-beat='1']")).toBeNull();
  // The FX layer stays within its node budget all along, and is gone with the verdict.
  await until(() => {
    expect(fxNodes()).toBeLessThanOrEqual(30);
    expect(document.querySelectorAll("[data-fx='impact']").length).toBeLessThanOrEqual(2);
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
  await until(() => screen.queryByText(R.misses(3)) !== null);
  expect(document.querySelector("[aria-live]")).toHaveTextContent(R.missed("Linh", 3));
  expect(document.querySelectorAll("[data-fx='impact'][data-kind='miss']")).toHaveLength(1);
  expect(document.querySelectorAll("[data-fx='miss']")).toHaveLength(1);
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
