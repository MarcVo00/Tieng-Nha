import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices, FakeDuelGateway } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState, useRefreshProgress } from "@/app/appState";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import { ArenaScreen } from "@/features/duels";
import { MeScreen } from "@/features/profile";
import { ShopScreen } from "@/features/shop";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";
import { useEffect } from "react";
import "@/test/routerTestEnv";

const NOW = "2026-10-20T10:00:00.000Z";
const IDS = ["hat_tay_son", "acc_con_vo", "outfit_hoi_vat"];
const name = (id: string) => fr.shop.items[id]?.name ?? id;

function Boot() {
  const refresh = useRefreshProgress();
  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);
  return null;
}

async function earn(services: Services, kimBai: number) {
  await services.progress.appendEvent({ type: "duel_settled", refId: `d${kimBai}`, xp: 0, payload: { kimBai } }, NOW);
}

const gateway = (s: Services): FakeDuelGateway => {
  if (!(s.duels instanceof FakeDuelGateway)) throw new Error("expected the fake duel gateway");
  return s.duels;
};

function setup(services: Services, route = "/arena") {
  useAppState.setState({ profile: { pseudo: "Marc", avatarEmoji: "🐉" }, wallet: null, energy: null });
  render(
    <ServicesProvider services={services}>
      <ToastViewport />
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Boot />
        <Routes>
          <Route path="/arena" element={<ArenaScreen />} />
          <Route path="/shop" element={<ShopScreen />} />
          <Route path="/me" element={<MeScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return userEvent.setup();
}

const cardButton = (id: string) => screen.findByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} ${name(id)}`) });
const events = async (s: Services) => (await s.progress.listEvents()).filter((e) => e.type === "item_purchased");

beforeEach(() => localStorage.clear());
afterEach(cleanup);

test("lists exactly the 3 Kim bài items with a balance", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  setup(services);
  for (const id of IDS) expect(await cardButton(id)).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  expect(screen.getAllByText(fr.arena.balance(10)).length).toBeGreaterThan(0);
  expect(screen.queryByText(name("streak_freeze"))).not.toBeInTheDocument();
});

test("buys with local 10 and server 10, then wears the item", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  const user = setup(services);
  await user.click(await cardButton("hat_tay_son"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.arena.buy(6) }));
  await user.click(await within(sheet).findByRole("button", { name: fr.shop.confirm.confirm }));
  await waitFor(() => expect(useAppState.getState().wallet?.equipped["hat"]).toBe("hat_tay_son"));
  expect(useAppState.getState().wallet?.kimBai).toBe(4);
  expect(await events(services)).toHaveLength(1);
});

test("local 10 but server 4: serverBehind and no event", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  gateway(services).serverKimBai = 4;
  const user = setup(services);
  await user.click(await cardButton("hat_tay_son"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.arena.buy(6) }));
  await user.click(await within(sheet).findByRole("button", { name: fr.shop.confirm.confirm }));
  expect(await within(sheet).findByText(fr.arena.serverBehind)).toBeInTheDocument();
  expect(await events(services)).toHaveLength(0);
  expect(useAppState.getState().wallet?.kimBai).toBe(10);
});

test("a double confirm in the same frame buys exactly once, without an error", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  const user = setup(services);
  await user.click(await cardButton("hat_tay_son"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.arena.buy(6) }));
  const confirm = await within(sheet).findByRole("button", { name: fr.shop.confirm.confirm });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => expect(useAppState.getState().wallet?.equipped["hat"]).toBe("hat_tay_son"));
  expect(await events(services)).toHaveLength(1);
  expect(screen.queryByText(fr.arena.error)).not.toBeInTheDocument();
});

test("has a back link to the duels hub", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services);
  expect(await screen.findByRole("link", { name: fr.arena.back })).toHaveAttribute("href", "/duels");
});

test("offline: needOnline and no event", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  gateway(services).online = false;
  const user = setup(services);
  await user.click(await cardButton("hat_tay_son"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.arena.buy(6) }));
  await user.click(await within(sheet).findByRole("button", { name: fr.shop.confirm.confirm }));
  expect(await within(sheet).findByText(fr.arena.needOnline)).toBeInTheDocument();
  expect(await events(services)).toHaveLength(0);
});

test("the server call failing with OfflineError also shows needOnline", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  vi.spyOn(services.duels, "balance").mockRejectedValue(new OfflineError());
  const user = setup(services);
  await user.click(await cardButton("acc_con_vo"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.arena.buy(8) }));
  await user.click(await within(sheet).findByRole("button", { name: fr.shop.confirm.confirm }));
  expect(await within(sheet).findByText(fr.arena.needOnline)).toBeInTheDocument();
  expect(await events(services)).toHaveLength(0);
});

test("not enough Kim bài: the buy button is disabled with the reason", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 5);
  const user = setup(services);
  await user.click(await cardButton("outfit_hoi_vat"));
  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).getByRole("button", { name: fr.arena.buy(10) })).toBeDisabled();
  expect(within(sheet).getByText(fr.arena.notEnough)).toBeInTheDocument();
});

test("an owned item is worn and removed with the equip toggle", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 10);
  await services.activity.purchase("hat_tay_son");
  const user = setup(services);
  await user.click(await cardButton("hat_tay_son"));
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.equip }));
  await waitFor(() => expect(useAppState.getState().wallet?.equipped["hat"]).toBe("hat_tay_son"));
  await user.click(await cardButton("hat_tay_son"));
  const again = await screen.findByRole("dialog");
  await user.click(within(again).getByRole("button", { name: fr.shop.tryOn.unequip }));
  await waitFor(() => expect(useAppState.getState().wallet?.equipped["hat"]).toBeUndefined());
});

test("the xu shop still hides the arena items", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services, "/shop");
  await screen.findByRole("heading", { name: fr.shop.items["streak_freeze"]?.name ?? "" });
  for (const id of IDS) expect(screen.queryByText(name(id))).not.toBeInTheDocument();
});

test("« Moi » shows the Kim bài balance", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await earn(services, 7);
  setup(services, "/me");
  expect(await screen.findByText(fr.arena.balance(7))).toBeInTheDocument();
});
