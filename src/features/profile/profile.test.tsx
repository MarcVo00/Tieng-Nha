import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import type { Services } from "@/app/services";
import { createFakeServices, FakeAuthService } from "@/adapters/fakes";
import { OfflineError } from "@/domain/errors";
import type { ProgressSnapshot } from "@/domain/types";
import { MeScreen } from "@/features/profile";
import { fr } from "@/i18n/fr";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { ToastViewport } from "@/ui";
import "@/test/routerTestEnv";

const NOW = "2026-10-10T10:00:00.000Z";

const snapshot = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  xpTotal: 120, xpWeek: 40, xpToday: 10, streak: 3, lessonsDone: [], perfectLessons: [], dialoguesDone: [],
  vocabReviewed: 0, examBest: null, badges: [], activeDays: [], ...over,
});

async function setup(given: Partial<Services> | Services = {}) {
  const services = "reporter" in given && "sync" in given ? (given as Services) : createFakeServices({ clock: () => NOW, ...given });
  await services.auth.verifyOtp("m@x.fr", "123456");
  const router = createMemoryRouter(
    [
      { path: "/me", element: <MeScreen /> },
      { path: "/welcome", element: <p>bienvenue</p> },
    ],
    { initialEntries: ["/me"] },
  );
  render(
    <ServicesProvider services={services}>
      <ToastViewport />
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ServicesProvider>,
  );
  await screen.findByText(/ sur 12$/);
  return { services, router, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("vl-profile", JSON.stringify({ pseudo: "Marc", avatarEmoji: "🐉" }));
  useAppState.setState({
    ready: true, session: { userId: "me", email: "m@x.fr" }, profile: { pseudo: "Marc", avatarEmoji: "🐉" },
    settings: { ...DEFAULT_SETTINGS, onboardingDone: true }, snapshot: snapshot(), dueCount: 0,
  });
});

test("shows the header and all 12 badges, unlocked first", async () => {
  useAppState.setState({ snapshot: snapshot({ badges: ["first_lesson"] }) });
  await setup();
  expect(screen.getByText("Marc")).toBeInTheDocument();
  expect(screen.getByText(fr.leaderboard.xp(120))).toBeInTheDocument();
  const items = await screen.findAllByRole("listitem");
  const badgeItems = items.filter((li) => within(li).queryByRole("button"));
  expect(badgeItems).toHaveLength(12);
  expect(badgeItems[0]).toHaveTextContent(/./);
  expect(within(badgeItems[0] as HTMLElement).queryByText(fr.ui.badge.locked, { exact: false })).toBeNull();
});

test("theme change persists in the stored settings", async () => {
  const { services, user } = await setup();
  await user.click(screen.getByRole("radio", { name: "Sombre" }));
  expect(useAppState.getState().settings.theme).toBe("dark");
  await waitFor(async () => expect((await services.progress.getSettings()).theme).toBe("dark"));
  await user.click(screen.getByRole("radio", { name: /Lente/ }));
  await waitFor(async () => expect((await services.progress.getSettings()).voiceRate).toBe("slow"));
});

test("a failing settings save shows a toast instead of an unhandled rejection", async () => {
  const { services, user } = await setup();
  vi.spyOn(services.progress, "saveSettings").mockRejectedValue(new Error("disk"));
  await user.click(screen.getByRole("radio", { name: "Clair" }));
  expect(await screen.findByText(fr.profile.settings.saveError)).toBeInTheDocument();
});

test("updating the pseudo calls the auth service and refreshes the cached profile", async () => {
  const { services, user } = await setup();
  const spy = vi.spyOn(services.auth, "updateProfile");
  await user.click(screen.getByRole("button", { name: fr.profile.editAria }));
  const field = await screen.findByLabelText(fr.profile.edit.pseudoLabel);
  await user.clear(field);
  await user.type(field, "Marco");
  await user.click(screen.getByRole("radio", { name: fr.profile.edit.avatarOption("🌸") }));
  await user.click(screen.getByRole("button", { name: fr.profile.edit.save }));
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ pseudo: "Marco", avatarEmoji: "🌸" }));
  await waitFor(() => expect(useAppState.getState().profile).toEqual({ pseudo: "Marco", avatarEmoji: "🌸" }));
  expect(JSON.parse(localStorage.getItem("vl-profile") ?? "null")).toEqual({ pseudo: "Marco", avatarEmoji: "🌸" });
});

test("a taken pseudo shows its message and keeps the sheet open", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: fr.profile.editAria }));
  const field = await screen.findByLabelText(fr.profile.edit.pseudoLabel);
  await user.clear(field);
  await user.type(field, "Taken");
  await user.click(screen.getByRole("button", { name: fr.profile.edit.save }));
  expect(await screen.findByText(fr.profile.edit.pseudoTaken)).toBeInTheDocument();
  expect(useAppState.getState().profile?.pseudo).toBe("Marc");
});

test("the certificate button appears from 70 and uses the best attempt's date", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await services.progress.appendEvent({ type: "exam_finished", refId: "exam", xp: 10, payload: { score: 72, attemptId: "a", noSpeaking: false } }, "2026-10-01T09:00:00.000Z");
  await services.progress.appendEvent({ type: "exam_finished", refId: "exam", xp: 10, payload: { score: 91, attemptId: "b", noSpeaking: true } }, "2026-10-05T09:00:00.000Z");
  await services.progress.appendEvent({ type: "exam_finished", refId: "exam", xp: 0, payload: { score: 60, attemptId: "c", noSpeaking: false } }, "2026-10-08T09:00:00.000Z");
  useAppState.setState({ snapshot: snapshot({ examBest: 91 }) });
  const { user } = await setup(services);
  await user.click(await screen.findByRole("button", { name: fr.profile.certificate.open }));
  const cert = await screen.findAllByRole("img", { name: fr.exam.certificate.aria("Marc", 91) });
  expect(cert.length).toBeGreaterThan(0);
  expect(document.body).toHaveTextContent("5 octobre 2026");
  expect(document.body).toHaveTextContent(fr.exam.certificate.noSpeaking);
});

test("no certificate button below 70", async () => {
  useAppState.setState({ snapshot: snapshot({ examBest: 69 }) });
  await setup();
  expect(screen.queryByRole("button", { name: fr.profile.certificate.open })).toBeNull();
});

test("problem report is sent with refId app", async () => {
  const { services, user } = await setup();
  const spy = vi.spyOn(services.reporter, "report");
  await user.click(screen.getByRole("button", { name: fr.profile.settings.report }));
  await user.type(await screen.findByLabelText(fr.report.field), "Une faute");
  await user.click(screen.getByRole("button", { name: fr.report.send }));
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ refId: "app", message: "Une faute" }));
});

test("the device test sheet stores capabilities", async () => {
  const { services, user } = await setup();
  await user.click(screen.getByRole("button", { name: fr.profile.settings.device.open }));
  await user.click(await screen.findByRole("button", { name: fr.onboarding.device.listen }));
  await waitFor(async () => expect((await services.progress.getSettings()).capabilities).toEqual({ tts: true, stt: true, recorder: true }));
});

test("sign out clears local data and goes to /welcome", async () => {
  const { services, router, user } = await setup();
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  localStorage.setItem("vl-theme", "dark");
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(localStorage.getItem("vl-theme")).toBeNull();
  expect(await services.progress.listEvents()).toEqual([]);
  expect(localStorage.getItem("vl-profile")).toBeNull();
  expect(useAppState.getState()).toMatchObject({ session: null, profile: null, snapshot: null });
});

test("account deletion requires typing SUPPRIMER, then clears everything", async () => {
  const { services, router, user } = await setup();
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await services.progress.saveSettings({ ...DEFAULT_SETTINGS, theme: "dark", onboardingDone: true });
  localStorage.setItem("vl-theme", "dark");
  const del = vi.spyOn(services.auth, "deleteAccount");
  await user.click(screen.getByRole("button", { name: fr.profile.account.delete.open }));
  const dialog = await screen.findByRole("alertdialog");
  const confirm = within(dialog).getByRole("button", { name: fr.profile.account.delete.confirm });
  expect(confirm).toBeDisabled();
  await user.type(within(dialog).getByLabelText(fr.ui.confirm.inputLabel), "SUPPRIMER");
  await user.click(confirm);
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(del).toHaveBeenCalledTimes(1);
  expect(await services.progress.listEvents()).toEqual([]);
  expect((await services.progress.getSettings()).onboardingDone).toBe(false);
  expect(localStorage.getItem("vl-profile")).toBeNull();
  expect(localStorage.getItem("vl-theme")).toBeNull();
  expect(useAppState.getState().settings.onboardingDone).toBe(false);
});

test("offline deletion shows an error toast and keeps the data", async () => {
  class OfflineAuth extends FakeAuthService {
    override async deleteAccount(): Promise<void> {
      throw new OfflineError();
    }
  }
  const { services, router, user } = await setup({ auth: new OfflineAuth() });
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await user.click(screen.getByRole("button", { name: fr.profile.account.delete.open }));
  const dialog = await screen.findByRole("alertdialog");
  await user.type(within(dialog).getByLabelText(fr.ui.confirm.inputLabel), "SUPPRIMER");
  await user.click(within(dialog).getByRole("button", { name: fr.profile.account.delete.confirm }));
  expect(await screen.findByText(fr.profile.account.offline)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/me");
  expect(await services.progress.listEvents()).toHaveLength(1);
  expect(localStorage.getItem("vl-profile")).not.toBeNull();
});

test("a failing clearAll after a successful delete still resets state and lands on /welcome", async () => {
  const { services, router, user } = await setup();
  vi.spyOn(services.progress, "clearAll").mockRejectedValue(new Error("idb"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await user.click(screen.getByRole("button", { name: fr.profile.account.delete.open }));
  const dialog = await screen.findByRole("alertdialog");
  await user.type(within(dialog).getByLabelText(fr.ui.confirm.inputLabel), "SUPPRIMER");
  await user.click(within(dialog).getByRole("button", { name: fr.profile.account.delete.confirm }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(warn).toHaveBeenCalled();
  expect(localStorage.getItem("vl-profile")).toBeNull();
  expect(useAppState.getState()).toMatchObject({ session: null, profile: null, snapshot: null });
  warn.mockRestore();
});

test("offline sign-out shows an error toast and wipes nothing", async () => {
  class OfflineAuth extends FakeAuthService {
    override async signOut(): Promise<void> {
      throw new OfflineError();
    }
  }
  const { services, router, user } = await setup({ auth: new OfflineAuth() });
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  expect((await screen.findAllByText(fr.profile.account.offline)).length).toBeGreaterThan(0);
  expect(router.state.location.pathname).toBe("/me");
  expect(await services.progress.listEvents()).toHaveLength(1);
  expect(localStorage.getItem("vl-profile")).not.toBeNull();
  expect(useAppState.getState().profile).not.toBeNull();
});

test("sign-out flushes pending sync before signing out", async () => {
  const { services, user } = await setup();
  const order: string[] = [];
  vi.spyOn(services.sync, "flush").mockImplementation(async () => {
    order.push("flush");
    return { sent: 0 };
  });
  const original = services.auth.signOut.bind(services.auth);
  vi.spyOn(services.auth, "signOut").mockImplementation(async () => {
    order.push("signOut");
    await original();
  });
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  await waitFor(() => expect(order).toEqual(["flush", "signOut"]));
});

test("sign-out warns about unsynced progress and only proceeds when confirmed", async () => {
  const { services, router, user } = await setup();
  await services.outbox.enqueue({
    clientId: "c1", schemaVersion: 1, type: "lesson_completed", refId: "l01", xp: 10, payload: {}, createdAt: NOW,
  });
  vi.spyOn(services.sync, "flush").mockResolvedValue({ sent: 0 });
  const signOut = vi.spyOn(services.auth, "signOut");
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  expect(await screen.findByText(fr.profile.account.unsynced.body)).toBeInTheDocument();
  expect(signOut).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: fr.profile.account.unsynced.cancel }));
  await waitFor(() => expect(screen.queryByText(fr.profile.account.unsynced.body)).not.toBeInTheDocument());
  expect(router.state.location.pathname).toBe("/me");
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.unsynced.confirm }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(signOut).toHaveBeenCalledTimes(1);
});
