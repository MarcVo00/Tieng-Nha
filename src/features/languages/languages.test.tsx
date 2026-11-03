import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
import { appRoutes } from "@/app/router";
import { useAppState } from "@/app/appState";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { BONUS_SHOWN_KEY } from "@/domain/storageKeys";
import type { LanguageId } from "@/domain/languages";
import { parisDay } from "@/services/time";
import "@/test/routerTestEnv";

// Screens are lazy chunks: the first find waits longer than the default second on a loaded machine.
const LAZY = { timeout: 5000 };

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}));

async function onboarded(language: LanguageId | null) {
  const services = createFakeServices();
  await services.auth.verifyOtp("a@b.c", "123456");
  await services.auth.joinGroup("TEST-CODE", "Marc", "🐉");
  await services.progress.saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, language });
  return services;
}

function renderAt(path: string, services: ReturnType<typeof createFakeServices>) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return router;
}

beforeEach(() => {
  useAppState.setState({ ready: false, session: null, profile: null, snapshot: null, settings: { ...DEFAULT_SETTINGS } });
  // The daily-bonus sheet already opened today: the home shows its path alone.
  localStorage.setItem(BONUS_SHOWN_KEY, parisDay(new Date().toISOString()));
});

test("an onboarded player without a language is sent to the picker, Vietnamese preselected but not saved", async () => {
  const services = await onboarded(null);
  const router = renderAt("/", services);
  await waitFor(() => expect(router.state.location.pathname).toBe("/languages"), LAZY);
  expect(await screen.findByRole("heading", { name: "Quelle langue veux-tu apprendre\u202f?" }, LAZY)).toBeInTheDocument();
  const vi = screen.getByRole("button", { name: /Vietnamien/ });
  const tl = screen.getByRole("button", { name: /Tagalog/ });
  expect(vi).toHaveAttribute("aria-current", "true");
  expect(tl).not.toHaveAttribute("aria-current");
  expect(within(vi).getByText("Tiếng Việt")).toHaveAttribute("lang", "vi");
  expect(within(tl).getByText("Wikang Tagalog")).toHaveAttribute("lang", "tl");
  expect(tl).toHaveTextContent("Pour voyager aux Philippines");
  expect((await services.progress.getSettings()).language).toBeNull();
});

test("choosing Tagalog saves it and lands on the Tagalog path", async () => {
  const services = await onboarded(null);
  const router = renderAt("/", services);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Tagalog/ }, LAZY));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"), LAZY);
  expect(await screen.findByRole("link", { name: /Salamat at kumusta/ }, LAZY)).toBeInTheDocument();
  expect((await services.progress.getSettings()).language).toBe("tl");
  // Replace: going back does not return to the picker.
  expect(router.state.historyAction).toBe("REPLACE");
});

test("the home switcher shows the language, and switching back finds the Vietnamese path as it was", async () => {
  const services = await onboarded("tl");
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1000, vocabIds: [] });
  renderAt("/", services);
  const user = userEvent.setup();
  const switcher = await screen.findByRole("button", { name: "Langue\u202f: Tagalog" }, LAZY);
  await screen.findByRole("link", { name: /Salamat at kumusta/ });
  await user.click(switcher);
  const sheet = await screen.findByRole("dialog", { name: "Changer de langue" });
  expect(within(sheet).getByRole("button", { name: /Tagalog/ })).toHaveAttribute("aria-current", "true");
  await user.click(within(sheet).getByRole("button", { name: /Vietnamien/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByRole("link", { name: /Au café.*terminée sans faute/ }, LAZY)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Langue\u202f: Vietnamien" })).toBeInTheDocument();
  expect((await services.progress.getSettings()).language).toBe("vi");
});

test("a player with Vietnamese saved goes straight to the home", async () => {
  const services = await onboarded("vi");
  const router = renderAt("/", services);
  expect(await screen.findByRole("link", { name: /Au café/ }, LAZY)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});
