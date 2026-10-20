import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createFakeServices, FakeDuelGateway, InMemoryContentSource } from "@/adapters/fakes";
import { lessonFixture } from "@/adapters/fakes/seed/lesson";
import { dialogueFixture } from "@/adapters/fakes/seed/dialogue";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture, treeFixture } from "@/adapters/fakes/seed/tree";
import { shopFixture } from "@/adapters/fakes/seed/shop";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import type { Duel, DuelQuestions, Settings } from "@/domain/types";
import { DUEL_ERRORS } from "@/ports";
import { DuelsScreen } from "@/features/duels";
import { newRecord, saveRun } from "@/features/duels/duelRunState";
import { HomeScreen } from "@/features/home";
import { LeaderboardScreen, PublicProfileScreen } from "@/features/leaderboard";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import "@/test/routerTestEnv";

const NOW = "2026-10-10T10:00:00.000Z";
const clock = () => NOW;
const BE_NA = "bot_be_na"; // l01 + d01
const withStt = (stt: boolean): Settings => ({ ...DEFAULT_SETTINGS, capabilities: { tts: true, stt, recorder: false } });

// The fake content only has one lesson: it plays « l01 », the lesson every fake member has done.
const l01 = { ...lessonFixture, id: "l01" };
const QUESTIONS: DuelQuestions = {
  round1: ["l05_e01", "l05_e02", "l05_e03", "l05_e07"].map((exerciseId) => ({ lessonId: "l01", exerciseId })),
  round2: [{ lessonId: "l01", exerciseId: "l05_e05" }],
};

function makeServices(): Services {
  const content = new InMemoryContentSource([l01], [dialogueFixture], examPoolFixture, [], treeFixture, [bossFixture], shopFixture);
  return createFakeServices({ clock, content });
}

async function unlock(services: Services) {
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await services.progress.appendEvent({ type: "dialogue_completed", refId: "d01", xp: 10, payload: {} }, NOW);
  await refreshState(services);
}

async function refreshState(services: Services) {
  const [snapshot, wallet] = await Promise.all([services.activity.getSnapshot(), services.activity.getWallet()]);
  useAppState.setState({ snapshot, wallet });
}

const gateway = (services: Services): FakeDuelGateway => {
  if (!(services.duels instanceof FakeDuelGateway)) throw new Error("expected the fake duel gateway");
  return services.duels;
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(route: string, services: Services) {
  return render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/duels" element={<DuelsScreen />} />
          <Route path="/u/:userId" element={<PublicProfileScreen />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/" element={<HomeScreen />} />
          <Route path="/duel/:id/run" element={<p>course</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

beforeEach(() => {
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
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("prerequisites", () => {
  test("the hub explains the lock to a player who has not unlocked duels", async () => {
    const services = makeServices();
    await refreshState(services);
    renderAt("/duels", services);
    expect(await screen.findByText(fr.duels.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Défier/ })).not.toBeInTheDocument();
  });

  test("the profile of a player who has not unlocked duels shows the lock instead of the button", async () => {
    const services = makeServices();
    await refreshState(services);
    renderAt(`/u/${BE_NA}`, services);
    expect(await screen.findByText(fr.duels.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.duels.challenge })).not.toBeInTheDocument();
  });

  test("an opponent who lacks the prerequisites is named, and no duel is created", async () => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.leaderboard, "getPublicProfile").mockResolvedValue({
      userId: "x", pseudo: "Cô Ba", avatarEmoji: "🌸", xpTotal: 0, xpWeek: 0, streak: 0, lessonsDone: ["l01"], dialoguesDone: [],
      badges: [], examBest: null, frame: null, fx: null, look: {},
    });
    const create = vi.spyOn(services.duels, "create");
    renderAt("/u/x", services);
    expect(await screen.findByText(fr.duels.opponentLocked("Cô Ba"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.duels.challenge })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  test("too few exercises in the common lessons: a calm message and no duel", async () => {
    const noSpeak = { ...l01, exercises: l01.exercises.filter((x) => x.type !== "speak") };
    const content = new InMemoryContentSource([noSpeak], [dialogueFixture], examPoolFixture, [], treeFixture, [bossFixture], shopFixture);
    const services = createFakeServices({ clock, content });
    await unlock(services);
    const create = vi.spyOn(services.duels, "create");
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.duels.noCommon);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("challenge from a public profile", () => {
  test("creates the duel with questions from the common lessons and opens the run", async () => {
    const services = makeServices();
    await unlock(services);
    const create = vi.spyOn(services.duels, "create");
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/duel\/.+\/run$/));
    expect(create).toHaveBeenCalledTimes(1);
    const [opponent, questions] = create.mock.calls[0] ?? [];
    expect(opponent).toBe(BE_NA);
    const refs = [...(questions?.round1 ?? []), ...(questions?.round2 ?? [])];
    expect(refs.length).toBeGreaterThanOrEqual(5);
    expect(refs.every((r) => r.lessonId === "l01")).toBe(true);
    expect(questions?.round1.length).toBeLessThanOrEqual(8);
    expect(questions?.round2.length).toBeGreaterThanOrEqual(1);
  });

  test("without speech recognition it says so and creates nothing", async () => {
    useAppState.setState({ settings: withStt(false) });
    const services = makeServices();
    await unlock(services);
    const create = vi.spyOn(services.duels, "create");
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.duels.noMic, { normalizeWhitespace: false });
    expect(create).not.toHaveBeenCalled();
  });

  test.each(DUEL_ERRORS.map((code) => [code]))("the %s refusal shows its own message", async (code) => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.duels, "create").mockResolvedValue({ ok: false, error: code });
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.duels.errors[code], { normalizeWhitespace: false });
    expect(screen.getByTestId("where")).toHaveTextContent(`/u/${BE_NA}`);
  });

  test("offline: a calm message", async () => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.duels, "create").mockRejectedValue(new OfflineError());
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.duels.offline);
  });
});

describe("hub lists", () => {
  test("splits duels I started and duels that were sent to me, and keeps the last 10 finished", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const incoming = gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" }); // to play, I am the opponent
    const mine = await gw.create(BE_NA, QUESTIONS, 3); // the auto-opponent played: to play for me, I am the challenger
    if (!mine.ok) throw new Error(mine.error);
    // I play the one I started: it settles at once (auto-opponent) → finished, not waiting.
    await gw.submitRun(mine.duelId, QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), QUESTIONS.round2.map(() => ({ correct: true })));
    renderAt("/duels", services);

    const toPlay = await screen.findByRole("region", { name: fr.duels.toPlay });
    expect(within(toPlay).getByText(fr.duels.hub.versus("Bà Ngoại"))).toBeInTheDocument();
    expect(within(toPlay).getByRole("link")).toHaveAttribute("href", `/duel/${incoming}/run`);
    expect(screen.queryByRole("region", { name: fr.duels.waiting })).not.toBeInTheDocument();
    const done = screen.getByRole("region", { name: fr.duels.done });
    expect(within(done).getAllByRole("link")).toHaveLength(1);
    expect(within(done).getByRole("link")).toHaveAttribute("href", `/duel/${mine.duelId}`);
  });

  test("a duel I played and that waits for the other is «\u202fEn attente\u202f»", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const id = gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai", theirRun: false });
    await gw.submitRun(id, QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), QUESTIONS.round2.map(() => ({ correct: true })));
    renderAt("/duels", services);
    const waiting = await screen.findByRole("region", { name: fr.duels.waiting });
    expect(within(waiting).getByText(fr.duels.hub.waitingFor("Bà Ngoại"))).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: fr.duels.toPlay })).not.toBeInTheDocument();
  });

  test("a duel with a local unsent or in-progress run links to the run and says so", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const started = gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    gw.seedIncoming(QUESTIONS, { from: "bot_chu_tu" });
    const full = gw.seedIncoming(QUESTIONS, { from: BE_NA });
    saveRun(started, newRecord(QUESTIONS, 1));
    localStorage.setItem(`tn-duel-pending:${full}`, JSON.stringify({ round1: QUESTIONS.round1.map(() => ({ correct: true, ms: 900 })), round2: [{ correct: true }] }));
    renderAt("/duels", services);

    const toPlay = await screen.findByRole("region", { name: fr.duels.toPlay });
    const row = (name: string) => within(toPlay).getByText(fr.duels.hub.versus(name)).closest("a");
    expect(row("Bà Ngoại")).toHaveAttribute("href", `/duel/${started}/run`);
    expect(row("Bà Ngoại")).toHaveTextContent(fr.duels.hub.resume);
    expect(row("Chú Tư")).toHaveTextContent(fr.duels.hub.play);
    expect(row("Bé Na")).toHaveAttribute("href", `/duel/${full}/run`);
    expect(row("Bé Na")).toHaveTextContent(fr.duels.hub.unsent);
  });

  test("shows only the last 10 finished duels, newest first", async () => {
    const services = makeServices();
    await unlock(services);
    const base = {
      challenger: "me", opponent: BE_NA, opponentPseudo: "Bé Na", opponentAvatar: "🌸", status: "settled" as const, winner: "me", seed: 1,
      questions: QUESTIONS, theirRun: null, expiresAt: "2026-10-30T00:00:00.000Z",
      myRun: { round1: [], round2: [], damage: 0, timeMs: 0, reward: 3, claimed: false },
    };
    // Postgres timestamps: not ISO-Z, so they are compared with Date.parse.
    const list: Duel[] = Array.from({ length: 12 }, (_, i) => ({ ...base, id: `d${i}`, createdAt: `2026-10-${String(i + 1).padStart(2, "0")} 08:00:00+00` }));
    vi.spyOn(services.duels, "list").mockResolvedValue(list);
    renderAt("/duels", services);
    const done = await screen.findByRole("region", { name: fr.duels.done });
    const links = within(done).getAllByRole("link");
    expect(links).toHaveLength(10);
    expect(links[0]).toHaveAttribute("href", "/duel/d11");
    expect(links[9]).toHaveAttribute("href", "/duel/d2");
  });

  test("offline: a calm state, not an error", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).online = false;
    renderAt("/duels", services);
    expect(await screen.findByText(fr.duels.hub.offline.title)).toBeInTheDocument();
    expect(screen.queryByText(fr.duels.hub.error.title)).not.toBeInTheDocument();
  });

  test("a real error offers a retry", async () => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.duels, "list").mockRejectedValue(new Error("boom"));
    renderAt("/duels", services);
    expect(await screen.findByText(fr.duels.hub.error.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.app.error.retry })).toBeInTheDocument();
  });

  test("the challenge section lists the group and starts a duel", async () => {
    const services = makeServices();
    await unlock(services);
    renderAt("/duels", services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.hub.challengeWho("Bé Na") }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/duel\/.+\/run$/));
  });

  test("a member with an open duel cannot be challenged again", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).seedIncoming(QUESTIONS, { from: BE_NA });
    renderAt("/duels", services);
    expect(await screen.findByRole("button", { name: fr.duels.hub.challengeWho("Bé Na") })).toBeDisabled();
    expect(screen.getByRole("button", { name: fr.duels.hub.challengeWho("Chú Tư") })).toBeEnabled();
  });

  test("the disabled challenge says why, also for screen readers", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).seedIncoming(QUESTIONS, { from: BE_NA });
    renderAt("/duels", services);
    const button = await screen.findByRole("button", { name: fr.duels.hub.challengeWho("Bé Na") });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(fr.duels.hub.alreadyOpen);
    expect(screen.getAllByText(fr.duels.hub.alreadyOpen)).toHaveLength(1);
    expect(screen.getByRole("button", { name: fr.duels.hub.challengeWho("Chú Tư") })).not.toHaveAccessibleDescription();
  });
});

describe("Kim bài", () => {
  test("opening the hub claims settled duels once and updates the balance", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const created = await gw.create(BE_NA, QUESTIONS, 3);
    if (!created.ok) throw new Error(created.error);
    await gw.submitRun(created.duelId, QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), QUESTIONS.round2.map(() => ({ correct: true })));
    const claim = vi.spyOn(services.activity, "claimSettledDuels");

    renderAt("/duels", services);
    await screen.findByRole("region", { name: fr.duels.done });
    await waitFor(() => expect(useAppState.getState().wallet?.kimBai).toBeGreaterThan(0));
    const balance = useAppState.getState().wallet?.kimBai ?? 0;
    expect(screen.getByText(`${fr.duels.kimBaiLabel}\u202f: ${fr.duels.kimBai(balance)}`)).toBeInTheDocument();

    cleanup();
    renderAt("/duels", services); // a second opening must not pay twice
    await screen.findByRole("region", { name: fr.duels.done });
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    expect(useAppState.getState().wallet?.kimBai).toBe(balance);
  });
});

describe("pending duels entry points", () => {
  test("the home banner names the challenger when a duel awaits me", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    renderAt("/", services);
    const banner = await screen.findByRole("link", { name: fr.duels.banner("Bà Ngoại", 0) });
    expect(banner).toHaveAttribute("href", "/duels");
  });

  test("no banner when there is no duel at all (once the list has loaded)", async () => {
    const services = makeServices();
    await unlock(services);
    const list = vi.spyOn(services.duels, "list");
    renderAt("/", services);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await list.mock.results[0]?.value;
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: /Duel en attente/ })).not.toBeInTheDocument();
  });

  test("no banner for a duel I already played", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const id = gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    await gw.submitRun(id, QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), QUESTIONS.round2.map(() => ({ correct: true })));
    const list = vi.spyOn(services.duels, "list");
    renderAt("/", services);
    await waitFor(() => expect(list).toHaveBeenCalled());
    const listed = await list.mock.results[0]?.value;
    expect(listed).toHaveLength(1); // the duel is there, played: that is why there is no banner
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: /Duel en attente/ })).not.toBeInTheDocument();
  });

  test("a settled duel whose result I have not seen is announced; the to-play banner keeps priority; seen clears it", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    const id = gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    await gw.submitRun(id, QUESTIONS.round1.map(() => ({ correct: true, ms: 1000 })), QUESTIONS.round2.map(() => ({ correct: true })));
    const first = renderAt("/", services);
    const banner = await screen.findByRole("link", { name: fr.duels.resultBanner("Bà Ngoại") });
    expect(banner).toHaveAttribute("href", `/duel/${id}`);
    first.unmount();

    gw.seedIncoming(QUESTIONS, { from: "bot_chu_tu" });
    const second = renderAt("/", services);
    expect(await screen.findByRole("link", { name: fr.duels.banner("Chú Tư", 0) })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: fr.duels.resultBanner("Bà Ngoại") })).not.toBeInTheDocument();
    second.unmount();

    localStorage.setItem(`tn-duel-seen:${id}`, "true");
    const list = vi.spyOn(services.duels, "list");
    renderAt("/", services);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await list.mock.results[0]?.value;
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: /Résultat dispo/ })).not.toBeInTheDocument();
  });

  test("offline while creating: a lesson load that fails offline shows the offline message", async () => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.content, "getLesson").mockRejectedValue(new OfflineError());
    const create = vi.spyOn(services.duels, "create");
    renderAt(`/u/${BE_NA}`, services);
    await userEvent.click(await screen.findByRole("button", { name: fr.duels.challenge }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.duels.offline);
    expect(create).not.toHaveBeenCalled();
  });

  test("a member-list failure shows a hint with retry, not an empty group", async () => {
    const services = makeServices();
    await unlock(services);
    vi.spyOn(services.leaderboard, "list").mockRejectedValueOnce(new OfflineError());
    renderAt("/duels", services);
    expect(await screen.findByText(fr.duels.hub.membersError)).toBeInTheDocument();
    expect(screen.queryByText(fr.duels.hub.empty.title)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.app.error.retry }));
    expect(await screen.findByRole("button", { name: fr.duels.hub.challengeWho("Bé Na") })).toBeInTheDocument();
  });

  test("only the first duel to play carries the primary pill", async () => {
    const services = makeServices();
    await unlock(services);
    const gw = gateway(services);
    gw.seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    gw.seedIncoming(QUESTIONS, { from: "bot_chu_tu" });
    renderAt("/duels", services);
    const toPlay = await screen.findByRole("region", { name: fr.duels.toPlay });
    const pills = within(toPlay).getAllByText(fr.duels.hub.play);
    expect(pills.filter((p) => p.className.includes("bg-primary"))).toHaveLength(1);
  });

  test("the leaderboard «\u202fDuels\u202f» entry counts the duels to play", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).seedIncoming(QUESTIONS, { from: "bot_ba_ngoai" });
    gateway(services).seedIncoming(QUESTIONS, { from: "bot_chu_tu" });
    renderAt("/leaderboard", services);
    const entry = await screen.findByRole("link", { name: new RegExp(fr.duels.entry.pending(2)) });
    expect(entry).toHaveAttribute("href", "/duels");
  });

  test("offline, the entry stays quiet", async () => {
    const services = makeServices();
    await unlock(services);
    gateway(services).seedIncoming(QUESTIONS);
    gateway(services).online = false;
    renderAt("/leaderboard", services);
    expect(await screen.findByRole("link", { name: fr.duels.entry.label })).toBeInTheDocument();
  });
});

describe("arena entry", () => {
  test("the hub links to /arena once duels are unlocked", async () => {
    const services = makeServices();
    await unlock(services);
    renderAt("/duels", services);
    const link = await screen.findByRole("link", { name: new RegExp(fr.arena.entry) });
    expect(link).toHaveAttribute("href", "/arena");
  });
});
