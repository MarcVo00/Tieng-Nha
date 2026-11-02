import { act, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
import { appRoutes } from "@/app/router";
import { useAppState } from "@/app/appState";
import "@/test/routerTestEnv";

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}));

const NOW = "2026-10-10T08:00:00.000Z";

test("the review badge follows the active language, also when it changes without a reload", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await services.auth.verifyOtp("a@b.c", "123456");
  await services.auth.joinGroup("TEST-CODE", "Marc", "🐉");
  await services.progress.saveSettings({ theme: "system", voiceRate: "normal", voice: "south-f", capabilities: { tts: true, stt: true, recorder: true }, onboardingDone: true, sound: true, language: "vi" });
  const base = { box: 1, correct: 0, wrong: 0, lastSeenAt: NOW } as const;
  await services.progress.upsertVocabProgress({ ...base, vocabId: "v_chao", dueAt: "2026-10-09T00:00:00.000Z" });
  await services.progress.upsertVocabProgress({ ...base, vocabId: "v_cam_on", dueAt: "2026-10-09T00:00:00.000Z" });
  await services.progress.upsertVocabProgress({ ...base, vocabId: "tl_v_salamat", dueAt: "2026-10-09T00:00:00.000Z" });

  useAppState.setState({ ready: false, session: null, profile: null, dueCount: 0 });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: ["/"] })} />
    </ServicesProvider>,
  );
  await screen.findByRole("navigation");
  await waitFor(() => expect(useAppState.getState().dueCount).toBe(2));

  await act(async () => {
    useAppState.getState().set({ settings: { ...useAppState.getState().settings, language: "tl" } });
  });
  await waitFor(() => expect(useAppState.getState().dueCount).toBe(1));

  await act(async () => {
    useAppState.getState().set({ settings: { ...useAppState.getState().settings, language: "vi" } });
  });
  await waitFor(() => expect(useAppState.getState().dueCount).toBe(2));
});
