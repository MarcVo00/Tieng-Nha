import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { StaticContentSource } from "@/adapters/content";
import { createFakeServices } from "@/adapters/fakes";
import { TabLayout } from "@/app/layouts/TabLayout";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import type { Services } from "@/app/services";
import changelog from "@/content/changelog.json";
import { ChangelogFileSchema } from "@/content/schema";
import { MeScreen, NewsScreen } from "@/features/profile";
import { fr } from "@/i18n/fr";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import "@/test/routerTestEnv";

const NOW = "2026-10-21T10:00:00.000Z";
const KEY = "tn-seen-version";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("tn-profile", JSON.stringify({ pseudo: "Marc", avatarEmoji: "🐉" }));
  useAppState.setState({
    ready: true,
    session: { userId: "me", email: "m@x.fr" },
    profile: { pseudo: "Marc", avatarEmoji: "🐉" },
    settings: { ...DEFAULT_SETTINGS, onboardingDone: true },
    snapshot: null,
    dueCount: 0,
  });
});
afterEach(() => vi.restoreAllMocks());

function mount(services: Services, route = "/me") {
  const router = createMemoryRouter(
    [
      {
        element: <TabLayout />,
        children: [
          { path: "/me", element: <MeScreen /> },
          { path: "/news", element: <NewsScreen /> },
        ],
      },
    ],
    { initialEntries: [route] },
  );
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ServicesProvider>,
  );
  return { router, user: userEvent.setup() };
}

async function signedIn(): Promise<Services> {
  const services = createFakeServices({ clock: () => NOW });
  await services.auth.verifyOtp("m@x.fr", "123456");
  return services;
}

describe("changelog content", () => {
  test("the bundled changelog is valid: newest first, semver, real dates", () => {
    const entries = ChangelogFileSchema.parse(changelog).entries;
    expect(entries.map((e) => e.version)).toEqual(["1.5.1", "1.5.0", "1.4.0", "1.3.0", "1.2.0", "1.1.0", "1.0.0"]);
    expect(entries.map((e) => e.date)).toEqual([
      "2026-10-21",
      "2026-10-21",
      "2026-10-20",
      "2026-10-19",
      "2026-10-17",
      "2026-10-15",
      "2026-10-11",
    ]);
  });

  test("an oldest-first changelog, a bad version or an impossible date is refused", () => {
    const [a, b] = changelog.entries;
    expect(ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [b, a] }).success).toBe(false);
    expect(
      ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [{ ...a, version: "1.5" }] }).success,
    ).toBe(false);
    expect(
      ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [{ ...a, date: "2026-02-31" }] }).success,
    ).toBe(false);
    expect(ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [{ ...a, items: [] }] }).success).toBe(
      false,
    );
  });

  test("French typography: a plain or no-break space before ? ! : ; is refused, U+202F is accepted", () => {
    const base = changelog.entries[0]!;
    const withItem = (item: string) => ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [{ ...base, items: [item] }] }).success;
    expect(withItem("Deux manches : un QCM")).toBe(false);
    expect(withItem("Deux manches : un QCM")).toBe(false);
    expect(withItem("Quoi ?")).toBe(false);
    expect(withItem("Deux manches : un QCM")).toBe(true);
    expect(ChangelogFileSchema.safeParse({ contentVersion: 1, entries: [{ ...base, title: "Titre !" }] }).success).toBe(false);
    for (const e of changelog.entries) for (const t of [e.title, ...e.items]) expect(t).not.toMatch(/[ \u00a0][?!:;]/);
  });

  test("1.10.0 is newer than 1.9.0 (numeric, not alphabetical)", () => {
    const base = changelog.entries[0]!;
    const ok = ChangelogFileSchema.safeParse({
      contentVersion: 1,
      entries: [
        { ...base, version: "1.10.0" },
        { ...base, version: "1.9.0" },
      ],
    });
    expect(ok.success).toBe(true);
  });

  test("__APP_VERSION__ equals package.json, and the newest changelog entry", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };
    expect(__APP_VERSION__).toBe(pkg.version);
    expect(__APP_VERSION__).toBe(ChangelogFileSchema.parse(changelog).entries[0]?.version);
  });

  test("the static source parses the changelog through its loader", async () => {
    const src = new StaticContentSource({
      lessons: {},
      dialogues: {},
      exam: async () => ({}),
      badges: async () => ({}),
      tree: async () => ({}),
      bosses: async () => ({}),
      shop: async () => ({}),
      changelog: async () => changelog,
    });
    expect((await src.getChangelog())[0]?.title).toBe("Chrono de l'énergie");
  });
});

describe("« Nouveautés »", () => {
  test("the Moi row shows the version and a dot until the page is opened", async () => {
    const { user } = mount(await signedIn());
    const row = await screen.findByRole("link", { name: new RegExp(`Nouveautés · v${__APP_VERSION__}`) });
    expect(row).toHaveAttribute("href", "/news");
    await waitFor(() => expect(within(row).getByTestId("news-dot")).toBeInTheDocument());
    expect(screen.getAllByTestId("tab-dot")).toHaveLength(1);

    await user.click(row);
    expect(await screen.findByRole("heading", { name: fr.news.title })).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe(__APP_VERSION__);
    await waitFor(() => expect(screen.queryByTestId("tab-dot")).not.toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: fr.news.back }));
    const back = await screen.findByRole("link", { name: new RegExp(`Nouveautés · v${__APP_VERSION__}`) });
    expect(within(back).queryByTestId("news-dot")).not.toBeInTheDocument();
  });

  test("no dot when the newest version was already seen", async () => {
    localStorage.setItem(KEY, __APP_VERSION__);
    mount(await signedIn());
    await screen.findByRole("link", { name: new RegExp(`Nouveautés · v`) });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("tab-dot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("news-dot")).not.toBeInTheDocument();
  });

  test("the screen lists the versions newest first and marks « Ta version »", async () => {
    mount(await signedIn(), "/news");
    const list = await screen.findByRole("list", { name: fr.news.listLabel });
    const versions = within(list)
      .getAllByText(/^Version \d/)
      .map((n) => n.textContent);
    expect(versions).toEqual(["1.5.1", "1.5.0", "1.4.0", "1.3.0", "1.2.0", "1.1.0", "1.0.0"].map(fr.news.version));
    expect(within(list).getAllByText(fr.news.current)).toHaveLength(1);
    const first = within(list).getAllByRole("listitem")[0];
    expect(within(first!).getByText(fr.news.current)).toBeInTheDocument();
    expect(within(first!).getByText("Chrono de l'énergie")).toBeInTheDocument();
    expect(within(first!).getByText("21 octobre 2026")).toBeInTheDocument();
  });

  test("storage that throws never crashes: the dot stays, the page opens", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { user } = mount(await signedIn(), "/me");
    const row = await screen.findByRole("link", { name: new RegExp("Nouveautés · v") });
    await waitFor(() => expect(within(row).getByTestId("news-dot")).toBeInTheDocument());
    await user.click(row);
    expect(await screen.findByRole("heading", { name: fr.news.title })).toBeInTheDocument();
    expect(await screen.findByText(fr.news.current)).toBeInTheDocument();
    expect(screen.getByTestId("tab-dot")).toBeInTheDocument();
  });

  test("a changelog that fails to load: the row still renders without a dot and the screen stays calm", async () => {
    const services = await signedIn();
    vi.spyOn(services.content, "getChangelog").mockRejectedValue(new Error("bad json"));
    const { user } = mount(services, "/me");
    const row = await screen.findByRole("link", { name: new RegExp("Nouveautés · v") });
    await new Promise((r) => setTimeout(r, 30));
    expect(within(row).queryByTestId("news-dot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tab-dot")).not.toBeInTheDocument();

    await user.click(row);
    expect(await screen.findByText(fr.news.error.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.app.error.retry })).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
