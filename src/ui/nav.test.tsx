import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { SegmentedNav, TabBar, type TabItem } from "@/ui";
import "@/test/routerTestEnv";

const ITEMS = (extra: Partial<Record<string, Partial<TabItem>>> = {}): TabItem[] => [
  { to: "/", label: fr.app.tabs.learn, icon: "home", ...extra["/"] },
  { to: "/review", label: fr.app.tabs.review, icon: "review", badge: 3 },
  {
    to: "/leaderboard",
    label: fr.app.tabs.arena,
    icon: "trophy",
    alsoActiveOn: ["/duels", "/arena", "/u"],
    ...extra["/leaderboard"],
  },
  { to: "/shop", label: fr.app.tabs.shop, icon: "coin" },
  { to: "/me", label: fr.app.tabs.me, icon: "user", ...extra["/me"] },
];

function renderBar(route: string, items = ITEMS()) {
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TabBar items={items} />
    </MemoryRouter>,
  );
}

test("the tab bar has the five tabs in order with their routes", () => {
  renderBar("/");
  const links = within(screen.getByRole("navigation", { name: fr.ui.nav.label })).getAllByRole("link");
  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/review", "/leaderboard", "/shop", "/me"]);
  expect(links[0]).toHaveTextContent("Apprendre");
  expect(links[2]).toHaveTextContent("Arène");
  expect(links[3]).toHaveTextContent("Boutique");
});

test.each(["/leaderboard", "/duels", "/arena", "/u/abc"])("« Arène » is the active tab on %s", (route) => {
  renderBar(route);
  const arena = screen.getByRole("link", { name: /Arène/ });
  expect(arena).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Boutique" })).not.toHaveAttribute("aria-current");
});

test("« Arène » is not active on /me", () => {
  renderBar("/me");
  expect(screen.getByRole("link", { name: /Arène/ })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: /Moi/ })).toHaveAttribute("aria-current", "page");
});

test("the Arène badge speaks the duels to play and a dot can mark « Moi »", () => {
  renderBar(
    "/",
    ITEMS({
      "/leaderboard": { badge: 2, badgeLabel: fr.duels.entry.pending(2) },
      "/me": { dot: true, dotLabel: "Nouveautés" },
    }),
  );
  expect(screen.getByRole("link", { name: /Arène.*2 duels à jouer/ })).toBeInTheDocument();
  expect(screen.getAllByTestId("tab-dot")).toHaveLength(1);
});

test("5 labels never wrap, so they fit at 320 px", () => {
  renderBar("/");
  for (const label of ["Apprendre", "Révision", "Arène", "Boutique", "Moi"]) {
    expect(screen.getByText(label).className).toContain("whitespace-nowrap");
  }
  // 320 / 5 = 64 px per tab; each link is a full-height flex child that can shrink.
  expect(screen.getAllByRole("listitem")[0]?.className).toContain("min-w-0");
});

test("SegmentedNav marks the current segment with aria-current and links the other", () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SegmentedNav
        label="x"
        current="/duels"
        items={[
          { to: "/leaderboard", label: "Classement" },
          { to: "/duels", label: "Duels", badge: 2, badgeLabel: "2 duels à jouer" },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /Duels/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Classement" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "Classement" })).toHaveAttribute("href", "/leaderboard");
  expect(screen.getByText("Duels").closest("a")?.className).toContain("whitespace-nowrap");
});
