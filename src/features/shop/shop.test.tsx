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

test("arena items (Kim bài) are not listed in the xu shop", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 9);
  setup(services);
  await screen.findByRole("heading", { name: fr.shop.items["streak_freeze"]?.name ?? "" });
  for (const id of ["hat_tay_son", "acc_con_vo", "outfit_hoi_vat"]) {
    expect(screen.queryByText(fr.shop.items[id]?.name ?? id)).not.toBeInTheDocument();
  }
  expect(screen.queryByText(fr.shop.themes["arene"] ?? "arene")).not.toBeInTheDocument();
});

test("buys a streak freeze after confirming", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await winExams(services, 1);
  const { coins } = await services.activity.getWallet();
  const user = setup(services);
  const freeze = await card(fr.shop.items["streak_freeze"]?.name ?? "");
  await user.click(within(freeze).getByRole("button", { name: fr.shop.buy(50) }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(fr.shop.confirm.title("un gel de série", 50));
  await user.click(within(dialog).getByRole("button", { name: fr.shop.confirm.confirm }));
  expect(await screen.findByText(fr.shop.balance(coins - 50))).toBeInTheDocument();
  expect(await screen.findByText(fr.shop.bought)).toBeInTheDocument();
});

test("disables what the player cannot afford", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services);
  const freeze = await card(fr.shop.items["streak_freeze"]?.name ?? "");
  expect(within(freeze).getByRole("button", { name: fr.shop.noFunds })).toBeDisabled();
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
    const bronze = await card(fr.shop.items["streak_freeze"]?.name ?? "");
    await user.click(within(bronze).getByRole("button", { name: fr.shop.buy(50) }));
    const dialog = await screen.findByRole("alertdialog");
    return { services, user, bronze, dialog, coins };
  }

  async function expectRecovered(bronze: HTMLElement, coins: number) {
    expect(await screen.findByText(fr.shop.error)).toBeInTheDocument();
    expect(screen.queryByText(fr.shop.bought)).toBeNull();
    expect(screen.getByText(fr.shop.balance(coins))).toBeInTheDocument();
    await waitFor(() => expect(within(bronze).getByRole("button", { name: fr.shop.buy(50) })).toBeEnabled());
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

test("reward items are not for sale", async () => {
  const services = createFakeServices({ clock: () => NOW });
  setup(services);
  await card(fr.shop.items["streak_freeze"]?.name ?? "");
  for (const id of ["frame_bronze", "frame_jade", "frame_son_mai", "fx_ink", "fx_lightning", "fx_embers"]) {
    expect(screen.queryByRole("heading", { name: fr.shop.items[id]?.name ?? "" })).toBeNull();
  }
  expect(screen.getByText(new RegExp(fr.rewards.hint))).toBeInTheDocument();
  expect(screen.getByRole("link", { name: fr.rewards.shopLink })).toHaveAttribute("href", "/me#me-rewards");
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

describe("dark legends section and try-on", () => {
  const NAMES = ["hat_thuy_tinh", "aura_waves", "outfit_son_tinh", "acc_thuan_thien"].map((id) => fr.shop.items[id]?.name ?? "");
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  const tryOnName = (name: string) => new RegExp(`^${fr.shop.tryOn.prefix} ${escapeRe(name)}`);
  const open = (name: string) => screen.findByRole("button", { name: tryOnName(name) });
  const types = async (services: Services) => (await services.progress.listEvents()).map((e) => e.type);

  test("lists the consumables first, then the themed items by price, each previewed on the current hero", async () => {
    const services = createFakeServices({ clock: () => NOW });
    setup(services);
    const heading = await screen.findByRole("heading", { name: fr.shop.themes["legendes_sombres"] ?? "" });
    const play = screen.getByRole("heading", { name: fr.shop.playTitle });
    expect(play.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const section = heading.closest("section") as HTMLElement;
    const buttons = within(section).getAllByRole("button");
    buttons.forEach((b, i) => expect(b).toHaveAccessibleName(tryOnName(NAMES[i] ?? "")));
    expect(buttons).toHaveLength(NAMES.length);
    // The price is part of the accessible name (not hidden by an aria-label).
    expect(buttons[0]).toHaveAccessibleName(/xu$/);
    expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(NAMES.map((n) => `${fr.shop.tryOn.prefix} ${n}`));
    const ids = ["hat_thuy_tinh", "aura_waves", "outfit_son_tinh", "acc_thuan_thien"];
    buttons.forEach((b, i) => expect(b.querySelector("[data-look]")?.getAttribute("data-look")).toContain(ids[i]));
  });

  test("the preview adds the item to what the hero already wears", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 6);
    await services.activity.purchase("hat_thuy_tinh");
    await services.activity.equip("hat", "hat_thuy_tinh");
    setup(services);
    const sword = await open(NAMES[3] ?? "");
    const look = sword.querySelector("[data-look]")?.getAttribute("data-look") ?? "";
    expect(look).toContain("hat_thuy_tinh");
    expect(look).toContain("acc_thuan_thien");
  });

  test("opening and closing the sheet sends no event; the only action is a disabled buy when poor", async () => {
    const services = createFakeServices({ clock: () => NOW });
    const user = setup(services);
    await user.click(await open(NAMES[0] ?? ""));
    const sheet = await screen.findByRole("dialog", { name: NAMES[0] ?? "" });
    expect(within(sheet).getAllByRole("button")).toHaveLength(1);
    expect(within(sheet).getByRole("button", { name: fr.shop.tryOn.buy(60) })).toBeDisabled();
    expect(sheet.querySelector("[data-look]")).not.toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await types(services)).toEqual([]);
  });

  test("buying confirms inside the sheet, then purchases and equips (two events)", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 6);
    const before = (await types(services)).length;
    const user = setup(services);
    await user.click(await open(NAMES[0] ?? ""));
    const sheet = await screen.findByRole("dialog", { name: NAMES[0] ?? "" });
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.buy(60) }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sheet).toHaveTextContent(fr.shop.confirm.title("la couronne des marées", 60));
    expect((await types(services)).length).toBe(before);
    await user.click(within(sheet).getByRole("button", { name: fr.shop.confirm.confirm }));
    await screen.findByText(fr.shop.bought);
    expect(screen.getAllByText(fr.shop.bought)).toHaveLength(1); // one purchase, one toast
    expect((await types(services)).slice(before)).toEqual(["item_purchased", "item_equipped"]);
    expect((await services.activity.getWallet()).equipped["hat"]).toBe("hat_thuy_tinh");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test.each([
    ["refuses", (s: Services) => vi.spyOn(s.activity, "equip").mockResolvedValue({ ok: false, wallet: {} as never })],
    ["throws", (s: Services) => vi.spyOn(s.activity, "equip").mockRejectedValue(new Error("boom"))],
  ])("when the equip %s, the item is still owned and the toast says so", async (_n, breakEquip) => {
    useToastStore.setState({ toasts: [] });
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 6);
    const user = setup(services);
    breakEquip(services);
    await user.click(await open(NAMES[0] ?? ""));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.buy(60) }));
    await user.click(within(sheet).getByRole("button", { name: fr.shop.confirm.confirm }));
    expect(await screen.findByText(fr.shop.tryOn.boughtNotEquipped)).toBeInTheDocument();
    expect((await services.activity.getWallet()).inventory).toContain("hat_thuy_tinh");
    await waitFor(() => expect(screen.getByText(fr.shop.tryOn.owned)).toBeInTheDocument());
  });

  test("an owned item offers Equiper, then Retirer", async () => {
    useToastStore.setState({ toasts: [] });
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 6);
    await services.activity.purchase("aura_waves");
    const user = setup(services);
    await user.click(await open(NAMES[1] ?? ""));
    let sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.equip }));
    await waitFor(async () => expect((await services.activity.getWallet()).equipped["aura"]).toBe("aura_waves"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(await open(NAMES[1] ?? ""));
    sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.unequip }));
    await waitFor(async () => expect((await services.activity.getWallet()).equipped["aura"]).toBeUndefined());
  });

  test("keyboard: Tab stays inside the sheet, also on the confirm step; Escape closes it alone", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 6);
    const user = setup(services);
    const trigger = await open(NAMES[0] ?? "");
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog");
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 3; i++) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.buy(60) }));
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((await services.activity.getWallet()).inventory).not.toContain("hat_thuy_tinh");
    expect(trigger).toHaveFocus();
  });
});

describe("characters section", () => {
  const IDS = ["char_kiem_khach", "char_phap_su"];
  const NAMES = IDS.map((id) => fr.shop.items[id]?.name ?? "");
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  const open = (name: string) => screen.findByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} ${escapeRe(name)}`) });

  test("sits between the consumables and the dark legends, previewed on the current look", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 9);
    await services.activity.purchase("hat_thuy_tinh");
    await services.activity.equip("hat", "hat_thuy_tinh");
    setup(services);
    const chars = await screen.findByRole("heading", { name: fr.shop.characters.title });
    const play = screen.getByRole("heading", { name: fr.shop.playTitle });
    const legends = screen.getByRole("heading", { name: fr.shop.themes["legendes_sombres"] ?? "" });
    expect(play.compareDocumentPosition(chars) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chars.compareDocumentPosition(legends) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const section = chars.closest("section") as HTMLElement;
    const buttons = within(section).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons.forEach((b, i) => {
      const look = b.querySelector("[data-look]")?.getAttribute("data-look") ?? "";
      expect(look.split(" ")[0]).toBe(IDS[i]);
      expect(look).toContain("hat_thuy_tinh");
    });
    expect(within(play.closest("section") as HTMLElement).queryByText(NAMES[0] ?? "")).toBeNull();
  });

  test("the try-on buys in the sheet, then equips the character", async () => {
    const services = createFakeServices({ clock: () => NOW });
    await winExams(services, 9);
    const user = setup(services);
    await user.click(await open(NAMES[0] ?? ""));
    const sheet = await screen.findByRole("dialog", { name: NAMES[0] ?? "" });
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.buy(200) }));
    await user.click(within(sheet).getByRole("button", { name: fr.shop.confirm.confirm }));
    await screen.findByText(fr.shop.bought);
    const wallet = await services.activity.getWallet();
    expect(wallet.inventory).toContain("char_kiem_khach");
    expect(wallet.equipped["character"]).toBe("char_kiem_khach");
  });
});

