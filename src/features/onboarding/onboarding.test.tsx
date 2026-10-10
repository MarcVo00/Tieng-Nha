import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices, FakeAuthService } from "@/adapters/fakes";
import { OfflineError } from "@/domain/errors";
import { useAppState } from "@/app/appState";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { AuthCallbackScreen, WelcomeScreen } from "@/features/onboarding";
import "@/test/routerTestEnv";

function setup(overrides: Parameters<typeof createFakeServices>[0] = {}) {
  const services = createFakeServices(overrides);
  const router = createMemoryRouter(
    [
      { path: "/welcome", element: <WelcomeScreen /> },
      { path: "/auth/callback", element: <AuthCallbackScreen /> },
      { path: "/", element: <p>home</p> },
    ],
    { initialEntries: ["/welcome"] },
  );
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ServicesProvider>,
  );
  return { services, router, user: userEvent.setup() };
}

type User = ReturnType<typeof setup>["user"];

async function toOtpStep(user: User, invite = "test-code") {
  await user.click(await screen.findByRole("button", { name: "Commencer" }));
  await user.type(await screen.findByLabelText("Code d'invitation"), invite);
  await user.type(screen.getByLabelText("E-mail"), "marc@example.com");
  await user.click(screen.getByRole("button", { name: "Recevoir mon code" }));
  await screen.findByLabelText("Code à 6 chiffres");
}

async function signIn(user: User, invite = "test-code") {
  await toOtpStep(user, invite);
  await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
  await user.click(screen.getByRole("button", { name: "Valider mon code" }));
  await screen.findByLabelText("Pseudo");
}

beforeEach(() => {
  localStorage.clear();
  useAppState.setState({ ready: true, session: null, profile: null, settings: { ...DEFAULT_SETTINGS } });
});

test("happy path ends on / with onboarding done and profile cached", async () => {
  const { services, router, user } = setup();
  await signIn(user);
  await user.type(screen.getByLabelText("Pseudo"), "Marc");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  await user.click(await screen.findByRole("button", { name: "Écouter" }));
  await waitFor(() => expect(screen.getByLabelText("Résultats du test")).toHaveTextContent("Disponible"));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(await screen.findByRole("button", { name: "C'est parti !" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  expect(useAppState.getState().settings.onboardingDone).toBe(true);
  expect((await services.progress.getSettings()).onboardingDone).toBe(true);
  expect(useAppState.getState().profile).toEqual({ pseudo: "Marc", avatarEmoji: "🐉" });
  expect(JSON.parse(localStorage.getItem("vl-profile") ?? "null")).toEqual({ pseudo: "Marc", avatarEmoji: "🐉" });
});

test("the test voice button speaks Vietnamese and stores capabilities", async () => {
  const { services, user } = setup();
  await signIn(user);
  await user.type(screen.getByLabelText("Pseudo"), "Marc");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  await user.click(await screen.findByRole("button", { name: "Écouter" }));
  await waitFor(() => expect(useAppState.getState().settings.capabilities).toEqual({ tts: true, stt: true, recorder: true }));
  const tts = services.tts as unknown as { spoken: string[] };
  expect(tts.spoken).toEqual(["Xin chào!"]);
});

test("a wrong code shows an error and stays on the code step", async () => {
  const { user } = setup();
  await toOtpStep(user);
  await user.type(screen.getByLabelText("Code à 6 chiffres"), "000000");
  await user.click(screen.getByRole("button", { name: "Valider mon code" }));
  expect(await screen.findByText("Code incorrect ou expiré")).toBeInTheDocument();
  expect(screen.queryByLabelText("Pseudo")).not.toBeInTheDocument();
});

test("a taken pseudo shows the taken message", async () => {
  const { user } = setup();
  await signIn(user);
  await user.type(screen.getByLabelText("Pseudo"), "Taken");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  expect(await screen.findByText("Ce pseudo est déjà pris dans ton groupe")).toBeInTheDocument();
});

test("a pseudo that is too short is refused before calling the server", async () => {
  const { user } = setup();
  await signIn(user);
  await user.type(screen.getByLabelText("Pseudo"), "M");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  expect(await screen.findByText("Ton pseudo doit faire entre 2 et 20 caractères")).toBeInTheDocument();
});

test("an invalid invite sends the user back to step 2 with the message", async () => {
  const { user } = setup();
  await signIn(user, "NOPE");
  await user.type(screen.getByLabelText("Pseudo"), "Marc");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  expect(await screen.findByText("Code d'invitation incorrect")).toBeInTheDocument();
  expect(screen.getByLabelText("Code d'invitation")).toHaveValue("NOPE");
});

test("a returning signed-in user with a profile starts at the device test", async () => {
  useAppState.setState({ session: { userId: "me", email: "a@b.c" }, profile: { pseudo: "Marc", avatarEmoji: "🐉" } });
  setup();
  expect(await screen.findByRole("button", { name: "Écouter" })).toBeInTheDocument();
});

test("auth callback explains how to continue and links to /welcome", async () => {
  const router = createMemoryRouter(
    [
      { path: "/auth/callback", element: <AuthCallbackScreen /> },
      { path: "/welcome", element: <p>welcome</p> },
    ],
    { initialEntries: ["/auth/callback"] },
  );
  render(
    <ServicesProvider services={createFakeServices()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ServicesProvider>,
  );
  expect(screen.getByText(/saisis le code à 6 chiffres/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir VietLearn" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
});

test("a failure reading the profile after a good code goes to the profile step, never back to the OTP form", async () => {
  const auth = new FakeAuthService();
  auth.hasProfile = async () => {
    throw new Error("boom");
  };
  const { user } = setup({ auth });
  await signIn(user);
  expect(screen.queryByLabelText("Code à 6 chiffres")).not.toBeInTheDocument();
  expect(useAppState.getState().session).not.toBeNull();
});

test("after an invalid invite, resubmitting skips the code and reaches the profile step", async () => {
  const { services, user } = setup();
  await signIn(user, "NOPE");
  await user.type(screen.getByLabelText("Pseudo"), "Marc");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  await screen.findByText("Code d'invitation incorrect");
  expect(screen.getByLabelText("E-mail")).toHaveValue("marc@example.com");
  const invite = screen.getByLabelText("Code d'invitation");
  await user.clear(invite);
  await user.type(invite, "test-code");
  await user.click(screen.getByRole("button", { name: "Recevoir mon code" }));
  expect(await screen.findByLabelText("Pseudo")).toBeInTheDocument();
  expect((services.auth as FakeAuthService).otpRequests).toHaveLength(1);
});

test("a user who already has a profile skips the profile step after the code", async () => {
  const auth = new FakeAuthService();
  await auth.verifyOtp("marc@example.com", "123456");
  await auth.joinGroup("TEST-CODE", "Marc", "🐯");
  const { user } = setup({ auth });
  await toOtpStep(user);
  await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
  await user.click(screen.getByRole("button", { name: "Valider mon code" }));
  expect(await screen.findByRole("button", { name: "Écouter" })).toBeInTheDocument();
  expect(useAppState.getState().profile).toEqual({ pseudo: "Marc", avatarEmoji: "🐯" });
});

test("being offline when requesting the code shows the offline message", async () => {
  const auth = new FakeAuthService();
  auth.requestOtp = async () => {
    throw new OfflineError();
  };
  const { user } = setup({ auth });
  await user.click(await screen.findByRole("button", { name: "Commencer" }));
  await user.type(await screen.findByLabelText("Code d'invitation"), "TEST-CODE");
  await user.type(screen.getByLabelText("E-mail"), "marc@example.com");
  await user.click(screen.getByRole("button", { name: "Recevoir mon code" }));
  expect(await screen.findByText("Pas de connexion internet")).toBeInTheDocument();
});

test("the resend button is disabled for 30 seconds, then enabled", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const { user } = setup();
    await toOtpStep(user);
    expect(screen.getByRole("button", { name: /Renvoyer le code \(\d+ s\)/ })).toBeDisabled();
    for (let i = 0; i < 31; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByRole("button", { name: "Renvoyer le code" })).toBeEnabled();
  } finally {
    vi.useRealTimers();
  }
});

describe("install step", () => {
  const originalUa = navigator.userAgent;
  const originalMatchMedia = window.matchMedia;

  function stubUserAgent(ua: string) {
    Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  }
  function stubDisplayMode(standalone: boolean) {
    window.matchMedia = ((query: string) => ({ matches: standalone && query.includes("standalone") })) as typeof window.matchMedia;
  }
  function signedIn() {
    useAppState.setState({ session: { userId: "me", email: "a@b.c" }, profile: { pseudo: "Marc", avatarEmoji: "🐉" } });
  }
  async function toInstallStep(user: User) {
    await user.click(await screen.findByRole("button", { name: "Continuer" }));
  }

  afterEach(() => {
    stubUserAgent(originalUa);
    window.matchMedia = originalMatchMedia;
  });

  test("iOS shows the three Add to Home Screen steps", async () => {
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    stubDisplayMode(false);
    signedIn();
    const { user } = setup();
    await toInstallStep(user);
    expect(await screen.findByText(/Sur l'écran d'accueil/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  test("standalone display mode skips the step and finishes", async () => {
    stubDisplayMode(true);
    signedIn();
    const { user, router } = setup();
    await toInstallStep(user);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(useAppState.getState().settings.onboardingDone).toBe(true);
  });

  test("a captured beforeinstallprompt event is used by the install button", async () => {
    stubUserAgent("Mozilla/5.0 (Linux; Android 14)");
    stubDisplayMode(false);
    const prompt = vi.fn().mockResolvedValue(undefined);
    act(() => {
      window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }));
    });
    signedIn();
    const { user, router } = setup();
    await toInstallStep(user);
    await user.click(await screen.findByRole("button", { name: "Installer l'application" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test("a failing settings save on finish shows an error and a working retry", async () => {
    const progress = createFakeServices().progress;
    const original = progress.saveSettings.bind(progress);
    let failOnce = true;
    const save = vi.spyOn(progress, "saveSettings").mockImplementation(async (next) => {
      if (next.onboardingDone && failOnce) {
        failOnce = false;
        throw new Error("disk");
      }
      await original(next);
    });
    signedIn();
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    stubDisplayMode(false);
    const { user, router } = setup({ progress });
    await user.click(await screen.findByRole("button", { name: "Continuer" }));
    await user.click(await screen.findByRole("button", { name: "C'est parti !" }));
    await user.click(await screen.findByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(save).toHaveBeenCalled();
    expect(failOnce).toBe(false);
  });
});
