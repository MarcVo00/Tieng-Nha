import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { EnergyIndicator } from "@/app/EnergyIndicator";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState, useRefreshProgress } from "@/app/appState";
import type { Services } from "@/app/services";
import { ShopScreen } from "@/features/shop";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";
import { useToastStore } from "@/ui/Toast";
import { useEffect } from "react";

const NOW = "2026-10-14T10:00:00.000Z";

function Boot() {
  const refresh = useRefreshProgress();
  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);
  return null;
}

async function winExams(services: Services, n: number) {
  // 50 xu for the first win, then 20 each.
  for (let i = 0; i < n; i++) await services.activity.finishExam({ attemptId: `a${i}`, score: 90, noSpeaking: false });
}

function setup(services: Services, ui = <ShopScreen />) {
  useAppState.setState({ profile: { pseudo: "Marc", avatarEmoji: "🐉" }, wallet: null, energy: null });
  render(
    <ServicesProvider services={services}>
      <ToastViewport />
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Boot />
        {ui}
      </MemoryRouter>
    </ServicesProvider>,
  );
  return userEvent.setup();
}

const card = async (name: string) => (await screen.findByRole("heading", { name })).closest("li") as HTMLElement;

test("shows the balance as the hero", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  const { coins } = await services.activity.getWallet();
  expect(coins).toBeGreaterThanOrEqual(50);
  setup(services);
  expect(await screen.findByText(fr.shop.balance(coins))).toBeInTheDocument();
});

test("buys a frame after confirming, then offers to equip and unequip it", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  const { coins } = await services.activity.getWallet();
  const user = setup(services);
  const bronze = await card(fr.shop.items["frame_bronze"]?.name ?? "");
  await user.click(within(bronze).getByRole("button", { name: fr.shop.buy(40) }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(fr.shop.confirm.title("le cadre bronze", 40));
  await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
  expect(await screen.findByText(fr.shop.balance(coins - 40))).toBeInTheDocument();
  expect(await screen.findByText(fr.shop.bought)).toBeInTheDocument();
  await user.click(await within(bronze).findByRole("button", { name: fr.shop.equip }));
  await user.click(await within(bronze).findByRole("button", { name: fr.shop.equipped }));
  expect(await within(bronze).findByRole("button", { name: fr.shop.equip })).toBeEnabled();
});

test("disables what the player cannot afford", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services);
  const jade = await card(fr.shop.items["frame_jade"]?.name ?? "");
  expect(within(jade).getByRole("button", { name: fr.shop.noFunds })).toBeDisabled();
});

test("a full freeze stock disables the purchase", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 5); // 50 + 4 * 20 = 130
  await services.activity.purchase("streak_freeze");
  await services.activity.purchase("streak_freeze");
  setup(services);
  const freeze = await card(fr.shop.items["streak_freeze"]?.name ?? "");
  expect(within(freeze).getByRole("button", { name: fr.shop.stockFull })).toBeDisabled();
  expect(freeze).toHaveTextContent(fr.shop.stock(2, 2));
});

test("the refill is disabled while the energy is full", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  setup(services);
  const refill = await card(fr.shop.items["energy_refill"]?.name ?? "");
  await waitFor(() => expect(within(refill).getByRole("button", { name: fr.shop.energyFull })).toBeDisabled());
});

test("recharges the energy from the header sheet", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  await services.activity.startSession("boss", "boss_thuy_tinh"); // 5 -> 2
  const user = setup(services, <EnergyIndicator />);
  await user.click(await screen.findByRole("button", { name: fr.energy.label(2, 5) }));
  await user.click(await screen.findByRole("button", { name: fr.shop.refill(30) }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
  await waitFor(() => expect(useAppState.getState().energy?.current).toBe(5));
  await waitFor(() => expect(screen.queryByRole("button", { name: fr.shop.refill(30) })).toBeNull());
});

test("the refill confirmation is the only modal: Tab cycles its two buttons and Escape closes only it", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  await services.activity.startSession("boss", "boss_thuy_tinh");
  const user = setup(services, <EnergyIndicator />);
  await user.click(await screen.findByRole("button", { name: fr.energy.label(2, 5) }));
  await user.click(await screen.findByRole("button", { name: fr.shop.refill(30) }));
  const dialog = await screen.findByRole("alertdialog");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: fr.energy.title })).toBeNull());
  const cancel = within(dialog).getByRole("button", { name: fr.shop.confirm.cancel });
  const confirm = within(dialog).getByRole("button", { name: fr.shop.confirm.confirm });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  const seen = new Set<Element | null>();
  for (let i = 0; i < 4; i++) {
    seen.add(document.activeElement);
    await user.tab();
  }
  expect(seen).toEqual(new Set([cancel, confirm]));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(useAppState.getState().energy?.current).toBe(2);
  expect(screen.getByRole("button", { name: fr.energy.label(2, 5) })).toHaveFocus();
});

test("hides the sheet refill when the player is too poor", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await services.activity.startSession("boss", "boss_thuy_tinh");
  const user = setup(services, <EnergyIndicator />);
  await user.click(await screen.findByRole("button", { name: fr.energy.label(2, 5) }));
  await screen.findByRole("dialog", { name: fr.energy.title });
  expect(screen.queryByRole("button", { name: fr.shop.refill(30) })).toBeNull();
});

describe("purchase failures", () => {
  async function ask() {
    useToastStore.setState({ toasts: [] });
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 1);
    const { coins } = await services.activity.getWallet();
    const user = setup(services);
    const bronze = await card(fr.shop.items["frame_bronze"]?.name ?? "");
    await user.click(within(bronze).getByRole("button", { name: fr.shop.buy(40) }));
    const dialog = await screen.findByRole("alertdialog");
    return { services, user, bronze, dialog, coins };
  }

  async function expectRecovered(bronze: HTMLElement, coins: number) {
    expect(await screen.findByText(fr.shop.error)).toBeInTheDocument();
    expect(screen.queryByText(fr.shop.bought)).toBeNull();
    expect(screen.getByText(fr.shop.balance(coins))).toBeInTheDocument();
    await waitFor(() => expect(within(bronze).getByRole("button", { name: fr.shop.buy(40) })).toBeEnabled());
  }

  test("a refused purchase shows the error and changes nothing", async () => {
    const { services, user, bronze, dialog, coins } = await ask();
    const wallet = await services.activity.getWallet();
    vi.spyOn(services.activity, "purchase").mockResolvedValue({ ok: false, wallet });
    await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
    await expectRecovered(bronze, coins);
  });

  test("a purchase that throws shows the error and changes nothing", async () => {
    const { services, user, bronze, dialog, coins } = await ask();
    vi.spyOn(services.activity, "purchase").mockRejectedValue(new Error("disk full"));
    await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
    await expectRecovered(bronze, coins);
  });

  test("every buy and equip button is locked while a purchase is in flight", async () => {
    const { services, user, dialog } = await ask();
    const wallet = await services.activity.getWallet();
    let release: (v: { ok: boolean; wallet: typeof wallet }) => void = () => undefined;
    vi.spyOn(services.activity, "purchase").mockReturnValue(new Promise((resolve) => (release = resolve)));
    await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(within(row).getByRole("button")).toBeDisabled();
    release({ ok: false, wallet });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

test("each frame preview carries the frame name", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services);
  for (const id of ["frame_bronze", "frame_jade", "frame_son_mai"]) {
    const name = fr.shop.items[id]?.name ?? "";
    expect(await screen.findByRole("img", { name: fr.shop.preview(name) })).toBeInTheDocument();
  }
});

test("an equip failure shows the dedicated equip error", async () => {
  useToastStore.setState({ toasts: [] });
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  await services.activity.purchase("frame_bronze");
  const user = setup(services);
  vi.spyOn(services.activity, "equip").mockRejectedValueOnce(new Error("boom"));
  const bronze = await card(fr.shop.items["frame_bronze"]?.name ?? "");
  await user.click(await within(bronze).findByRole("button", { name: fr.shop.equip }));
  expect(await screen.findByText(fr.shop.equipError)).toBeInTheDocument();
  expect(screen.queryByText(fr.shop.error)).toBeNull();
});

test("an equipped frame is exposed as pressed and equipping shows a toast", async () => {
  useToastStore.setState({ toasts: [] });
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  await services.activity.purchase("frame_bronze");
  const user = setup(services);
  const bronze = await card(fr.shop.items["frame_bronze"]?.name ?? "");
  await user.click(await within(bronze).findByRole("button", { name: fr.shop.equip }));
  expect(await screen.findByText(fr.shop.equippedToast)).toBeInTheDocument();
  expect(await within(bronze).findByRole("button", { name: fr.shop.equipped })).toHaveAttribute("aria-pressed", "true");
  await user.click(within(bronze).getByRole("button", { name: fr.shop.equipped }));
  expect(await screen.findByText(fr.shop.removedToast)).toBeInTheDocument();
});

test("a failed wallet load offers a retry instead of an endless skeleton", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  const spy = vi.spyOn(services.activity, "getWallet").mockRejectedValue(new Error("down"));
  const user = setup(services);
  const retry = await screen.findByRole("button", { name: fr.app.error.retry });
  spy.mockRestore();
  await user.click(retry);
  expect(await screen.findByText(fr.shop.playTitle)).toBeInTheDocument();
});
