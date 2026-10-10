import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices, FakeSpeechRecognizer } from "@/adapters/fakes";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import type { ExamQuestion, ProgressSnapshot, Settings } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { fr } from "@/i18n/fr";
import { drawExam } from "@/services/exam";
import { seedFromString } from "@/services/random";
import { ExamIntroScreen, ExamResultScreen, ExamRunScreen } from "@/features/exam";
import { EXAM_TOTAL, markAttempt, type ResultState, type RunState } from "@/features/exam/examState";
import { PRINT_CSS } from "@/ui/Certificate";

const TEST_TIMEOUT = 90_000;
const ATTEMPT: RunState = { attemptId: "attempt-fixed", remainingToday: 2 };

const snapshotWith = (lessons: number, examBest: number | null = null): ProgressSnapshot => ({
  xpTotal: 120,
  xpWeek: 40,
  xpToday: 10,
  streak: 3,
  lessonsDone: Array.from({ length: lessons }, (_, i) => `l${String(i + 1).padStart(2, "0")}`),
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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("intro", () => {
  test("is locked below 10 lessons and shows the progress", async () => {
    useAppState.setState({ snapshot: snapshotWith(1) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.locked.title })).toBeInTheDocument();
    expect(screen.getByText("1 / 10 leçons terminées")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    expect(screen.queryByRole("button", { name: fr.exam.intro.start })).not.toBeInTheDocument();
  });

  test("lists the rules and the best score once unlocked", async () => {
    useAppState.setState({ snapshot: snapshotWith(10, 84) });
    renderExam({ entry: "/exam" });
    expect(await screen.findByText("Meilleur score : 84 / 100")).toBeInTheDocument();
    expect(screen.getByText(fr.exam.intro.rules[0])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.exam.intro.start })).toBeEnabled();
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
    expect(await screen.findByRole("button", { name: /Partie 1/ })).toBeInTheDocument();
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
    expect(await screen.findByRole("button", { name: /Partie 1/ })).toBeInTheDocument();
    first.unmount();
    renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Essai interrompu — il est compté.");
  });

  test("a run page without a started attempt goes back to the intro", async () => {
    renderExam({ entry: { pathname: "/exam/run", state: ATTEMPT } });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.title })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("redirects to the intro without an attempt", async () => {
    renderExam({ entry: "/exam/run" });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.title })).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: fr.exam.intro.title })).toBeInTheDocument();
  });

  async function answerAll(questions: ExamQuestion[], stt: FakeSpeechRecognizer) {
    let previous: string | null = null;
    // The previous question slides out before the next one mounts: wait for its last button to leave.
    const last: { el: HTMLElement | null } = { el: null };
    const press = async (el: HTMLElement) => {
      last.el = el;
      await userEvent.click(el);
    };
    for (const [i, q] of questions.entries()) {
      if (q.section !== previous) {
        await userEvent.click(await screen.findByRole("button", { name: /Partie \d/ }));
        previous = q.section;
      }
      const ex = q.exercise;
      const leaving = last.el;
      if (leaving) await waitFor(() => expect(leaving.isConnected).toBe(false));
      await screen.findByText(fr.exam.run.counter(i + 1, EXAM_TOTAL));
      const verify = () => press(screen.getByRole("button", { name: fr.exercises.verify }));
      switch (ex.type) {
        case "listen_choose": {
          const right = ex.vocabId === "v_ca_phe_sua_da" ? /café au lait glacé/ : /thé glacé/;
          await userEvent.click(await screen.findByRole("button", { name: right }));
          await verify();
          break;
        }
        case "tone_pick":
          await userEvent.click(await screen.findByRole("button", { name: fr.ui.tones[ex.answerTone] }));
          await verify();
          break;
        case "translate_choose":
          await userEvent.click(await screen.findByRole("button", { name: ex.answerVi }));
          await verify();
          break;
        case "word_order": {
          const bank = within(await screen.findByRole("group", { name: fr.exercises.wordOrder.bank }));
          for (const token of ex.tokensVi) await userEvent.click(bank.getByRole("button", { name: token }));
          await verify();
          break;
        }
        case "speak":
          stt.queue = [[ex.vi.replace(/[.!?]/g, "").toLowerCase()]];
          await press(await screen.findByRole("button", { name: /parler/i }));
          break;
      }
    }
  }

  function setupRun(stt: boolean) {
    useAppState.setState({ settings: withCapabilities(stt) });
    markAttempt("pending", ATTEMPT.attemptId);
    const recognizer = new FakeSpeechRecognizer();
    const services = createFakeServices({ stt: recognizer });
    const finishExam = vi.spyOn(services.activity, "finishExam");
    const submit = vi.spyOn(services.exam, "submitAttempt");
    const questions = drawExam(examPoolFixture, seedFromString(ATTEMPT.attemptId), stt);
    renderExam({ services, entry: { pathname: "/exam/run", state: ATTEMPT } });
    return { services, recognizer, finishExam, submit, questions };
  }

  test(
    "30 right answers give 100, one saved finish, and the certificate",
    async () => {
      const { services, recognizer, finishExam, submit, questions } = setupRun(true);
      expect(questions).toHaveLength(EXAM_TOTAL);
      expect(questions.filter((q) => q.section === "speaking")).toHaveLength(6);
      await answerAll(questions, recognizer);

      expect(await screen.findByText(fr.exam.result.scoreLabel(100), {}, { timeout: 8000 })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: fr.exam.certificate.aria("Linh", 100) })).toBeInTheDocument();
      expect(within(screen.getByRole("img", { name: /Certificat/ })).getByText("100 / 100")).toBeInTheDocument();
      expect(screen.queryByText(fr.exam.certificate.noSpeaking)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: fr.exam.result.download })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: fr.exam.result.print })).toBeInTheDocument();

      expect(finishExam).toHaveBeenCalledTimes(1);
      expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 100, noSpeaking: false });
      expect(submit).toHaveBeenCalledWith(ATTEMPT.attemptId, 100);
      const events = await services.progress.listEvents();
      const finished = events.filter((e) => e.type === "exam_finished");
      expect(finished).toHaveLength(1);
      expect(finished[0]?.payload).toEqual({ score: 100, attemptId: ATTEMPT.attemptId, noSpeaking: false });
      expect(useAppState.getState().snapshot?.examBest).toBe(100);
    },
    TEST_TIMEOUT,
  );

  test(
    "without speech recognition no speaking question is drawn and the certificate says so",
    async () => {
      const { recognizer, finishExam, questions } = setupRun(false);
      expect(questions).toHaveLength(EXAM_TOTAL);
      expect(questions.some((q) => q.section === "speaking")).toBe(false);
      await answerAll(questions, recognizer);

      expect(await screen.findByText(fr.exam.result.scoreLabel(100), {}, { timeout: 8000 })).toBeInTheDocument();
      expect(screen.queryByText(fr.exercises.speak.prompt)).not.toBeInTheDocument();
      expect(within(screen.getByRole("img", { name: /Certificat/ })).getByText(fr.exam.certificate.noSpeaking)).toBeInTheDocument();
      expect(finishExam).toHaveBeenCalledTimes(1);
      expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 100, noSpeaking: true });
    },
    TEST_TIMEOUT,
  );
});

describe("result", () => {
  const questions = drawExam(examPoolFixture, 7, true);
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
  });

  test("redirects to the intro without a result", async () => {
    renderExam({ entry: "/exam/result" });
    expect(await screen.findByRole("heading", { name: fr.exam.intro.title })).toBeInTheDocument();
  });

  test("below 70: no certificate, retry shows the remaining attempts, review goes to /review", async () => {
    renderExam({ entry: { pathname: "/exam/result", state: failedState(2) } });
    expect(await screen.findByText(fr.exam.result.scoreLabel(40))).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presque !" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Certificat/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer (2 essais restants aujourd'hui)" })).toBeEnabled();
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);

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
    expect(screen.getAllByRole("img", { name: fr.exam.result.wrong })).toHaveLength(18);
    expect(screen.getByText("réponse 0")).toHaveAttribute("lang", "vi");
  });

  test("above 70 the certificate downloads as a PNG and prints", async () => {
    const state: ResultState = { ...failedState(2), score: 88, mention: "tres_bien" };
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
    const qs = drawExam(examPoolFixture, 7, true);
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
    await screen.findByText(fr.exam.result.scoreLabel(90));
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
