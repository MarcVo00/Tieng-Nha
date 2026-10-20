import { cleanup, render, screen } from "@testing-library/react";
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
import type { DuelQuestions, Settings } from "@/domain/types";
import { DuelResultScreen } from "@/features/duels";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import "@/test/routerTestEnv";

// Own file: motion caches the reduced-motion preference on first use, so the media query must be set before any render.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

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

test("with reduced motion the bilan shows at once, with the final HP", async () => {
  const services = makeServices();
  await unlock(services);
  const id = await settledDuel(services);
  renderAt(`/duel/${id}`, services);
  expect(await screen.findByRole("heading", { name: R.headline.win })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: R.skip })).not.toBeInTheDocument();
  expect(screen.getByRole("meter", { name: R.hp("Bé Na", 25) })).toBeInTheDocument();
});
