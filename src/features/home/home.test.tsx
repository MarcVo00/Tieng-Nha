import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import { createFakeServices } from "@/adapters/fakes";
import { ToastViewport } from "@/ui";
import { HomeScreen } from "@/features/home";
import "@/test/routerTestEnv";
import { BONUS_SHOWN_KEY } from "@/domain/storageKeys";
import { parisDay } from "@/services/time";
import type { FakeSoundPlayer } from "@/adapters/fakes/FakeSoundPlayer";

function renderHome(services = createFakeServices()) {
  render(
    <ServicesProvider services={services}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomeScreen />
        <ToastViewport />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return services;
}

const NOW = "2026-10-29T08:00:00.000Z";

beforeEach(() => {
  useAppState.setState({ snapshot: null, dueCount: 0, wallet: null });
  // The daily-bonus sheet already opened today: the path tests see the home alone.
  localStorage.setItem(BONUS_SHOWN_KEY, parisDay(new Date().toISOString()));
});

test("shows the first lesson as available with a start chip, and a locked exam", async () => {
  renderHome();
  const stop = await screen.findByRole("link", { name: /Au café.*disponible/ });
  expect(stop).toHaveAttribute("href", "/lesson/l05");
  expect(screen.getByText("Commencer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Thủy Tinh.*verrouillé/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Dialogue/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Révision du jour/)).not.toBeInTheDocument();
});

test("a completed lesson turns done and reveals its dialogue stop", async () => {
  const services = createFakeServices();
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1000, vocabIds: [] });
  renderHome(services);
  const stop = await screen.findByRole("link", { name: /Au café.*terminée sans faute/ });
  expect(stop).toHaveAttribute("href", "/lesson/l05");
  expect(screen.getByRole("link", { name: "Dialogue\u202f: Au café" })).toHaveAttribute("href", "/dialogue/d05");
  // The only lesson of the fakes tree is done, so the boss stop is unlocked and takes over the start chip.
  expect(screen.queryByRole("button", { name: /Thủy Tinh.*verrouillé/ })).not.toBeInTheDocument();
  expect(screen.getAllByText("Commencer")).toHaveLength(1);
});

test("review card appears when words are due", async () => {
  const services = createFakeServices();
  await services.progress.upsertVocabProgress({ vocabId: "v_ly", box: 1, dueAt: "2020-01-01T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: "2020-01-01T00:00:00.000Z" });
  renderHome(services);
  const card = await screen.findByRole("link", { name: /Révision du jour/ });
  expect(card).toHaveAttribute("href", "/review");
  expect(card).toHaveTextContent("1 mot");
});

test("tapping the locked exam shows a toast", async () => {
  renderHome();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Thủy Tinh/ }));
  expect(await screen.findByRole("status")).toHaveTextContent("Termine d'abord les leçons pour affronter Thủy Tinh");
});

test("the hero waits beside the path before the first lesson, then stands on the last lesson completed", async () => {
  renderHome();
  expect(await screen.findByRole("img", { name: "Toi, au départ du parcours" })).toBeInTheDocument();

  const services = createFakeServices();
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1000, vocabIds: [] });
  renderHome(services);
  expect(await screen.findByRole("img", { name: "Toi, après la leçon «\u202fAu café\u202f»" })).toBeInTheDocument();
});

test("the path token wears the equipped hero, and the default hero before the wallet loads", async () => {
  const services = createFakeServices();
  renderHome(services);
  const token = await screen.findByRole("img", { name: "Toi, au départ du parcours" });
  expect(token.querySelector("[data-look]")).toHaveAttribute("data-look", "");
  useAppState.setState({ wallet: { ...(await services.activity.getWallet()), equipped: { hat: "hat_thuy_tinh" } } });
  await waitFor(() => expect(token.querySelector('[data-look~="hat_thuy_tinh"]')).not.toBeNull());
});

test("a perfect lesson shows three gold stars", async () => {
  const services = createFakeServices();
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1000, vocabIds: [] });
  const { container } = render(
    <ServicesProvider services={services}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomeScreen />
      </MemoryRouter>
    </ServicesProvider>,
  );
  await screen.findByRole("link", { name: /Au café.*terminée sans faute/ });
  expect(container.querySelector("[data-stars]")).toHaveAttribute("data-stars", "3");
});

describe("daily bonus", () => {
  beforeEach(() => localStorage.removeItem(BONUS_SHOWN_KEY));

  test("opens by itself once a day, pays the day's xu with a clink, then leaves the home alone", async () => {
    const user = userEvent.setup();
    const services = renderHome(createFakeServices({ clock: () => NOW }));
    const sheet = await screen.findByRole("dialog", { name: "Lì xì du jour" });
    expect(sheet).toHaveTextContent(/Jour 1 sur 7 · \+10\sxu/);
    expect(screen.getByRole("list", { name: "Ta suite de 7 jours" }).children).toHaveLength(7);
    expect(screen.getByRole("listitem", { name: "Jour 1, 10\u00A0xu, aujourd'hui" })).toBeInTheDocument();
    expect(localStorage.getItem(BONUS_SHOWN_KEY)).toBe("2026-10-29");

    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(await screen.findByText("+10\u00A0xu")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Jour 1, 10\u00A0xu, ouvert" })).toBeInTheDocument();
    expect((services.sound as FakeSoundPlayer).played.map((p) => p.cue)).toEqual(["arena.coins"]);
    expect((await services.activity.getWallet()).coins).toBe(10);
    await waitFor(() => expect(useAppState.getState().wallet?.coins).toBe(10));

    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /du jour t'attend/ })).not.toBeInTheDocument();
  });

  test("closed without opening, the card stays and reopens the sheet; it does not open by itself again today", async () => {
    const user = userEvent.setup();
    localStorage.setItem(BONUS_SHOWN_KEY, "2026-10-29");
    const services = renderHome(createFakeServices({ clock: () => NOW }));
    const card = await screen.findByRole("button", { name: /Ton lì xì du jour t'attend/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveTextContent(/Jour 1 sur 7 · \+10\sxu/);
    await user.click(card);
    expect(await screen.findByRole("dialog", { name: "Lì xì du jour" })).toBeInTheDocument();
    expect((await services.activity.getWallet()).coins).toBe(0);
  });

  test("no card once today's envelope is open", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await services.activity.claimDailyBonus();
    renderHome(services);
    await screen.findByRole("link", { name: /Au café/ });
    expect(screen.queryByRole("button", { name: /du jour t'attend/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
