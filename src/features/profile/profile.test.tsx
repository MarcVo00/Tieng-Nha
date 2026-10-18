import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import type { Services } from "@/app/services";
import { createFakeServices, FakeAuthService } from "@/adapters/fakes";
import { OfflineError, WeakPasswordError } from "@/domain/errors";
import type { ProgressSnapshot } from "@/domain/types";
import { MeScreen } from "@/features/profile";
import { fr } from "@/i18n/fr";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { ToastViewport } from "@/ui";
import { useToastStore } from "@/ui/Toast";
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
  await screen.findByText(/ sur 13$/);
  return { services, router, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("tn-profile", JSON.stringify({ pseudo: "Marc", avatarEmoji: "🐉" }));
  useAppState.setState({
    ready: true, session: { userId: "me", email: "m@x.fr" }, profile: { pseudo: "Marc", avatarEmoji: "🐉" },
    settings: { ...DEFAULT_SETTINGS, onboardingDone: true }, snapshot: snapshot(), dueCount: 0,
  });
});

test("shows the header and all 13 badges, unlocked first", async () => {
  useAppState.setState({ snapshot: snapshot({ badges: ["first_lesson"] }) });
  await setup();
  expect(screen.getByText("Marc")).toBeInTheDocument();
  expect(screen.getByText(fr.leaderboard.xp(120))).toBeInTheDocument();
  const items = await screen.findAllByRole("listitem");
  const badgeItems = items.filter((li) => within(li).queryByRole("button") && !within(li).queryByRole("heading", { level: 3 }));
  expect(badgeItems).toHaveLength(13);
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

test("voice selection persists and defaults to the Southern female voice", async () => {
  const { services, user } = await setup();
  expect(screen.getByRole("radio", { name: "Sud · Mỹ Duyên (femme)" })).toBeChecked();
  expect(screen.getAllByRole("radio", { name: /^(Sud|Nord|Voix du téléphone)/ })).toHaveLength(5);
  await user.click(screen.getByRole("radio", { name: "Nord · Phạm Tuyên (homme)" }));
  expect(useAppState.getState().settings.voice).toBe("north-m");
  await waitFor(async () => expect((await services.progress.getSettings()).voice).toBe("north-m"));
  expect(screen.getByRole("radio", { name: "Nord · Phạm Tuyên (homme)" })).toBeChecked();
});

test("previewing a voice speaks the sample with that voice without saving it", async () => {
  const { services, user } = await setup();
  const speak = vi.spyOn(services.tts, "speak");
  await user.click(screen.getByRole("button", { name: fr.profile.settings.voicePack.preview("Nord · Đoan Trang (femme)") }));
  expect(speak).toHaveBeenCalledWith("Chào bạn!", { rate: 1, voice: "north-f" });
  expect(useAppState.getState().settings.voice).toBe("south-f");
  expect((await services.progress.getSettings()).voice).toBe("south-f");
});

test("a preview that cannot play shows a toast", async () => {
  const { services, user } = await setup();
  vi.spyOn(services.tts, "speak").mockRejectedValue(new Error("tts_unavailable"));
  await user.click(screen.getByRole("button", { name: fr.profile.settings.voicePack.preview("Voix du téléphone") }));
  expect(await screen.findByText(fr.profile.settings.voicePack.previewError)).toBeInTheDocument();
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
  expect(JSON.parse(localStorage.getItem("tn-profile") ?? "null")).toEqual({ pseudo: "Marco", avatarEmoji: "🌸" });
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

test("the stats show the boss victory with the lives left, or not defeated yet", async () => {
  useAppState.setState({ snapshot: snapshot({ examBest: 92 }) });
  await setup();
  expect(await screen.findByText(fr.profile.stats.bossWon("Thủy Tinh", 4, 5))).toBeInTheDocument();
});

test("a legacy passing score (old 30-question test) still reads as a victory", async () => {
  useAppState.setState({ snapshot: snapshot({ examBest: 84 }) });
  await setup();
  expect(await screen.findByText(fr.profile.stats.bossWon("Thủy Tinh", 2, 5))).toBeInTheDocument();
  expect(screen.queryByText(fr.profile.stats.examNone)).toBeNull();
});

test("a score that is not a victory reads as not defeated yet", async () => {
  useAppState.setState({ snapshot: snapshot({ examBest: 36 }) });
  await setup();
  expect(await screen.findByText(fr.profile.stats.examNone)).toBeInTheDocument();
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
  localStorage.setItem("tn-theme", "dark");
  await user.click(screen.getByRole("button", { name: fr.profile.account.signOut.open }));
  await user.click(await screen.findByRole("button", { name: fr.profile.account.signOut.confirm }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  expect(localStorage.getItem("tn-theme")).toBeNull();
  expect(await services.progress.listEvents()).toEqual([]);
  expect(localStorage.getItem("tn-profile")).toBeNull();
  expect(useAppState.getState()).toMatchObject({ session: null, profile: null, snapshot: null });
});

test("account deletion requires typing SUPPRIMER, then clears everything", async () => {
  const { services, router, user } = await setup();
  await services.progress.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, NOW);
  await services.progress.saveSettings({ ...DEFAULT_SETTINGS, theme: "dark", onboardingDone: true });
  localStorage.setItem("tn-theme", "dark");
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
  expect(localStorage.getItem("tn-profile")).toBeNull();
  expect(localStorage.getItem("tn-theme")).toBeNull();
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
  expect(localStorage.getItem("tn-profile")).not.toBeNull();
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
  expect(localStorage.getItem("tn-profile")).toBeNull();
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
  expect(localStorage.getItem("tn-profile")).not.toBeNull();
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

test("changing the password calls setPassword, closes the sheet and shows the toast", async () => {
  const { services, user } = await setup();
  const spy = vi.spyOn(services.auth, "setPassword");
  await user.click(screen.getByRole("button", { name: fr.profile.settings.password.open }));
  await user.type(await screen.findByLabelText(fr.password.newLabel), "secret123");
  await user.type(screen.getByLabelText(fr.password.confirmLabel), "secret123");
  await user.click(screen.getByRole("button", { name: fr.password.submit }));
  expect(await screen.findByText(fr.profile.settings.password.updated)).toBeInTheDocument();
  expect(spy).toHaveBeenCalledWith("secret123");
  await waitFor(() => expect(screen.queryByLabelText(fr.password.newLabel)).not.toBeInTheDocument());
  expect(await services.auth.hasPassword()).toBe(true);
});

test("a short or mismatched password is refused without calling the server", async () => {
  const { services, user } = await setup();
  const spy = vi.spyOn(services.auth, "setPassword");
  await user.click(screen.getByRole("button", { name: fr.profile.settings.password.open }));
  await user.type(await screen.findByLabelText(fr.password.newLabel), "short");
  await user.type(screen.getByLabelText(fr.password.confirmLabel), "short");
  await user.click(screen.getByRole("button", { name: fr.password.submit }));
  expect(await screen.findByText(fr.password.tooShort)).toBeInTheDocument();
  await user.clear(screen.getByLabelText(fr.password.newLabel));
  await user.type(screen.getByLabelText(fr.password.newLabel), "secret123");
  await user.click(screen.getByRole("button", { name: fr.password.submit }));
  expect(await screen.findByText(fr.password.mismatch)).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalled();
});

test("a weak password rejected by the server shows the weak message and keeps the sheet open", async () => {
  const { services, user } = await setup();
  vi.spyOn(services.auth, "setPassword").mockRejectedValue(new WeakPasswordError());
  await user.click(screen.getByRole("button", { name: fr.profile.settings.password.open }));
  await user.type(await screen.findByLabelText(fr.password.newLabel), "secret123");
  await user.type(screen.getByLabelText(fr.password.confirmLabel), "secret123");
  await user.click(screen.getByRole("button", { name: fr.password.submit }));
  expect(await screen.findByText(fr.password.tooShort)).toBeInTheDocument();
  expect(screen.getByLabelText(fr.password.newLabel)).toBeInTheDocument();
});

test("being offline while changing the password shows the offline message", async () => {
  const { services, user } = await setup();
  vi.spyOn(services.auth, "setPassword").mockRejectedValue(new OfflineError());
  await user.click(screen.getByRole("button", { name: fr.profile.settings.password.open }));
  await user.type(await screen.findByLabelText(fr.password.newLabel), "secret123");
  await user.type(screen.getByLabelText(fr.password.confirmLabel), "secret123");
  await user.click(screen.getByRole("button", { name: fr.password.submit }));
  expect(await within(await screen.findByRole("dialog")).findByText(fr.profile.edit.offline)).toBeInTheDocument();
});

describe("rewards section", () => {
  const unlock = (services: Services, ids: string[]) =>
    Promise.all(ids.map((id) => services.progress.appendEvent({ type: "badge_unlocked", refId: id, xp: 0, payload: {} }, "2026-10-10T09:00:00.000Z")));
  const rewardCard = async (name: string) => (await screen.findByRole("heading", { name })).closest("li") as HTMLElement;

  async function setupRewards(unlocked: string[]) {
    useToastStore.setState({ toasts: [] });
    const services = createFakeServices({ clock: () => NOW });
    await unlock(services, unlocked);
    useAppState.setState({ wallet: await services.activity.getWallet() });
    return { ...(await setup(services)), services };
  }

  test("lists the 6 rewards, owned ones equippable, the others say how to earn them", async () => {
    await setupRewards(["ten_lessons"]);
    const jade = await rewardCard("Cadre jade");
    expect(within(jade).getByRole("button", { name: fr.rewards.equip })).toBeEnabled();
    expect(within(jade).getByRole("img", { name: fr.rewards.preview("Cadre jade") })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    const all = ["frame_bronze", "frame_jade", "frame_son_mai", "fx_ink", "fx_lightning", "fx_embers"];
    const badgeOf: Record<string, [string, string]> = {
      frame_bronze: ["Une semaine", "7 jours d'affilée."],
      frame_son_mai: ["Vainqueur de Thủy Tinh", "Bats le boss final."],
      fx_ink: ["Main de maître", "Réussis 5 leçons différentes sans aucune erreur."],
      fx_lightning: ["Excellence", "Bats le boss final en gardant au moins 4 vies."],
      fx_embers: ["Inarrêtable", "30 jours d'affilée."],
    };
    for (const id of all) {
      const name = fr.shop.items[id]?.name ?? "";
      const card = await rewardCard(name);
      expect(within(card).getByRole("img", { name: fr.rewards.preview(name) })).toBeInTheDocument();
      const locked = badgeOf[id];
      if (!locked) continue;
      expect(within(card).queryByRole("button")).toBeNull();
      expect(within(card).getByText(fr.rewards.lockedBy(...locked))).toBeInTheDocument();
    }
  });

  test("equipping a frame calls activity.equip and the header avatar shows it", async () => {
    const { services, user } = await setupRewards(["ten_lessons"]);
    const equip = vi.spyOn(services.activity, "equip");
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.equip }));
    expect(equip).toHaveBeenCalledWith("frame", "frame_jade");
    expect(await screen.findByText(fr.rewards.equippedToast)).toBeInTheDocument();
    await waitFor(() => expect(useAppState.getState().wallet?.equipped.frame).toBe("frame_jade"));
    const header = screen.getByRole("button", { name: fr.profile.editAria });
    expect(header.querySelector('[data-frame="frame_jade"]')).not.toBeNull();
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.unequip }));
    await waitFor(() => expect(useAppState.getState().wallet?.equipped.frame ?? null).toBeNull());
    expect(equip).toHaveBeenLastCalledWith("frame", null);
  });

  test("one frame and one effect at a time", async () => {
    const { user } = await setupRewards(["ten_lessons", "streak_7", "perfect_5", "streak_30"]);
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.equip }));
    await waitFor(() => expect(useAppState.getState().wallet?.equipped.frame).toBe("frame_jade"));
    await user.click(within(await rewardCard("Cadre bronze")).getByRole("button", { name: fr.rewards.equip }));
    await waitFor(() => expect(useAppState.getState().wallet?.equipped.frame).toBe("frame_bronze"));
    await user.click(within(await rewardCard("Volutes d'encre")).getByRole("button", { name: fr.rewards.equip }));
    await waitFor(() => expect(useAppState.getState().wallet?.equipped.profile_fx).toBe("fx_ink"));
    await user.click(within(await rewardCard("Braises")).getByRole("button", { name: fr.rewards.equip }));
    await waitFor(() => expect(useAppState.getState().wallet?.equipped).toMatchObject({ frame: "frame_bronze", profile_fx: "fx_embers" }));
    expect(screen.getByRole("button", { name: fr.profile.editAria }).querySelector("[data-fx]")).toHaveAttribute("data-fx", "fx_embers");
  });

  test("an equip failure shows the dedicated error", async () => {
    const { services, user } = await setupRewards(["ten_lessons"]);
    vi.spyOn(services.activity, "equip").mockRejectedValue(new Error("down"));
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.equip }));
    expect(await screen.findByText(fr.rewards.error)).toBeInTheDocument();
    expect(useAppState.getState().wallet?.equipped.frame ?? null).toBeNull();
    await waitFor(() => expect(within(screen.getByText("Cadre jade").closest("li") as HTMLElement).getByRole("button", { name: fr.rewards.equip })).toBeEnabled());
  });

  test("a refresh that fails after a successful equip is reported as an error", async () => {
    const { services, user } = await setupRewards(["ten_lessons"]);
    vi.spyOn(services.activity, "getWallet").mockRejectedValue(new Error("down"));
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.equip }));
    expect(await screen.findByText(fr.rewards.error)).toBeInTheDocument();
    expect(screen.queryByText(fr.rewards.equippedToast)).toBeNull();
  });

  test("a refused equip shows the error too", async () => {
    const { services, user } = await setupRewards(["ten_lessons"]);
    const wallet = await services.activity.getWallet();
    vi.spyOn(services.activity, "equip").mockResolvedValue({ ok: false, wallet });
    await user.click(within(await rewardCard("Cadre jade")).getByRole("button", { name: fr.rewards.equip }));
    expect(await screen.findByText(fr.rewards.error)).toBeInTheDocument();
  });
});
