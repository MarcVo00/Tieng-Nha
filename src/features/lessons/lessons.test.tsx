import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { createFakeServices, FakeContentReporter, FakeSpeechRecognizer, FakeSpeechSynthesizer } from "@/adapters/fakes";
import { useAppState } from "@/app/appState";
import type { Exercise } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { LessonDoneScreen, LessonScreen } from "@/features/lessons";
import { orderExercises } from "@/features/lessons/useLessonRun";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StrictMode, type ReactElement } from "react";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";

// Same as renderWithServices, with the router future flags set so the output stays free of warnings.
function renderWithServices(ui: ReactElement, opts: { services?: Services; route: string }) {
  const services = opts.services ?? createFakeServices();
  const view = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[opts.route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { ...view, services };
}

const TEST_TIMEOUT = 30_000;
const NOW = "2026-10-14T08:00:00.000Z";
// The lesson shuffles its exercises from the clock: with a fixed clock, this is the order the screen shows.
const ORDER = orderExercises(lessonFixture, NOW);
let currentStt: FakeSpeechRecognizer | null = null;
const HOME = "page d'accueil";

function setup() {
  const stt = new FakeSpeechRecognizer();
  const tts = new FakeSpeechSynthesizer();
  const reporter = new FakeContentReporter();
  currentStt = stt;
  const services = createFakeServices({ stt, tts, reporter, clock: () => NOW });
  const completeLesson = vi.spyOn(services.activity, "completeLesson");
  const view = renderWithServices(
    <Routes>
      <Route path="/" element={<p>{HOME}</p>} />
      <Route path="/lesson/:id" element={<LessonScreen />} />
      <Route path="/lesson/:id/done" element={<LessonDoneScreen />} />
      <Route path="/dialogue/:id" element={<p>page du dialogue</p>} />
    </Routes>,
    { services, route: "/lesson/l05" },
  );
  return { ...view, services, stt, tts, reporter, completeLesson };
}

beforeEach(() => {
  useAppState.setState({ snapshot: null });
});

const PROMPT: Record<Exercise["type"], string> = {
  listen_choose: fr.exercises.listenChoose.prompt,
  tone_pick: fr.exercises.tonePick.prompt,
  translate_choose: fr.exercises.translateChoose.prompt,
  word_order: fr.exercises.wordOrder.prompt,
  speak: fr.exercises.speak.prompt,
};
// Visible (French) labels of the listen_choose options used by the fixture lesson.
const LISTEN_RIGHT: Record<string, RegExp> = { v_ca_phe_sua_da: /café au lait glacé/, v_tra_da: /thé glacé/ };
const LISTEN_WRONG: Record<string, RegExp> = { v_ca_phe_sua_da: /thé glacé/, v_tra_da: /eau/ };

async function skipIntro() {
  for (let i = 0; i < lessonFixture.vocab.length - 1; i++) {
    await userEvent.click(await screen.findByRole("button", { name: fr.lessons.deck.next }));
  }
  await userEvent.click(await screen.findByRole("button", { name: fr.lessons.deck.start }));
}

async function pressContinue(double = false) {
  await screen.findByRole("status");
  const button = screen.getByRole("button", { name: fr.ui.feedback.continue });
  if (double) await userEvent.dblClick(button);
  else await userEvent.click(button);
}

/** Plays one exercise of the fixture lesson, right or wrong, and taps Continuer. */
async function play(ex: Exercise, correct: boolean, doubleContinue = false) {
  // Two exercises of the same type can follow each other: wait until this one has replaced the previous one.
  await waitFor(() => expect(document.querySelectorAll("[data-exercise-id]")).toHaveLength(1), { timeout: 4000 });
  await waitFor(() => expect(document.querySelector(`[data-exercise-id="${ex.id}"]`)).not.toBeNull(), { timeout: 4000 });
  await screen.findByText(PROMPT[ex.type], {}, { timeout: 4000 });
  const verify = () => userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
  switch (ex.type) {
    case "listen_choose": {
      const label = (correct ? LISTEN_RIGHT : LISTEN_WRONG)[ex.vocabId];
      if (!label) throw new Error(`no label for ${ex.vocabId}`);
      await userEvent.click(screen.getByRole("button", { name: label }));
      await verify();
      break;
    }
    case "tone_pick":
      await userEvent.click(screen.getByRole("button", { name: correct ? fr.ui.tones[ex.answerTone] : fr.ui.tones.ngang }));
      await verify();
      break;
    case "translate_choose":
      await userEvent.click(screen.getByRole("button", { name: correct ? ex.answerVi : (ex.distractorsVi[0] ?? "") }));
      await verify();
      break;
    case "word_order": {
      const bank = within(screen.getByRole("group", { name: fr.exercises.wordOrder.bank }));
      for (const token of ex.tokensVi) await userEvent.click(bank.getByRole("button", { name: token }));
      await verify();
      break;
    }
    case "speak":
      if (correct && currentStt) currentStt.queue = [[ex.vi]];
      await userEvent.click(screen.getByRole("button", { name: /parler/i }));
      break;
  }
  await pressContinue(doubleContinue);
}

test("intro deck: shows the first word, plays it, advances and reports a card", async () => {
  const { tts, reporter } = setup();
  const first = lessonFixture.vocab[0]!;
  const second = lessonFixture.vocab[1]!;
  expect(await screen.findByText(first.vi, { selector: "p" })).toHaveAttribute("lang", "vi");
  await waitFor(() => expect(tts.spoken).toContain(first.vi));
  expect(screen.getByText("Mot 1 sur 12")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: fr.lessons.deck.next }));
  expect(await screen.findByText("Mot 2 sur 12")).toBeInTheDocument();
  await waitFor(() => expect(tts.spoken).toContain(second.vi));

  await userEvent.click(screen.getAllByRole("button", { name: fr.ui.report.aria })[0]!);
  await userEvent.type(await screen.findByRole("textbox", { name: fr.report.field }), "Le ton est faux");
  await userEvent.click(screen.getByRole("button", { name: fr.report.send }));
  await waitFor(() => expect(reporter.reports).toEqual([{ refId: second.id, message: "Le ton est faux", contentVersion: 1 }]));
});

test("a deprecated word is neither shown in the deck nor added to the reviews", async () => {
  const [retired, ...live] = lessonFixture.vocab;
  const services = createFakeServices();
  vi.spyOn(services.content, "getLesson").mockResolvedValue({ ...lessonFixture, vocab: [{ ...retired!, deprecated: true }, ...live] });
  const introduce = vi.spyOn(services.activity, "introduceVocab");
  renderWithServices(
    <Routes>
      <Route path="/lesson/:id" element={<LessonScreen />} />
    </Routes>,
    { services, route: "/lesson/l05" },
  );
  expect(await screen.findByText(live[0]!.vi)).toBeInTheDocument();
  expect(screen.queryByText(retired!.vi)).not.toBeInTheDocument();
  for (let i = 0; i < live.length - 1; i++) await userEvent.click(await screen.findByRole("button", { name: fr.lessons.deck.next }));
  expect(screen.getByRole("button", { name: fr.lessons.deck.start })).toBeInTheDocument();
  expect(introduce).not.toHaveBeenCalledWith(expect.arrayContaining([retired!.id]));
});

test("the last card starts the exercises", async () => {
  setup();
  await skipIntro();
  expect(await screen.findByText(fr.exercises.listenChoose.prompt)).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByRole("img", { name: fr.ui.hearts(3, 3) })).toBeInTheDocument();
});

test(
  "answering every exercise correctly lands on the done screen with +15 XP, saved exactly once",
  async () => {
    const { services, completeLesson } = setup();
    await skipIntro();
    const last = ORDER.length - 1;
    // A double tap on the final Continuer must not report the last exercise twice.
    for (const [i, ex] of ORDER.entries()) await play(ex, true, i === last);

    expect(await screen.findByRole("heading", { name: "Giỏi quá!" })).toBeInTheDocument();
    expect(await screen.findByText("+15")).toBeInTheDocument();
    expect(screen.getByText("100 % de réussite")).toBeInTheDocument();
    expect(await screen.findByText("Premier pas")).toBeInTheDocument(); // new badge medal
    expect(completeLesson).toHaveBeenCalledTimes(1);
    expect(completeLesson).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "l05", mistakes: 0 }));
    expect((await services.activity.getSnapshot()).lessonsDone).toEqual(["l05"]);
    expect(useAppState.getState().snapshot?.xpTotal).toBeGreaterThanOrEqual(15);

    // The dialogue is the primary next step.
    await userEvent.click(await screen.findByRole("button", { name: "Dialogue : Commander au café" }));
    expect(await screen.findByText("page du dialogue")).toBeInTheDocument();
  },
  TEST_TIMEOUT,
);

test(
  "a wrong answer is presented again at the end and costs the perfect bonus",
  async () => {
    const { completeLesson } = setup();
    await skipIntro();
    const [first, ...rest] = ORDER;
    await play(first!, false);
    for (const ex of rest) await play(ex, true);
    await play(first!, true);

    expect(await screen.findByRole("heading", { name: fr.lessons.done.good })).toBeInTheDocument();
    expect(completeLesson).toHaveBeenCalledTimes(1);
    expect(completeLesson).toHaveBeenCalledWith(expect.objectContaining({ mistakes: 1 }));
    expect(await screen.findByText("+10")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.lessons.done.continue }));
    expect(await screen.findByText(HOME)).toBeInTheDocument();
  },
  TEST_TIMEOUT,
);

test(
  "three mistakes show the failed panel, add the words to reviews, and Réessayer restarts without the intro",
  async () => {
    const { services, completeLesson } = setup();
    await skipIntro();
    for (const ex of ORDER.slice(0, 3)) await play(ex, false);

    expect(await screen.findByRole("heading", { name: fr.lessons.failed.title })).toBeInTheDocument();
    expect(screen.getByText(fr.lessons.failed.body)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: fr.ui.hearts(0, 3) })).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: fr.lessons.failed.retry });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(await services.progress.getVocabProgress("v_ly")).toBeDefined();
    expect(completeLesson).not.toHaveBeenCalled();

    expect((await services.activity.getEnergy()).current).toBe(4);
    await userEvent.click(retry);
    expect(await screen.findByText(fr.exercises.listenChoose.prompt)).toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(3);
    expect(screen.getByRole("img", { name: fr.ui.hearts(3, 3) })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  },
  TEST_TIMEOUT,
);

describe("energy", () => {
  test("opening the lesson spends exactly 1 energy, even under StrictMode", async () => {
    const services = createFakeServices({ clock: () => NOW });
    renderWithServices(
      <StrictMode>
        <Routes>
          <Route path="/lesson/:id" element={<LessonScreen />} />
        </Routes>
      </StrictMode>,
      { services, route: "/lesson/l05" },
    );
    await screen.findByRole("button", { name: fr.lessons.deck.next });
    expect((await services.activity.getEnergy()).current).toBe(4);
  });

  test("a lesson that fails to load spends nothing", async () => {
    const services = createFakeServices({ clock: () => NOW });
    vi.spyOn(services.content, "getLesson").mockRejectedValueOnce(new Error("offline"));
    renderWithServices(
      <Routes>
        <Route path="/lesson/:id" element={<LessonScreen />} />
      </Routes>,
      { services, route: "/lesson/l05" },
    );
    expect(await screen.findByText(fr.lessons.loadError.title)).toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(5);
  });

  test("with no energy left the lesson does not open and offers the reviews", async () => {
    const services = createFakeServices({ clock: () => NOW });
    useAppState.setState({ dueCount: 3 });
    for (let i = 0; i < 5; i++) await services.activity.startSession("lesson", "l05");
    renderWithServices(
      <Routes>
        <Route path="/" element={<p>{HOME}</p>} />
        <Route path="/review" element={<p>page de révision</p>} />
        <Route path="/lesson/:id" element={<LessonScreen />} />
      </Routes>,
      { services, route: "/lesson/l05" },
    );
    expect(await screen.findByText(fr.energy.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.lessons.deck.next })).not.toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: fr.energy.review }));
    expect(await screen.findByText("page de révision")).toBeInTheDocument();
  });

  test("with no energy and nothing due there is no review button and Retour goes home", async () => {
    const services = createFakeServices({ clock: () => NOW });
    useAppState.setState({ dueCount: 0 });
    for (let i = 0; i < 5; i++) await services.activity.startSession("lesson", "l05");
    renderWithServices(
      <Routes>
        <Route path="/" element={<p>{HOME}</p>} />
        <Route path="/lesson/:id" element={<LessonScreen />} />
      </Routes>,
      { services, route: "/lesson/l05" },
    );
    expect(await screen.findByText(fr.energy.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.energy.review })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: fr.energy.empty.back }));
    expect(await screen.findByText(HOME)).toBeInTheDocument();
  });
});

test("quitting asks for confirmation first", async () => {
  setup();
  await userEvent.click(await screen.findByRole("button", { name: fr.lessons.quit.aria }));
  const dialog = await screen.findByRole("alertdialog", { name: fr.lessons.quit.title });
  expect(within(dialog).getByText(fr.lessons.quit.body)).toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole("button", { name: fr.lessons.quit.cancel }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.queryByText(HOME)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: fr.lessons.quit.aria }));
  await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: fr.lessons.quit.confirm }));
  expect(await screen.findByText(HOME)).toBeInTheDocument();
});

test("an unknown lesson shows a designed error with a way back", async () => {
  renderWithServices(
    <Routes>
      <Route path="/lesson/:id" element={<LessonScreen />} />
    </Routes>,
    { route: "/lesson/l99" },
  );
  expect(await screen.findByText(fr.lessons.loadError.title)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: fr.app.error.retry })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: fr.app.error.home })).toBeInTheDocument();
});

test("the done screen without a result redirects home", async () => {
  renderWithServices(
    <Routes>
      <Route path="/" element={<p>{HOME}</p>} />
      <Route path="/lesson/:id/done" element={<LessonDoneScreen />} />
    </Routes>,
    { route: "/lesson/l05/done" },
  );
  expect(await screen.findByText(HOME)).toBeInTheDocument();
});

test("each start of a lesson draws a new exercise order, still grouped by type", () => {
  // "listen,tone,…": the types in order of appearance, each block counted once.
  const blocks = (list: readonly Exercise[]) => list.map((e) => e.type).filter((t, i, all) => t !== all[i - 1]).join(",");
  const typesInOrder = [...new Set(lessonFixture.exercises.map((e) => e.type))].join(",");
  const orders = new Set<string>();
  for (let minute = 0; minute < 20; minute++) {
    const order = orderExercises(lessonFixture, `2026-10-14T08:${String(minute).padStart(2, "0")}:00.000Z`);
    expect(blocks(order)).toBe(typesInOrder); // one contiguous block per type, in the content's type order
    orders.add(order.map((e) => e.id).join(","));
  }
  expect(orders.size).toBeGreaterThan(1);
});

describe("coins on the done screen", () => {
  async function show(coinsGained: number | "real") {
    const services = createFakeServices({ clock: () => NOW });
    const r = await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
    const gained = coinsGained === "real" ? r.coinsGained : coinsGained;
    const state = { ...r, coinsGained: gained, accuracy: 1, perfect: true };
    const view = render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[{ pathname: "/lesson/l05/done", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/lesson/:id/done" element={<LessonDoneScreen />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );
    await screen.findByRole("heading", { name: fr.lessons.done.perfect });
    return { view, gained };
  }

  test("shows the coins earned, including a perfect bonus", async () => {
    const { gained } = await show("real");
    expect(gained).toBeGreaterThanOrEqual(15);
    expect(screen.getByText(fr.shop.gained(gained))).toBeInTheDocument();
  });

  test("shows no coin line when nothing was earned", async () => {
    await show(0);
    expect(screen.queryByText(/ xu$/)).toBeNull();
  });
});

test("the done screen shows the reward of a newly unlocked badge", async () => {
  const services = createFakeServices({ clock: () => NOW });
  const r = await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
  const badge = { id: "streak_7", title: "Une semaine", description: "7 jours d'affilée.", icon: "🏮", rule: { kind: "streak", gte: 7 }, reward: "frame_bronze" } as const;
  const state = { ...r, newBadges: [badge], accuracy: 1, perfect: true };
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[{ pathname: "/lesson/l05/done", state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/lesson/:id/done" element={<LessonDoneScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  expect(await screen.findByText(fr.rewards.gained("cadre", "Bronze"))).toBeInTheDocument();
});
