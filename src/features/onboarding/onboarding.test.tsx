import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices, FakeAuthService } from "@/adapters/fakes";
import { InvalidCredentialsError, OfflineError, SamePasswordError, WeakPasswordError } from "@/domain/errors";
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
  await choosePassword(user);
  await screen.findByLabelText("Pseudo");
}

/** Fills the two password fields of SetPasswordStep and submits. */
async function choosePassword(user: User, password = "secret123", confirmation = password) {
  await user.type(await screen.findByLabelText("Mot de passe"), password);
  await user.type(screen.getByLabelText("Confirme ton mot de passe"), confirmation);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
}

async function passwordSignIn(user: User, email = "marc@example.com", password = "secret123") {
  await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Mot de passe"), password);
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

/** An account that already exists on the fake backend (profile, optional password), signed out. */
async function existingAccount(withPassword: boolean) {
  const auth = new FakeAuthService();
  await auth.verifyOtp("marc@example.com", "123456");
  await auth.joinGroup("TEST-CODE", "Marc", "🐯");
  if (withPassword) await auth.setPassword("secret123");
  await auth.signOut();
  return auth;
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
  expect(JSON.parse(localStorage.getItem("tn-profile") ?? "null")).toEqual({ pseudo: "Marc", avatarEmoji: "🐉" });
});

test("the test voice button speaks Vietnamese and stores capabilities", async () => {
  const { services, user } = setup();
  await signIn(user);
  await user.type(screen.getByLabelText("Pseudo"), "Marc");
  await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
  await user.click(await screen.findByRole("button", { name: "Écouter" }));
  await waitFor(() => expect(useAppState.getState().settings.capabilities).toEqual({ tts: true, stt: true, recorder: true }));
  const tts = services.tts as unknown as { spoken: string[] };
  expect(tts.spoken).toEqual(["Chào bạn!"]);
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
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir Tiếng Nhà" }));
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
  const { router, user } = setup({ auth });
  await toOtpStep(user);
  await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
  await user.click(screen.getByRole("button", { name: "Valider mon code" }));
  await user.click(await screen.findByRole("button", { name: "Plus tard" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
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

describe("password", () => {
  test("sign-up asks for a password after the code, then the profile", async () => {
    const { services, user } = setup();
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    expect(await screen.findByRole("heading", { name: "Choisis ton mot de passe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plus tard" })).not.toBeInTheDocument();
    await choosePassword(user);
    expect(await screen.findByLabelText("Pseudo")).toBeInTheDocument();
    expect(await services.auth.hasPassword()).toBe(true);
  });

  test("a password under 8 characters or a mismatch is refused before calling the server", async () => {
    const { services, user } = setup();
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    await choosePassword(user, "short", "short");
    expect(await screen.findByText("Mot de passe trop faible (8 caractères minimum)")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Mot de passe"));
    await user.clear(screen.getByLabelText("Confirme ton mot de passe"));
    await choosePassword(user, "secret123", "secret124");
    expect(await screen.findByText("Les deux mots de passe ne sont pas identiques")).toBeInTheDocument();
    expect(await services.auth.hasPassword()).toBe(false);
  });

  test("the server's weak password error shows the same message", async () => {
    const auth = new FakeAuthService();
    auth.setPassword = async () => {
      throw new WeakPasswordError();
    };
    const { user } = setup({ auth });
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    await choosePassword(user);
    expect(await screen.findByText("Mot de passe trop faible (8 caractères minimum)")).toBeInTheDocument();
  });

  test("a new password equal to the old one shows the different-password message", async () => {
    const auth = new FakeAuthService();
    auth.setPassword = async () => {
      throw new SamePasswordError();
    };
    const { user } = setup({ auth });
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    await choosePassword(user);
    expect(await screen.findByText("Choisis un mot de passe différent de l'ancien")).toBeInTheDocument();
  });

  test("the eye button reveals the password", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
    const field = await screen.findByLabelText("Mot de passe");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "current-password");
    const eye = screen.getByRole("button", { name: "Afficher le mot de passe" });
    expect(eye).toHaveAttribute("aria-pressed", "false");
    await user.click(eye);
    expect(field).toHaveAttribute("type", "text");
    expect(eye).toHaveAttribute("aria-pressed", "true");
    await user.click(eye);
    expect(field).toHaveAttribute("type", "password");
    expect(eye).toHaveAttribute("aria-pressed", "false");
  });

  test("signing in with a password skips device and install: capabilities saved, onboarding done, home", async () => {
    const auth = await existingAccount(true);
    const { services, router, user } = setup({ auth }); // beforeEach state = right after sign-out: onboardingDone false
    expect(useAppState.getState().settings.onboardingDone).toBe(false);
    await passwordSignIn(user);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(useAppState.getState().settings.onboardingDone).toBe(true);
    expect(useAppState.getState().settings.capabilities).toEqual({ tts: true, stt: true, recorder: true });
    expect((await services.progress.getSettings()).onboardingDone).toBe(true);
    expect(useAppState.getState().profile).toEqual({ pseudo: "Marc", avatarEmoji: "🐯" });
    expect(JSON.parse(localStorage.getItem("tn-profile") ?? "null")).toEqual({ pseudo: "Marc", avatarEmoji: "🐯" });
  });

  test("a failing settings save on a password sign-in shows the retry banner, and retry goes home", async () => {
    const auth = await existingAccount(true);
    const progress = createFakeServices().progress;
    const original = progress.saveSettings.bind(progress);
    let failOnce = true;
    vi.spyOn(progress, "saveSettings").mockImplementation(async (next) => {
      if (next.onboardingDone && failOnce) {
        failOnce = false;
        throw new Error("disk");
      }
      await original(next);
    });
    const { router, user } = setup({ auth, progress });
    await passwordSignIn(user);
    await user.click(await screen.findByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  test("a wrong password shows the incorrect message", async () => {
    const auth = await existingAccount(true);
    const { user } = setup({ auth });
    await passwordSignIn(user, "marc@example.com", "wrong-one");
    expect(await screen.findByText("E-mail ou mot de passe incorrect")).toBeInTheDocument();
    expect(useAppState.getState().session).toBeNull();
  });

  test("being offline while signing in shows the offline message", async () => {
    const auth = new FakeAuthService();
    auth.signInWithPassword = async () => {
      throw new OfflineError();
    };
    const { user } = setup({ auth });
    await passwordSignIn(user);
    expect(await screen.findByText("Pas de connexion internet")).toBeInTheDocument();
  });

  test("a password sign-in without a profile asks for the invite code on the profile step", async () => {
    const auth = new FakeAuthService();
    await auth.verifyOtp("marc@example.com", "123456");
    await auth.setPassword("secret123");
    await auth.signOut();
    const { user } = setup({ auth });
    await passwordSignIn(user);
    await user.type(await screen.findByLabelText("Pseudo"), "Marc");
    await user.type(screen.getByLabelText("Code d'invitation"), "nope");
    await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
    expect(await screen.findByText("Code d'invitation incorrect")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Code d'invitation"));
    await user.type(screen.getByLabelText("Code d'invitation"), "test-code");
    await user.click(screen.getByRole("button", { name: "Rejoindre le groupe" }));
    expect(await screen.findByRole("button", { name: "Écouter" })).toBeInTheDocument();
  });

  test("forgot password: code, new password, then home", async () => {
    const auth = await existingAccount(true);
    const { services, router, user } = setup({ auth });
    await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
    await user.type(await screen.findByLabelText("E-mail"), "marc@example.com");
    await user.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    const send = await screen.findByRole("button", { name: "Recevoir mon code" });
    expect(screen.queryByLabelText("Code d'invitation")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("marc@example.com");
    await user.click(send);
    await user.type(await screen.findByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    expect(await screen.findByRole("heading", { name: "Nouveau mot de passe" })).toBeInTheDocument();
    await choosePassword(user, "brand-new-pass");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(useAppState.getState().settings.onboardingDone).toBe(true);
    expect((services.auth as FakeAuthService).otpRequests).toEqual(["marc@example.com"]);
    await services.auth.signOut();
    await expect(services.auth.signInWithPassword("marc@example.com", "secret123")).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(services.auth.signInWithPassword("marc@example.com", "brand-new-pass")).resolves.toBeDefined();
  });

  test("forgot password for an unknown e-mail shows the neutral message and sends no code", async () => {
    const { services, user } = setup();
    await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
    await user.type(await screen.findByLabelText("E-mail"), "ghost@example.com");
    await user.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    await user.click(await screen.findByRole("button", { name: "Recevoir mon code" }));
    expect(await screen.findByText("Si un compte existe, un code t'a été envoyé.")).toBeInTheDocument();
    expect((services.auth as FakeAuthService).otpRequests).toEqual([]);
    expect(await services.auth.getSession()).toBeNull();
  });

  test("forgot password asks for the code without creating accounts", async () => {
    const auth = await existingAccount(true);
    const spy = vi.spyOn(auth, "requestOtp");
    const { user } = setup({ auth });
    await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
    await user.type(await screen.findByLabelText("E-mail"), "marc@example.com");
    await user.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    await user.click(await screen.findByRole("button", { name: "Recevoir mon code" }));
    await screen.findByLabelText("Code à 6 chiffres");
    expect(spy).toHaveBeenCalledWith("marc@example.com", { createUser: false });
  });

  test("an existing user signing in by code without a password gets the upgrade prompt, and Plus tard skips it", async () => {
    const auth = await existingAccount(false);
    const { services, router, user } = setup({ auth });
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    expect(await screen.findByRole("heading", { name: "Un mot de passe, c'est plus simple" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plus tard" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await services.auth.hasPassword()).toBe(false);
  });

  test("the upgrade prompt saves a password and continues", async () => {
    const auth = await existingAccount(false);
    const { services, router, user } = setup({ auth });
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    await choosePassword(user);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await services.auth.hasPassword()).toBe(true);
  });

  test("an existing user who already has a password is not prompted after the code", async () => {
    const auth = await existingAccount(true);
    const { router, user } = setup({ auth });
    await toOtpStep(user);
    await user.type(screen.getByLabelText("Code à 6 chiffres"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider mon code" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("heading", { name: "Un mot de passe, c'est plus simple" })).not.toBeInTheDocument();
  });

  test("someone who tapped Commencer by mistake can go back, or straight to sign-in with the e-mail kept", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Commencer" }));
    await user.click(await screen.findByRole("button", { name: "Retour" }));
    expect(await screen.findByRole("button", { name: "Commencer" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.type(await screen.findByLabelText("E-mail"), "marc@example.com");
    await user.click(screen.getByRole("button", { name: "Déjà un compte ? Se connecter" }));
    expect(await screen.findByRole("heading", { name: "Content de te revoir" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("marc@example.com");
  });

  test("the progress dots appear on the sign-up path only", async () => {
    const { user } = setup();
    expect(screen.getByRole("img", { name: "Étape 1 sur 6" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Déjà un compte ? Se connecter" }));
    await screen.findByLabelText("Mot de passe");
    expect(screen.queryByRole("img", { name: /Étape/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retour" }));
    expect(await screen.findByRole("img", { name: "Étape 1 sur 6" })).toBeInTheDocument();
  });
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

  test("inside a messaging app's browser, the step sends the user to Chrome instead of installing", async () => {
    stubUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0");
    stubDisplayMode(false);
    signedIn();
    const { user } = setup();
    await toInstallStep(user);
    expect(await screen.findByText("Pour installer Tiếng Nhà, passe par Chrome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir dans Chrome" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Installer l'application" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C'est parti !" })).toBeInTheDocument();
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

describe("demo hints", () => {
  const demoEnv = (demo: boolean) => ({ ...createFakeServices().env, VITE_DEMO: demo });

  test.each([false, true])("invite and code steps show the hint only in demo mode (demo=%s)", async (demo) => {
    const { user } = setup({ env: demoEnv(demo) });
    await user.click(await screen.findByRole("button", { name: "Commencer" }));
    await screen.findByLabelText("Code d'invitation");
    expect(screen.queryAllByText(/n'importe quel code d'invitation/)).toHaveLength(demo ? 1 : 0);
    await user.type(screen.getByLabelText("Code d'invitation"), "x");
    await user.type(screen.getByLabelText("E-mail"), "marc@example.com");
    await user.click(screen.getByRole("button", { name: "Recevoir mon code" }));
    await screen.findByLabelText("Code à 6 chiffres");
    expect(screen.queryAllByText(/le code est 123456/)).toHaveLength(demo ? 1 : 0);
  });

  test.each([false, true])("sign-in screen shows the hint only in demo mode (demo=%s)", async (demo) => {
    const { user } = setup({ env: demoEnv(demo) });
    await user.click(await screen.findByRole("button", { name: "Déjà un compte ? Se connecter" }));
    await screen.findByLabelText("Mot de passe");
    expect(screen.queryAllByText(/Démo : utilise le compte/)).toHaveLength(demo ? 1 : 0);
  });
});
