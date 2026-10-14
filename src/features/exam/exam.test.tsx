import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices, FakeSpeechRecognizer } from "@/adapters/fakes";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import type { ExamQuestion, ProgressSnapshot, Settings } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import { bossMention, buildDeck } from "@/services/bossFight";
import { seedFromString } from "@/services/random";
import { ExamIntroScreen, ExamResultScreen, ExamRunScreen } from "@/features/exam";
import { markAttempt, type ResultState, type RunState } from "@/features/exam/examState";
import { PRINT_CSS } from "@/ui/Certificate";

const TEST_TIMEOUT = 90_000;
const ATTEMPT: RunState = { attemptId: "attempt-fixed", remainingToday: 2 };

const snapshotWith = (lessons: number, examBest: number | null = null): ProgressSnapshot => ({
  xpTotal: 120,
  xpWeek: 40,
  xpToday: 10,
  streak: 3,
  lessonsDone: lessons > 0 ? ["l05"] : [],
  perfectLessons: [],
  dialoguesDone: [],
  vocabReviewed: 0,
  examBest,
  badges: [],
  activeDays: [],
});

const withCapabilities = (stt: boolean): Settings => ({ ...DEFAULT_SETTINGS, capabilities: { tts: true, stt, recorder: false } });

function renderExam(opts: { services?: Services; entry: string | { pathname: string; state: unknown } }) {
  const services = opts.services ?? createFakeServices();
  const view = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[opts.entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<p>page d'accueil</p>} />
          <Route path="/review" element={<p>page de révision</p>} />
          <Route path="/exam" element={<ExamIntroScreen />} />
          <Route path="/exam/run" element={<ExamRunScreen />} />
          <Route path="/exam/result" element={<ExamResultScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { ...view, services };
}

beforeEach(() => {
  useAppState.setState({
    snapshot: snapshotWith(10),
    settings: withCapabilities(true),
    profile: { pseudo: "Linh", avatarEmoji: "🐉" },
    energy: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("intro", () => {
  test("is locked until the tree unlocks the boss and shows the progress", async () => {
    useAppState.setState({ snapshot: snapshotWith(0) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.locked.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Thủy Tinh" })).toBeInTheDocument();
    expect(screen.getByText(fr.exam.intro.locked.progress(0, 1))).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByRole("button", { name: fr.exam.intro.start })).not.toBeInTheDocument();
  });

  test("a failed tree load shows a retry that brings the intro back", async () => {
    const services = createFakeServices();
    vi.spyOn(services.content, "getTree").mockRejectedValueOnce(new Error("offline"));
    renderExam({ services, entry: "/exam" });
    expect(await screen.findByText(fr.exam.intro.loadError.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.app.error.retry }));
    expect(await screen.findByRole("button", { name: fr.exam.intro.start })).toBeEnabled();
  });

  test("presents the boss, its legend and the fight rules once unlocked", async () => {
    useAppState.setState({ snapshot: snapshotWith(1, null) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeInTheDocument();
    expect(screen.getByText(/Mỵ Nương/)).toBeInTheDocument();
    for (const rule of fr.exam.intro.rules(15, 5)) expect(screen.getByText(rule)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.exam.intro.start })).toBeEnabled();
  });

  test("shows the best victory as the lives kept", async () => {
    useAppState.setState({ snapshot: snapshotWith(1, 92) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByText(fr.exam.intro.won("Thủy Tinh", 4, 5))).toBeInTheDocument();
  });

  test("shows a legacy winning score as a victory", async () => {
    useAppState.setState({ snapshot: snapshotWith(1, 84) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByText(fr.exam.intro.won("Thủy Tinh", 2, 5))).toBeInTheDocument();
  });

  test("offline disables the start button", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderExam({ entry: "/exam" });
    expect(await screen.findByRole("button", { name: fr.exam.intro.start })).toBeDisabled();
    expect(screen.getByText(fr.exam.intro.offline)).toBeInTheDocument();
  });

  test("shows the daily limit message after three attempts", async () => {
    const services = createFakeServices();
    for (let i = 0; i < 3; i++) await services.exam.startAttempt();
    renderExam({ services, entry: "/exam" });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.intro.start }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu as utilisé tes 3 essais aujourd'hui. Reviens demain !");
  });

  test("starting an attempt opens the run with the attempt in the router state", async () => {
    const services = createFakeServices();
    vi.spyOn(services.exam, "startAttempt").mockResolvedValue(ATTEMPT);
    renderExam({ services, entry: "/exam" });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.intro.start }));
    expect(await screen.findByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeInTheDocument();
  });

  test("starting the boss spends 3 energy", async () => {
    const services = createFakeServices();
    vi.spyOn(services.exam, "startAttempt").mockResolvedValue(ATTEMPT);
    renderExam({ services, entry: "/exam" });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.intro.start }));
    expect(await screen.findByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(2);
  });

  test("with less than 3 energy the start is disabled and points to the reviews", async () => {
    const services = createFakeServices();
    const startAttempt = vi.spyOn(services.exam, "startAttempt");
    for (let i = 0; i < 3; i++) await services.activity.startSession("lesson", "l05");
    useAppState.setState({ energy: await services.activity.getEnergy(), dueCount: 2 });
    renderExam({ services, entry: "/exam" });
    expect(await screen.findByRole("button", { name: fr.exam.intro.start })).toBeDisabled();
    expect(screen.getByText(fr.exam.intro.noEnergy(3))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: fr.energy.review }));
    expect(await screen.findByText("page de révision")).toBeInTheDocument();
    expect(startAttempt).not.toHaveBeenCalled();
  });

  test("with less than 3 energy and nothing due the message stays but the review link is gone", async () => {
    const services = createFakeServices();
    for (let i = 0; i < 3; i++) await services.activity.startSession("lesson", "l05");
    useAppState.setState({ energy: await services.activity.getEnergy(), dueCount: 0 });
    renderExam({ services, entry: "/exam" });
    expect(await screen.findByText(fr.exam.intro.noEnergy(3))).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: fr.energy.review })).toBeNull();
  });

  test("the intro reloads the energy when it opens", async () => {
    const services = createFakeServices();
    const getEnergy = vi.spyOn(services.activity, "getEnergy");
    renderExam({ services, entry: "/exam" });
    await screen.findByRole("button", { name: fr.exam.intro.start });
    expect(getEnergy).toHaveBeenCalled();
  });

  test("an unexpected failure shows the generic message", async () => {
    const services = createFakeServices();
    vi.spyOn(services.exam, "startAttempt").mockRejectedValue(new Error("boom"));
    renderExam({ services, entry: "/exam" });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.intro.start }));
    expect(await screen.findByRole("alert")).toHaveTextContent(fr.exam.intro.error);
  });

  test("an offline failure shows the offline message", async () => {
    const services = createFakeServices();
    vi.spyOn(services.exam, "startAttempt").mockRejectedValue(new OfflineError());
    renderExam({ services, entry: "/exam" });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.intro.start }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le test nécessite une connexion");
  });

  test("shows the interrupted-attempt message after a reload", async () => {
    renderExam({ entry: { pathname: "/exam", state: { interrupted: true } } });
    expect(await screen.findByRole("status")).toHaveTextContent("Essai interrompu — il est compté.");
  });
});

describe("run", () => {
  test("a reload of the run page abandons the attempt and says so", async () => {
    markAttempt("pending", ATTEMPT.attemptId);
    const first = renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    expect(await screen.findByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeInTheDocument();
    first.unmount();
    renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Essai interrompu — il est compté.");
  });

  test("a run page without a started attempt goes back to the intro", async () => {
    renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("redirects to the intro without an attempt", async () => {
    renderExam({ entry: "/exam/run" });
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
  });

  test("quitting asks for confirmation and counts the attempt", async () => {
    markAttempt("pending", ATTEMPT.attemptId);
    renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.run.quit.aria }));
    expect(await screen.findByText(fr.exam.run.quit.body)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.exam.run.quit.cancel }));
    await waitFor(() => expect(screen.queryByText(fr.exam.run.quit.body)).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: fr.exam.run.quit.aria }));
    await userEvent.click(await screen.findByRole("button", { name: fr.exam.run.quit.confirm }));
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
  });

  async function fight(deck: ExamQuestion[], rightUntil: number, stt: FakeSpeechRecognizer) {
    // Answers right for the first `rightUntil` questions, wrong afterwards, until the result page shows up.
    for (const [i, q] of deck.entries()) {
      // Either the next question is up, or the fight ended and the result page took over.
      await waitFor(() => {
        if (screen.queryByRole("heading", { level: 1 })) return;
        expect(document.querySelectorAll("[data-exercise-id]")).toHaveLength(1);
      }, { timeout: 8000 });
      if (screen.queryByRole("heading", { level: 1 })) return;
      await waitFor(() => expect(document.querySelector(`[data-exercise-id="${q.exercise.id}"]`)).not.toBeNull());
      const right = i < rightUntil;
      const ex = q.exercise;
      const verify = () => userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
      switch (ex.type) {
        case "listen_choose": {
          const label = (ex.vocabId === "v_ca_phe_sua_da") === right ? /café au lait glacé/ : /thé glacé/;
          await userEvent.click(await screen.findByRole("button", { name: label }));
          await verify();
          break;
        }
        case "tone_pick":
          await userEvent.click(await screen.findByRole("button", { name: right ? fr.ui.tones[ex.answerTone] : fr.ui.tones[ex.answerTone === "ngang" ? "sac" : "ngang"] }));
          await verify();
          break;
        case "translate_choose":
          await userEvent.click(await screen.findByRole("button", { name: right ? ex.answerVi : (ex.distractorsVi[0] ?? "") }));
          await verify();
          break;
        case "word_order": {
          const bank = within(await screen.findByRole("group", { name: fr.exercises.wordOrder.bank }));
          const tokens = right ? ex.tokensVi : [...ex.tokensVi].reverse();
          for (const token of tokens) await userEvent.click(bank.getByRole("button", { name: token }));
          await verify();
          break;
        }
        case "speak":
          stt.queue = [[right ? ex.vi : "không"]];
          await userEvent.click(await screen.findByRole("button", { name: /parler/i }));
          break;
      }
    }
  }

  function setupFight(stt: boolean) {
    useAppState.setState({ settings: withCapabilities(stt) });
    markAttempt("pending", ATTEMPT.attemptId);
    const recognizer = new FakeSpeechRecognizer();
    const services = createFakeServices({ stt: recognizer });
    const finishExam = vi.spyOn(services.activity, "finishExam");
    const submit = vi.spyOn(services.exam, "submitAttempt");
    const deck = buildDeck(examPoolFixture, bossFixture, seedFromString(ATTEMPT.attemptId), stt);
    renderExam({ services, entry: { pathname: "/exam/run", state: ATTEMPT } });
    return { recognizer, finishExam, submit, deck };
  }

  test(
    "15 right answers beat Thủy Tinh with 5 lives: score 100, one saved finish",
    async () => {
      const { recognizer, finishExam, submit, deck } = setupFight(true);
      expect(await screen.findByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeInTheDocument();
      await fight(deck, 99, recognizer);
      await waitFor(() => expect(finishExam).toHaveBeenCalledTimes(1), { timeout: 8000 });
      expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 100, noSpeaking: false, boss: { bossId: "boss_thuy_tinh", won: true, livesLeft: 5, bossHpLeft: 0 } });
      expect(submit).toHaveBeenCalledWith(ATTEMPT.attemptId, 100);
    },
    TEST_TIMEOUT,
  );

  test(
    "five mistakes in a row lose the fight with the damage dealt so far",
    async () => {
      const { recognizer, finishExam, deck } = setupFight(false);
      expect(deck.some((q) => q.section === "speaking")).toBe(false);
      await fight(deck, 3, recognizer); // 3 hits, then wrong until 0 lives
      await waitFor(() => expect(finishExam).toHaveBeenCalledTimes(1), { timeout: 8000 });
      expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 12, noSpeaking: true, boss: { bossId: "boss_thuy_tinh", won: false, livesLeft: 0, bossHpLeft: 12 } });
    },
    TEST_TIMEOUT,
  );
});

describe("result", () => {
  const questions = buildDeck(examPoolFixture, bossFixture, 7, true);
  const failedState = (remainingToday: number): ResultState => ({
    score: 40,
    mention: "presque",
    results: questions.map((q, i) => ({ score: i < 12 ? 1 : 0, correct: i < 12, skipped: false, expected: q.exercise.type === "speak" ? q.exercise.vi : `réponse ${i}` })),
    questions,
    noSpeaking: false,
    xpGained: 5,
    newBadges: [],
    remainingToday,
    dateIso: "2026-11-09T10:00:00.000Z",
    boss: { id: "boss_thuy_tinh", name: "Thủy Tinh", title: "Le dieu des eaux", illustration: "boss_thuy_tinh", hp: 15, playerLives: 5, won: false, livesLeft: 0, bossHpLeft: 9 },
  });

  test("redirects to the intro without a result", async () => {
    renderExam({ entry: "/exam/result" });
    expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
  });

  const result = (over: { score: number; won: boolean; livesLeft: number; bossHpLeft: number; remainingToday?: number }): ResultState => {
    const base = failedState(over.remainingToday ?? 2);
    return {
      ...base,
      score: over.score,
      mention: bossMention(over.score),
      boss: { ...base.boss, won: over.won, livesLeft: over.livesLeft, bossHpLeft: over.bossHpLeft },
    };
  };

  test("a victory shows the defeated boss, the lives kept and the certificate", async () => {
    renderExam({ entry: { pathname: "/exam/result", state: result({ score: 92, won: true, livesLeft: 4, bossHpLeft: 0 }) } });
    const headline = await screen.findByRole("heading", { name: fr.exam.result.won("Thủy Tinh") });
    expect(headline).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: fr.ui.hearts(4, 5) })).toBeInTheDocument();
    expect(within(headline.closest("header") as HTMLElement).getByText(fr.exam.result.mention.excellent)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.exam.result.download })).toBeInTheDocument();
  });

  test("a defeat shows the damage dealt, a retry and the review, no certificate", async () => {
    renderExam({ entry: { pathname: "/exam/result", state: result({ score: 36, won: false, livesLeft: 0, bossHpLeft: 6 }) } });
    expect(await screen.findByRole("heading", { name: fr.exam.result.lost("Thủy Tinh") })).toBeInTheDocument();
    expect(screen.getByText(fr.exam.result.damage(9, 15))).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Certificat/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.exam.result.retry(2) })).toBeEnabled();
    expect(screen.queryByRole("button", { name: fr.exam.result.download })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: fr.exam.result.review }));
    expect(await screen.findByText("page de révision")).toBeInTheDocument();
  });

  test("no attempts left disables the retry", async () => {
    renderExam({ entry: { pathname: "/exam/result", state: failedState(0) } });
    expect(await screen.findByRole("button", { name: fr.exam.result.noMoreTries })).toBeDisabled();
  });

  test("the correction list expands with the expected answers and marks", async () => {
    renderExam({ entry: { pathname: "/exam/result", state: failedState(1) } });
    const toggle = await screen.findByRole("button", { name: fr.exam.result.showCorrection });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: fr.exam.result.hideCorrection })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("img", { name: fr.exam.result.right })).toHaveLength(12);
    expect(screen.getAllByRole("img", { name: fr.exam.result.wrong })).toHaveLength(questions.length - 12);
    expect(screen.getByText("réponse 0")).toHaveAttribute("lang", "vi");
  });

  test("a victory's certificate downloads as a PNG and prints", async () => {
    const state = result({ score: 88, won: true, livesLeft: 3, bossHpLeft: 0 });
    const { ctxCalls } = mockCanvas();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderExam({ entry: { pathname: "/exam/result", state } });

    expect(await screen.findByRole("img", { name: fr.exam.certificate.aria("Linh", 88) })).toBeInTheDocument();
    expect(within(screen.getByRole("img", { name: /Certificat/ })).getByText("Très bien")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.exam.result.download }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(ctxCalls).toContain("Linh");
    expect(ctxCalls).toContain("88 / 100");
    await userEvent.click(screen.getByRole("button", { name: fr.exam.result.print }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("certificate on the result page", () => {
  const passed = (): ResultState => {
    const qs = buildDeck(examPoolFixture, bossFixture, 7, true);
    return {
      score: 90,
      mention: "tres_bien",
      results: qs.map(() => ({ score: 1, correct: true, skipped: false, expected: "x" })),
      questions: qs,
      noSpeaking: false,
      xpGained: 0,
      newBadges: [],
      remainingToday: 1,
      dateIso: "2026-11-09T10:00:00.000Z",
      boss: { id: "boss_thuy_tinh", name: "Thủy Tinh", title: "Le dieu des eaux", illustration: "boss_thuy_tinh", hp: 15, playerLives: 5, won: true, livesLeft: 3, bossHpLeft: 0 },
    };
  };

  test("keeps the light palette in a dark document", async () => {
    document.documentElement.classList.add("dark");
    renderExam({ entry: { pathname: "/exam/result", state: passed() } });
    expect(await screen.findByRole("img", { name: /Certificat/ })).toHaveAttribute("data-theme", "light");
  });

  test("the printable copy is a portal on body, outside the app tree, and its style goes away with it", async () => {
    const view = renderExam({ entry: { pathname: "/exam/result", state: passed() } });
    await screen.findByRole("img", { name: /Certificat/ });
    const copy = document.body.querySelector(":scope > [data-certificate-print]");
    expect(copy).not.toBeNull();
    expect(view.container.contains(copy)).toBe(false);
    expect(copy?.querySelector("style")?.textContent).toBe(PRINT_CSS);
    expect(PRINT_CSS).toContain("#root{display:none!important}");
    expect(PRINT_CSS).not.toContain("visibility");
    view.unmount();
    expect(document.body.querySelector("[data-certificate-print]")).toBeNull();
    expect(document.querySelector("style")).toBeNull();
  });

  test("no certificate is offered without a pseudo", async () => {
    useAppState.setState({ profile: null });
    renderExam({ entry: { pathname: "/exam/result", state: passed() } });
    await screen.findByRole("heading", { name: fr.exam.result.won("Thủy Tinh") });
    expect(screen.queryByRole("img", { name: /Certificat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.exam.result.download })).not.toBeInTheDocument();
  });
});

/** jsdom has no 2D canvas nor object URLs: stub them and record the drawn texts. */
function mockCanvas() {
  const ctxCalls: unknown[] = [];
  const ctx = new Proxy(
    { fillStyle: "", strokeStyle: "", lineWidth: 0, font: "", textAlign: "", textBaseline: "", globalAlpha: 1 },
    {
      get(t, prop: string) {
        if (prop in t) return (t as Record<string, unknown>)[prop];
        return (...args: unknown[]) => {
          if (prop === "fillText") ctxCalls.push(args[0]);
        };
      },
      set(t, prop: string, value: unknown) {
        (t as Record<string, unknown>)[prop] = value;
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(new Blob(["png"], { type: "image/png" })));
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:certificat"), configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  return { ctxCalls };
}
