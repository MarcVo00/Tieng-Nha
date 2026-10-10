import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import { createFakeServices } from "@/adapters/fakes";
import { ToastViewport } from "@/ui";
import { HomeScreen } from "@/features/home";
import "@/test/routerTestEnv";

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

beforeEach(() => {
  useAppState.setState({ snapshot: null, dueCount: 0 });
});

test("shows the first lesson as available with a start chip, and a locked exam", async () => {
  renderHome();
  const stop = await screen.findByRole("link", { name: /Au café.*disponible/ });
  expect(stop).toHaveAttribute("href", "/lesson/l05");
  expect(screen.getByText("Commencer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Bài kiểm tra.*verrouillé/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Dialogue/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Révision du jour/)).not.toBeInTheDocument();
});

test("a completed lesson turns done and reveals its dialogue stop", async () => {
  const services = createFakeServices();
  await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1000, vocabIds: [] });
  renderHome(services);
  const stop = await screen.findByRole("link", { name: /Au café.*terminée sans faute/ });
  expect(stop).toHaveAttribute("href", "/lesson/l05");
  expect(screen.getByRole("link", { name: "Dialogue : Au café" })).toHaveAttribute("href", "/dialogue/d05");
  expect(screen.queryByText("Commencer")).not.toBeInTheDocument();
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
  await user.click(await screen.findByRole("button", { name: /Bài kiểm tra/ }));
  expect(await screen.findByRole("status")).toHaveTextContent("Termine d'abord les 10 leçons");
});
