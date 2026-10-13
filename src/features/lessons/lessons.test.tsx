import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { createFakeServices, FakeContentReporter, FakeSpeechRecognizer, FakeSpeechSynthesizer } from "@/adapters/fakes";
import { useAppState } from "@/app/appState";
import type { Exercise } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { LessonDoneScreen, LessonScreen } from "@/features/lessons";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
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
const HOME = "page d'accueil";

function setup() {
  const stt = new FakeSpeechRecognizer();
  const tts = new FakeSpeechSynthesizer();
  const reporter = new FakeContentReporter();
  const services = createFakeServices({ stt, tts, reporter });
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
    const { stt, services, completeLesson } = setup();
    stt.queue = [["cho tui một ly trà đá"], ["ngon quá"]];
    await skipIntro();
    const last = lessonFixture.exercises.length - 1;
    // A double tap on the final Continuer must not report the last exercise twice.
    for (const [i, ex] of lessonFixture.exercises.entries()) await play(ex, true, i === last);

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
    const { stt, completeLesson } = setup();
    stt.queue = [["cho tui một ly trà đá"], ["ngon quá"]];
    await skipIntro();
    const [first, ...rest] = lessonFixture.exercises;
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
    for (const ex of lessonFixture.exercises.slice(0, 3)) await play(ex, false);

    expect(await screen.findByRole("heading", { name: fr.lessons.failed.title })).toBeInTheDocument();
    expect(screen.getByText(fr.lessons.failed.body)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: fr.ui.hearts(0, 3) })).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: fr.lessons.failed.retry });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(await services.progress.getVocabProgress("v_ly")).toBeDefined();
    expect(completeLesson).not.toHaveBeenCalled();

    await userEvent.click(retry);
    expect(await screen.findByText(fr.exercises.listenChoose.prompt)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: fr.ui.hearts(3, 3) })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  },
  TEST_TIMEOUT,
);

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
