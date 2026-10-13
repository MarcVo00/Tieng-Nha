import { act, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
import { appRoutes } from "@/app/router";
import { useAppState } from "@/app/appState";
import { OfflineError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import type { AuthEvent } from "@/ports";
import "@/test/routerTestEnv";

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
  await services.progress.saveSettings({ theme: "system", voiceRate: "normal", voice: "south-f", capabilities: { tts: true, stt: true, recorder: true }, onboardingDone: true });
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
  await screen.findByRole("button", { name: /quitter la leçon/i }); // the lesson player is a focus route
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

test("saved dark theme never drops the dark class during bootstrap", async () => {
  const services = await onboardedServices();
  await services.progress.saveSettings({ theme: "dark", voiceRate: "normal", voice: "south-f", capabilities: null, onboardingDone: true });
  localStorage.setItem("tn-theme", "dark");
  document.documentElement.classList.add("dark"); // as the inline script in index.html does
  let removed = false;
  const observer = new MutationObserver(() => {
    if (!document.documentElement.classList.contains("dark")) removed = true;
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  renderAt("/", services);
  await screen.findByRole("navigation");
  await waitFor(() => expect(useAppState.getState().ready).toBe(true));
  observer.disconnect();
  expect(removed).toBe(false);
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("tn-theme")).toBe("dark");
  document.documentElement.classList.remove("dark");
});

test("a failing bootstrap still reaches a rendered app", async () => {
  const services = createFakeServices();
  vi.spyOn(services.progress, "getSettings").mockRejectedValue(new Error("boom"));
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { router } = renderAt("/", services);
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(errorLog).toHaveBeenCalled();
  errorLog.mockRestore();
});

test("offline cold start with an expired token keeps the cached profile and saved settings", async () => {
  const services = await onboardedServices();
  await services.progress.saveSettings({ theme: "dark", voiceRate: "slow", voice: "south-f", capabilities: null, onboardingDone: true });
  localStorage.setItem("tn-session", JSON.stringify({ userId: "me", email: "a@b.c" }));
  localStorage.setItem("tn-profile", JSON.stringify({ pseudo: "Marc", avatarEmoji: "🐉" }));
  vi.spyOn(services.auth, "getSession").mockRejectedValue(new OfflineError());
  vi.spyOn(services.auth, "getMyProfile").mockRejectedValue(new OfflineError());
  const { router } = renderAt("/", services);
  expect(await screen.findByRole("navigation")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
  expect(useAppState.getState().profile).toEqual({ pseudo: "Marc", avatarEmoji: "🐉" });
  expect(useAppState.getState().settings).toMatchObject({ theme: "dark", voiceRate: "slow", onboardingDone: true });
});

test("a null INITIAL_SESSION does not sign the user out, an explicit SIGNED_OUT does", async () => {
  const services = await onboardedServices();
  let emit: (s: Session | null, e?: AuthEvent) => void = () => undefined;
  vi.spyOn(services.auth, "onChange").mockImplementation((cb) => {
    emit = cb;
    return () => undefined;
  });
  renderAt("/", services);
  await screen.findByRole("navigation");
  act(() => emit(null, "INITIAL_SESSION"));
  expect(useAppState.getState().session).not.toBeNull();
  expect(useAppState.getState().profile).not.toBeNull();
  act(() => emit(null, "SIGNED_OUT"));
  expect(useAppState.getState().session).toBeNull();
  expect(useAppState.getState().profile).toBeNull();
});

test("returning to the app flushes pending sync", async () => {
  const services = await onboardedServices();
  const flush = vi.spyOn(services.sync, "flush");
  renderAt("/", services);
  await screen.findByRole("navigation");
  flush.mockClear();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(flush).toHaveBeenCalledTimes(1);
});

test("the selected voice pack is prefetched once ready, and again when the voice changes", async () => {
  const services = await onboardedServices();
  const prefetch = vi.spyOn(services, "prefetchVoice");
  renderAt("/", services);
  await screen.findByRole("navigation");
  await waitFor(() => expect(prefetch).toHaveBeenCalledWith("south-f"));
  act(() => useAppState.getState().set({ settings: { ...useAppState.getState().settings, voice: "north-f" } }));
  await waitFor(() => expect(prefetch).toHaveBeenCalledWith("north-f"));
  act(() => useAppState.getState().set({ settings: { ...useAppState.getState().settings, voice: "device" } }));
  expect(prefetch).toHaveBeenCalledTimes(2);
});
