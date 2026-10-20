import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { ExamQuestion } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import { bossMention, buildDeck } from "@/services/bossFight";
import { seedFromString } from "@/services/random";
import { ExamResultScreen, ExamRunScreen } from "@/features/exam";
import { markAttempt, type ResultState, type RunState } from "@/features/exam/examState";

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

const ATTEMPT: RunState = { attemptId: "attempt-fixed", remainingToday: 2 };
const MOVES = /translate|rotate|scale/;

function renderRun(over: { hp?: number; playerLives?: number }) {
  useAppState.setState({
    settings: { ...DEFAULT_SETTINGS, capabilities: { tts: true, stt: false, recorder: false } },
    profile: { pseudo: "Linh", avatarEmoji: "🐉" },
    energy: null,
    wallet: null,
  });
  markAttempt("pending", ATTEMPT.attemptId);
  const services = createFakeServices();
  const boss = { ...bossFixture, ...over };
  vi.spyOn(services.content, "getBoss").mockResolvedValue(boss);
  const deck = buildDeck(examPoolFixture, boss, seedFromString(ATTEMPT.attemptId), false);
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[{ pathname: "/exam/run", state: ATTEMPT }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/exam" element={<p>intro</p>} />
          <Route path="/exam/run" element={<ExamRunScreen />} />
          <Route path="/exam/result" element={<ExamResultScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return deck;
}

async function answer(q: ExamQuestion | undefined, right: boolean) {
  if (!q) throw new Error("deck too short");
  await waitFor(() => expect(document.querySelector(`[data-exercise-id="${q.exercise.id}"]`)).not.toBeNull());
  const ex = q.exercise;
  if (ex.type === "tone_pick") await userEvent.click(screen.getByRole("button", { name: right ? fr.ui.tones[ex.answerTone] : fr.ui.tones[ex.answerTone === "ngang" ? "sac" : "ngang"] }));
  else if (ex.type === "translate_choose") await userEvent.click(screen.getByRole("button", { name: right ? ex.answerVi : (ex.distractorsVi[0] ?? "") }));
  else if (ex.type === "listen_choose") await userEvent.click(screen.getByRole("button", { name: (ex.vocabId === "v_ca_phe_sua_da") === right ? /café au lait glacé/ : /thé glacé/ }));
  else if (ex.type === "word_order") {
    const bank = within(screen.getByRole("group", { name: fr.exercises.wordOrder.bank }));
    for (const t of right ? ex.tokensVi : [...ex.tokensVi].reverse()) await userEvent.click(bank.getByRole("button", { name: t }));
  } else throw new Error(`unexpected ${ex.type}`);
  await userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
}

/** Every inline transform under the stage: nothing may move, shake or fly. */
const movedNodes = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>("*")].map((el) => el.style?.transform ?? "").filter((t) => MOVES.test(t) && t !== "scaleX(-1)");

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test("under reduced motion a hit moves nothing: no lunge, no shake, no droplet, no glint", async () => {
  const deck = renderRun({});
  const stage = await screen.findByRole("group", { name: fr.exam.run.stage("Thủy Tinh") });
  await answer(deck[0], true);
  await waitFor(() => expect(screen.getByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 14, 15) })).toBeInTheDocument());
  await waitFor(() => expect(stage.querySelector("[data-fx='impact']")).not.toBeNull());
  expect(stage.querySelectorAll("[data-fx='impact'] circle")).toHaveLength(0);
  expect(stage.querySelector("[data-fx='glint']")).toBeNull();
  expect(movedNodes(stage)).toEqual([]);
});

test("under reduced motion a miss sends no wave: the hero only winces", async () => {
  const deck = renderRun({});
  const stage = await screen.findByRole("group", { name: fr.exam.run.stage("Thủy Tinh") });
  await answer(deck[0], false);
  expect(await screen.findByRole("img", { name: fr.ui.hearts(4, 5) })).toBeInTheDocument();
  expect(stage.querySelector("[data-fx='wave']")).toBeNull();
  expect(stage.querySelector("[data-fighter='hero'] [data-expression]")).toHaveAttribute("data-expression", "hurt");
  expect(movedNodes(stage)).toEqual([]);
});

test("under reduced motion the K.-O. fades to the defeated face, static bow, and still leads to the result", async () => {
  const deck = renderRun({ hp: 1 });
  await screen.findByRole("group", { name: fr.exam.run.stage("Thủy Tinh") });
  await answer(deck[0], true);
  expect(await screen.findByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector("[data-fighter='boss'] [data-expression]")).toHaveAttribute("data-expression", "ko"));
  expect(document.querySelector("[data-fighter='boss'] [data-pose]")).toHaveAttribute("data-pose", "bow");
  expect(document.querySelectorAll("[data-fx='impact'] circle")).toHaveLength(0);
  await userEvent.click(await screen.findByRole("button", { name: fr.exam.run.skip }));
  expect(await screen.findByRole("heading", { level: 1, name: fr.exam.result.won("Thủy Tinh") })).toBeInTheDocument();
});

test("under reduced motion the victory shows its final pose at once", async () => {
  const state: ResultState = {
    score: 92,
    mention: bossMention(92),
    results: [],
    questions: [],
    noSpeaking: false,
    xpGained: 30,
    coinsGained: 0,
    newBadges: [],
    remainingToday: 1,
    dateIso: "2026-11-09T10:00:00.000Z",
    boss: { id: "boss_thuy_tinh", name: "Thủy Tinh", title: "Le dieu des eaux", illustration: "boss_thuy_tinh", hp: 15, playerLives: 5, won: true, livesLeft: 4, bossHpLeft: 0 },
  };
  useAppState.setState({ profile: { pseudo: "Linh", avatarEmoji: "🐉" }, wallet: null });
  render(
    <ServicesProvider services={createFakeServices()}>
      <MemoryRouter initialEntries={[{ pathname: "/exam/result", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/exam/result" element={<ExamResultScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  const boss = await screen.findByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" });
  expect(boss.querySelector("[data-pose]")).toHaveAttribute("data-pose", "bow");
  expect(boss.querySelector("[data-fx='glint']")).toBeNull();
});
