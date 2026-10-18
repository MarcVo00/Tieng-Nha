import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import type { Services } from "@/app/services";
import { createFakeServices, FakeLeaderboardRepository } from "@/adapters/fakes";
import type { LeaderboardRow } from "@/domain/types";
import { LeaderboardScreen, PublicProfileScreen } from "@/features/leaderboard";
import { fr } from "@/i18n/fr";

const NOW = "2026-10-10T10:00:00.000Z";
const clock = () => NOW;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function fakeOf(services: Services): FakeLeaderboardRepository {
  if (!(services.leaderboard instanceof FakeLeaderboardRepository)) throw new Error("expected the fake leaderboard");
  return services.leaderboard;
}

function setup(route = "/leaderboard", services: Services = createFakeServices({ clock })) {
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/u/:userId" element={<PublicProfileScreen />} />
          <Route path="/me" element={<p>Mon profil</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return services;
}

const row = (userId: string, pseudo: string, xp: number, isMe = false): LeaderboardRow => ({
  userId, pseudo, avatarEmoji: "🌸", xp, streak: 0, lessonsDone: 1, frame: null, isMe,
});

beforeEach(() => {
  useAppState.setState({ session: null });
});

test("podium shows the top 3, the list starts at rank 4 and my row is highlighted", async () => {
  setup();
  const podium = await screen.findByRole("list", { name: fr.leaderboard.podiumLabel });
  const places = within(podium).getAllByRole("link");
  expect(places.map((p) => p.getAttribute("aria-label"))).toEqual([
    expect.stringContaining("Rang 2 : Chú Tư"),
    expect.stringContaining("Rang 1 : Bà Ngoại"),
    expect.stringContaining("Rang 3 : Bé Na"),
  ]);
  const list = screen.getByRole("list", { name: fr.leaderboard.listLabel });
  const rows = within(list).getAllByRole("link");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Anh Hai");
  expect(rows[0]).toHaveTextContent("4");
  expect(rows[1]).toHaveTextContent("Moi");
  expect(rows[1]).toHaveTextContent(fr.leaderboard.you);
  expect(rows[1]).toHaveClass("bg-surface-2", "border-primary");
  expect(rows[1]).toHaveAttribute("href", "/me");
  expect(rows[0]).not.toHaveClass("border-primary");
});

test("switching tabs refetches and caches each period", async () => {
  const services = setup();
  const spy = vi.spyOn(services.leaderboard, "list");
  await screen.findByRole("list", { name: fr.leaderboard.podiumLabel });
  await userEvent.click(screen.getByRole("tab", { name: fr.leaderboard.all }));
  await waitFor(() => expect(spy).toHaveBeenCalledWith("all"));
  expect(screen.getByRole("tab", { name: fr.leaderboard.all })).toHaveAttribute("aria-selected", "true");
  await waitFor(async () => expect(await services.progress.getCachedLeaderboard("all")).toMatchObject({ fetchedAt: NOW }));
  expect(await services.progress.getCachedLeaderboard("week")).toMatchObject({ fetchedAt: NOW });
});

test("a slow response for the previous tab never replaces the current tab's rows", async () => {
  let releaseWeek: (rows: LeaderboardRow[]) => void = () => undefined;
  const weekRows = [row("w1", "SemaineUn", 9), row("w2", "SemaineDeux", 8), row("w3", "SemaineTrois", 7)];
  const allRows = [row("a1", "TotalUn", 90), row("a2", "TotalDeux", 80), row("a3", "TotalTrois", 70)];
  const base = createFakeServices({ clock });
  const leaderboard: Services["leaderboard"] = {
    list: (period) =>
      period === "week"
        ? new Promise<LeaderboardRow[]>((resolve) => {
            releaseWeek = resolve;
          })
        : Promise.resolve(allRows),
    getPublicProfile: (id) => base.leaderboard.getPublicProfile(id),
  };
  setup("/leaderboard", createFakeServices({ clock, progress: base.progress, leaderboard }));
  await userEvent.click(await screen.findByRole("tab", { name: fr.leaderboard.all }));
  await screen.findByRole("link", { name: /TotalUn/ });
  await act(async () => releaseWeek(weekRows));
  expect(screen.getByRole("link", { name: /TotalUn/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /SemaineUn/ })).not.toBeInTheDocument();
});

test("offline with a cached board keeps the rows and says how old they are", async () => {
  const services = createFakeServices({ clock });
  await services.progress.cacheLeaderboard("week", [row("c1", "EnCache", 50), row("c2", "Deux", 40), row("c3", "Trois", 30)], "2026-10-10T09:55:00.000Z");
  fakeOf(services).online = false;
  setup("/leaderboard", services);
  expect(await screen.findByText("Hors ligne · mis à jour il y a 5 minutes")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /EnCache/ })).toBeInTheDocument();
});

test("offline with nothing cached shows an empty state", async () => {
  const services = createFakeServices({ clock });
  fakeOf(services).online = false;
  setup("/leaderboard", services);
  expect(await screen.findByText(fr.leaderboard.offlineEmpty.title)).toBeInTheDocument();
});

test("the refresh button and a pull from the top both refetch; a pull while scrolled or upward does not", async () => {
  const services = setup();
  const spy = vi.spyOn(services.leaderboard, "list");
  await screen.findByRole("list", { name: fr.leaderboard.podiumLabel });
  spy.mockClear();
  await userEvent.click(screen.getByRole("button", { name: fr.leaderboard.refresh }));
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: fr.leaderboard.refresh })).toBeEnabled());

  const pull = (from: number, to: number) => {
    fireEvent.touchStart(window, { touches: [{ clientY: from }] });
    fireEvent.touchMove(window, { touches: [{ clientY: to }] });
    fireEvent.touchEnd(window);
  };
  Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
  pull(0, 200);
  expect(spy).toHaveBeenCalledTimes(1);
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  pull(200, 20);
  expect(spy).toHaveBeenCalledTimes(1);
  pull(0, 200);
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
});

test("my row is pinned above the tab bar when it scrolls out of view", async () => {
  let notify: (visible: boolean) => void = () => undefined;
  class FakeObserver {
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      notify = (visible) => cb([{ isIntersecting: visible }]);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  try {
    setup();
    await screen.findByRole("list", { name: fr.leaderboard.podiumLabel });
    expect(document.querySelectorAll("[aria-hidden='true'].shadow-raised")).toHaveLength(0);
    act(() => notify(false));
    await waitFor(() => expect(document.querySelectorAll("[aria-hidden='true'].shadow-raised")).toHaveLength(1));
  } finally {
    vi.unstubAllGlobals();
  }
});

test("tapping a bot opens its public profile", async () => {
  setup();
  await userEvent.click(await screen.findByRole("link", { name: /Anh Hai/ }));
  expect(await screen.findByRole("heading", { level: 1, name: "Anh Hai" })).toBeInTheDocument();
  expect(screen.getByTestId("where")).toHaveTextContent("/u/bot_anh_hai");
  expect(screen.getByText(fr.publicProfile.lessonsTitle)).toBeInTheDocument();
  expect(screen.getByText(fr.publicProfile.examNone)).toBeInTheDocument();
});

test("a profile shows its lesson count and boss victory", async () => {
  const base = createFakeServices({ clock });
  const leaderboard: Services["leaderboard"] = {
    list: (period) => base.leaderboard.list(period),
    getPublicProfile: async () => ({
      userId: "x", pseudo: "Xuân", avatarEmoji: "🐯", xpTotal: 200, xpWeek: 50, streak: 3,
      lessonsDone: ["l01", "l02"], dialoguesDone: [], badges: ["first_lesson"], examBest: 92, frame: null, fx: null,
    }),
  };
  setup("/u/x", createFakeServices({ clock, content: base.content, leaderboard }));
  expect(await screen.findByRole("heading", { level: 1, name: "Xuân" })).toBeInTheDocument();
  expect(await screen.findByText(fr.publicProfile.bossWon("Thủy Tinh", 4, 5))).toBeInTheDocument();
  expect(screen.getByText(fr.publicProfile.lessonsSummary(2))).toBeInTheDocument();
  expect(screen.getAllByText(fr.ui.badge.locked, { exact: false }).length).toBeGreaterThan(0);
});

test("a profile renders its equipped effect", async () => {
  const base = createFakeServices({ clock });
  const leaderboard: Services["leaderboard"] = {
    list: (period) => base.leaderboard.list(period),
    getPublicProfile: async () => ({
      userId: "x", pseudo: "Xuân", avatarEmoji: "🐯", xpTotal: 200, xpWeek: 50, streak: 3,
      lessonsDone: [], dialoguesDone: [], badges: [], examBest: null, frame: null, fx: "fx_embers",
    }),
  };
  setup("/u/x", createFakeServices({ clock, content: base.content, leaderboard }));
  await screen.findByRole("heading", { level: 1, name: "Xuân" });
  expect(document.querySelector('[data-fx="fx_embers"]')).not.toBeNull();
});

test("a profile with a legacy passing score reads as a victory", async () => {
  const base = createFakeServices({ clock });
  const leaderboard: Services["leaderboard"] = {
    list: (period) => base.leaderboard.list(period),
    getPublicProfile: async () => ({
      userId: "x", pseudo: "Xuân", avatarEmoji: "🐯", xpTotal: 200, xpWeek: 50, streak: 3,
      lessonsDone: ["l01"], dialoguesDone: [], badges: [], examBest: 84, frame: null, fx: null,
    }),
  };
  setup("/u/x", createFakeServices({ clock, content: base.content, leaderboard }));
  expect(await screen.findByText(fr.publicProfile.bossWon("Thủy Tinh", 2, 5))).toBeInTheDocument();
  expect(screen.queryByText(fr.publicProfile.examNone)).toBeNull();
});

test("my own session id redirects to /me", async () => {
  useAppState.setState({ session: { userId: "uid-1", email: "a@b.c" } });
  setup("/u/uid-1");
  expect(await screen.findByText("Mon profil")).toBeInTheDocument();
});

test("an id carried by my cached leaderboard row redirects to /me", async () => {
  const services = createFakeServices({ clock });
  await services.progress.cacheLeaderboard("all", [row("me", "Moi", 5, true)], NOW);
  setup("/u/me", services);
  expect(await screen.findByText("Mon profil")).toBeInTheDocument();
});

test("an unknown profile shows a not-found state", async () => {
  setup("/u/nobody");
  expect(await screen.findByText(fr.publicProfile.notFound.title)).toBeInTheDocument();
});

test("a profile opened offline shows an offline state", async () => {
  const services = createFakeServices({ clock });
  fakeOf(services).online = false;
  setup("/u/bot_anh_hai", services);
  expect(await screen.findByText(fr.publicProfile.offline.title)).toBeInTheDocument();
});
