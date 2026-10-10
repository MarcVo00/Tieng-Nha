import { StrictMode, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { useAppState } from "@/app/appState";
import { introduce } from "@/services/leitner";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { useToastStore } from "@/ui/Toast";
import { fr } from "@/i18n/fr";
import { ReviewRunScreen, ReviewScreen } from "@/features/review";

const T0 = "2026-10-01T10:00:00.000Z";
const DAY = 86_400_000;
const TEST_TIMEOUT = 30_000;

function setup(opts: { nowOffsetDays?: number; route?: string } = {}) {
  let now = Date.parse(T0) + (opts.nowOffsetDays ?? 0) * DAY;
  const services: Services = createFakeServices({ clock: () => new Date(now).toISOString() });
  const completeReview = vi.spyOn(services.activity, "completeReview");
  const ui: ReactElement = (
    <StrictMode>
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[opts.route ?? "/review"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/review" element={opts.route ? <p>écran révision</p> : <ReviewScreen />} />
            <Route path="/review/run" element={<ReviewRunScreen />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </StrictMode>
  );
  return { services, completeReview, ui, setNow: (iso: string) => (now = Date.parse(iso)) };
}

beforeEach(() => {
  useAppState.setState({ snapshot: null, dueCount: 0 });
});

/** Completes the fixture lesson at T0 (introduces its 12 words), then pushes all but `dueIds` far into the future. */
async function seedKnownWords(services: Services, dueIds: string[]) {
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: lessonFixture.vocab.map((v) => v.id) });
  for (const v of lessonFixture.vocab) {
    const p = introduce(v.id, T0);
    await services.progress.upsertVocabProgress(
      dueIds.includes(v.id) ? { ...p, dueAt: "2026-10-02T10:00:00.000Z" } : { ...p, box: 3, dueAt: "2027-01-01T10:00:00.000Z" },
    );
  }
}

test("with no known word it invites to finish a lesson", async () => {
  const { ui } = setup();
  render(ui);
  expect(await screen.findByText(fr.review.empty.none)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: fr.review.start })).not.toBeInTheDocument();
});

test("nothing due: shows the empty state with the next review day", async () => {
  const { ui, services } = setup({ nowOffsetDays: 0 });
  await services.progress.upsertVocabProgress({ ...introduce("v_ca_phe", T0), dueAt: "2026-10-04T10:00:00.000Z" });
  render(ui);
  expect(await screen.findByText(fr.review.empty.title)).toBeInTheDocument();
  expect(screen.getByText(fr.review.empty.next(3))).toBeInTheDocument();
});

test("due words: shows the count, the distribution and starts the run", async () => {
  const { ui, services } = setup({ nowOffsetDays: 2 });
  await seedKnownWords(services, ["v_ca_phe", "v_ly", "v_da"]);
  render(ui);
  expect(await screen.findByRole("heading", { name: fr.review.due(3) })).toBeInTheDocument();
  expect(screen.getByLabelText(fr.review.boxes.aria("Nouveau", 3))).toBeInTheDocument();
  expect(screen.getByLabelText(fr.review.boxes.aria("Familier", 9))).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: fr.review.start }));
  expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});

test(
  "a run of 3 due words shows 3 exercises, records each answer and completes the review exactly once",
  async () => {
    const DUE = ["v_ca_phe", "v_ly", "v_da"];
    const { ui, services, completeReview } = setup({ nowOffsetDays: 2, route: "/review/run" });
    const recordAnswer = vi.spyOn(services.activity, "recordAnswer");
    await seedKnownWords(services, DUE);
    render(ui);

    for (let i = 0; i < 3; i++) {
      await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(Math.round((i / 3) * 100))), { timeout: 4000 });
      const options = await screen.findAllByRole("button", { pressed: false }, { timeout: 4000 });
      const choice = options.find((b) => b.hasAttribute("aria-pressed"));
      if (!choice) throw new Error("no choice button");
      await userEvent.click(choice);
      await userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
      await screen.findByRole("status");
      await userEvent.click(screen.getByRole("button", { name: fr.ui.feedback.continue }));
      // Wait for the previous feedback sheet to leave before reading the next exercise.
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), { timeout: 4000 });
    }

    expect(await screen.findByText(fr.review.done.title, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/^\d\/3 justes$/)).toBeInTheDocument();
    expect(completeReview).toHaveBeenCalledTimes(1);
    expect(recordAnswer).toHaveBeenCalledTimes(3);

    for (const id of DUE) {
      const p = await services.progress.getVocabProgress(id);
      expect((p?.correct ?? 0) + (p?.wrong ?? 0)).toBe(1);
    }
    // Answered words actually moved: box and due date are updated by the answer.
    for (const id of DUE) {
      const p = await services.progress.getVocabProgress(id);
      if (!p) throw new Error(`missing progress for ${id}`);
      expect(p.dueAt).not.toBe("2026-10-02T10:00:00.000Z");
      expect(p.box).toBe(p.correct === 1 ? 2 : 1);
      expect(p.lastSeenAt).toBe(new Date(Date.parse(T0) + 2 * DAY).toISOString());
    }
    const untouched = await services.progress.getVocabProgress("v_nuoc");
    expect(untouched).toMatchObject({ correct: 0, wrong: 0, box: 3 });

    await userEvent.click(screen.getByRole("button", { name: fr.review.done.finish }));
    expect(await screen.findByText("écran révision")).toBeInTheDocument();
    expect(completeReview).toHaveBeenCalledTimes(1);
  },
  TEST_TIMEOUT,
);

async function playOneWord(ui: ReactElement) {
  render(ui);
  const options = await screen.findAllByRole("button", { pressed: false }, { timeout: 4000 });
  const choice = options.find((b) => b.hasAttribute("aria-pressed"));
  if (!choice) throw new Error("no choice button");
  await userEvent.click(choice);
  await userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
  await screen.findByRole("status");
}

test(
  "a double tap on Continuer records one answer for the word",
  async () => {
    const { ui, services, completeReview } = setup({ nowOffsetDays: 2, route: "/review/run" });
    const recordAnswer = vi.spyOn(services.activity, "recordAnswer");
    await seedKnownWords(services, ["v_ca_phe"]);
    await playOneWord(ui);
    await userEvent.dblClick(screen.getByRole("button", { name: fr.ui.feedback.continue }));
    expect(await screen.findByText(fr.review.done.title, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(recordAnswer).toHaveBeenCalledTimes(1);
    expect(completeReview).toHaveBeenCalledTimes(1);
  },
  TEST_TIMEOUT,
);

test(
  "answers that cannot be saved are retried once, then reported without blocking the review",
  async () => {
    useToastStore.setState({ toasts: [] });
    const { ui, services, completeReview } = setup({ nowOffsetDays: 2, route: "/review/run" });
    const recordAnswer = vi.spyOn(services.activity, "recordAnswer").mockRejectedValue(new Error("disk full"));
    await seedKnownWords(services, ["v_ca_phe"]);
    await playOneWord(ui);
    await userEvent.click(screen.getByRole("button", { name: fr.ui.feedback.continue }));
    expect(await screen.findByText(fr.review.done.title, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(recordAnswer).toHaveBeenCalledTimes(2);
    expect(completeReview).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual([fr.review.recordFailed]);
  },
  TEST_TIMEOUT,
);
