import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
import { appRoutes } from "@/app/router";
import { useAppState } from "@/app/appState";

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}));

function renderAt(path: string, services = createFakeServices()) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return { router, services };
}

async function onboardedServices() {
  const services = createFakeServices();
  await services.auth.verifyOtp("a@b.c", "123456");
  await services.auth.joinGroup("TEST-CODE", "Marc", "🐉");
  await services.progress.saveSettings({ theme: "system", voiceRate: "normal", capabilities: { tts: true, stt: true, recorder: true }, onboardingDone: true });
  return services;
}

beforeEach(() => useAppState.setState({ ready: false, session: null, profile: null }));

test("unauthenticated user is redirected to /welcome", async () => {
  const { router } = renderAt("/");
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
});

test("onboarded user sees the tab bar", async () => {
  renderAt("/", await onboardedServices());
  expect(await screen.findByRole("navigation")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /classement/i })).toBeInTheDocument();
});

test("focus routes hide the tab bar", async () => {
  const { router } = renderAt("/lesson/l05", await onboardedServices());
  await waitFor(() => expect(router.state.location.pathname).toBe("/lesson/l05"));
  await screen.findByRole("heading", { name: /bientôt prêt/i });
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
