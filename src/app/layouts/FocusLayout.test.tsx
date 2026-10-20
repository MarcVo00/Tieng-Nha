import { act, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { useAppState } from "@/app/appState";
import { FocusLayout } from "@/app/layouts/FocusLayout";
import { ServicesProvider } from "@/app/ServicesProvider";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { ExamRunScreen } from "@/features/exam";
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

test("the run screen exiting inside FocusLayout does not bounce the app back to /exam", async () => {
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS, capabilities: { tts: true, stt: false, recorder: false } } });
  markAttempt("pending", "att-1");
  const router = createMemoryRouter(
    [
      {
        element: <FocusLayout />,
        children: [
          { path: "/exam", element: <p>intro</p> },
          { path: "/exam/run", element: <ExamRunScreen /> },
          { path: "/exam/result", element: <p>result screen</p> },
        ],
      },
    ],
    { initialEntries: [{ pathname: "/exam/run", state: { attemptId: "att-1", remainingToday: 2 } }] },
  );
  render(
    <ServicesProvider services={createFakeServices()}>
      <RouterProvider router={router} />
    </ServicesProvider>,
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
