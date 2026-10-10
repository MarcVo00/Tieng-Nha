import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
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
