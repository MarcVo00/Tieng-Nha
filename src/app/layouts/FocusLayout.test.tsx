import { act, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import type { Services } from "@/app/services";
import { useAppState } from "@/app/appState";
import { FocusLayout } from "@/app/layouts/FocusLayout";
import { ServicesProvider } from "@/app/ServicesProvider";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { ExamResultScreen, ExamRunScreen } from "@/features/exam";
import { LessonDoneScreen } from "@/features/lessons";
import { markAttempt, type ResultState } from "@/features/exam/examState";
import "@/test/routerTestEnv";

const RESULT = {
  score: 40,
  mention: "none",
  results: [],
  questions: [],
  noSpeaking: false,
  xpGained: 0,
  newBadges: [],
  remainingToday: 1,
  dateIso: "2026-10-20",
  boss: { id: "b", name: "Thủy Tinh", title: "t", illustration: "x", hp: 15, playerLives: 5, won: false, livesLeft: 0, bossHpLeft: 3 },
} as unknown as ResultState;

afterEach(() => sessionStorage.clear());

function renderFocus(routes: { path: string; element: JSX.Element }[], entry: { pathname: string; state: unknown }, services: Services = createFakeServices()) {
  const router = createMemoryRouter([{ element: <FocusLayout />, children: routes }], { initialEntries: [entry] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return router;
}

// A leaving screen stays mounted for its exit animation while useLocation() already returns the next location:
// screens that validate their router state on entry must not redirect while leaving (see useEntryState).
test("the run screen exiting inside FocusLayout does not bounce the app back to /exam", async () => {
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS, capabilities: { tts: true, stt: false, recorder: false } } });
  markAttempt("pending", "att-1");
  const router = renderFocus(
    [
      { path: "/exam", element: <p>intro</p> },
      { path: "/exam/run", element: <ExamRunScreen /> },
      { path: "/exam/result", element: <p>result screen</p> },
    ],
    { pathname: "/exam/run", state: { attemptId: "att-1", remainingToday: 2 } },
  );
  await screen.findByRole("button", { name: /quitter/i });
  await act(async () => {
    await router.navigate("/exam/result", { replace: true, state: RESULT });
  });
  await screen.findByText("result screen");
  await new Promise((r) => setTimeout(r, 300));
  expect(router.state.location.pathname).toBe("/exam/result");
  expect(screen.getByText("result screen")).toBeInTheDocument();
});

test("the result screen leaving to another location does not bounce back to /exam", async () => {
  const router = renderFocus(
    [
      { path: "/exam", element: <p>intro</p> },
      { path: "/exam/result", element: <ExamResultScreen /> },
      { path: "/elsewhere", element: <p>elsewhere</p> },
    ],
    { pathname: "/exam/result", state: RESULT },
  );
  await screen.findByRole("heading", { name: /a gagné cette fois/ });
  await act(async () => {
    await router.navigate("/elsewhere");
  });
  await screen.findByText("elsewhere");
  await new Promise((r) => setTimeout(r, 300));
  expect(router.state.location.pathname).toBe("/elsewhere");
});

test("the lesson done screen leaving to another location does not bounce back to /", async () => {
  const services = createFakeServices();
  const result = await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
  const router = renderFocus(
    [
      { path: "/", element: <p>home</p> },
      { path: "/lesson/:id/done", element: <LessonDoneScreen /> },
      { path: "/elsewhere", element: <p>elsewhere</p> },
    ],
    { pathname: "/lesson/l05/done", state: { ...result, accuracy: 1, perfect: true } },
    services,
  );
  await screen.findByRole("button", { name: /continuer/i });
  await act(async () => {
    await router.navigate("/elsewhere");
  });
  await screen.findByText("elsewhere");
  await new Promise((r) => setTimeout(r, 300));
  expect(router.state.location.pathname).toBe("/elsewhere");
});
