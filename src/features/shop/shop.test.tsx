import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFakeServices, FakeGachaGateway } from "@/adapters/fakes";
import { EnergyIndicator } from "@/app/EnergyIndicator";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { readPendingPulls, runGachaPull, useRecoveredPulls } from "@/app/useGachaPulls";
import { OfflineError } from "@/domain/errors";
import type { Services } from "@/app/services";
import { ShopScreen } from "@/features/shop";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";
import { useToastStore } from "@/ui/Toast";
import { useEffect } from "react";

const NOW = "2026-10-14T10:00:00.000Z";

beforeEach(() => {
  localStorage.clear();
  useRecoveredPulls.setState({ recovered: [] });
});
afterEach(() => vi.restoreAllMocks());

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
  expect(dialog).toHaveTextContent(fr.shop.confirm.title("un gel de série", 50), { normalizeWhitespace: false });
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
  expect(freeze).toHaveTextContent(fr.shop.stock(2, 2), { normalizeWhitespace: false });
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
  await user.click(await screen.findByRole("button", { name: fr.energy.labelWithWait(2, 5, 3, 0) }));
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
  await user.click(await screen.findByRole("button", { name: fr.energy.labelWithWait(2, 5, 3, 0) }));
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
  expect(screen.getByRole("button", { name: fr.energy.labelWithWait(2, 5, 3, 0) })).toHaveFocus();
});

test("hides the sheet refill when the player is too poor", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await services.activity.startSession("boss", "boss_thuy_tinh");
  const user = setup(services, <EnergyIndicator />);
  await user.click(await screen.findByRole("button", { name: fr.energy.labelWithWait(2, 5, 3, 0) }));
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

describe("gacha banner and set", () => {
  const THEME = "legendes_sombres";
  const SET = ["hat_thuy_tinh", "aura_waves", "outfit_son_tinh", "acc_thuan_thien", "char_kiem_khach", "char_phap_su", "acc_giao_tre", "hat_khan_vanh", "outfit_ao_chen", "aura_suong_mu", "acc_quat_sat", "hat_mu_chien"];
  const nameOf = (id: string) => fr.shop.items[id]?.name ?? id;
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
  const tryOnName = (id: string) => new RegExp(`^${fr.shop.tryOn.prefix} ${escapeRe(nameOf(id))}`);
  const open = (id: string) => screen.findByRole("button", { name: tryOnName(id) });
  const types = async (services: Services) => (await services.progress.listEvents()).map((e) => e.type);
  const banner = () => screen.findByRole("heading", { name: fr.shop.themes[THEME] ?? "" }).then((h) => h.closest("section") as HTMLElement);
  const make = async (coins = 0) => {
    const services = createFakeServices({ clock: () => NOW }, { gachaRng: () => 0 }); // always the first common: acc_giao_tre
    if (coins > 0) await services.activity.demoGrant(coins, 0);
    return services;
  };

  test("shows the theme banner: art, progress, guarantee, both pulls and the rates", async () => {
    const services = await make(500);
    setup(services);
    const section = await banner();
    expect(within(section).getByText(fr.gacha.ownedCount(0, 12))).toBeInTheDocument();
    expect(within(section).getByText(fr.gacha.pityLine(40))).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeEnabled();
    expect(within(section).getByRole("button", { name: fr.gacha.pullTen(360) })).toBeEnabled();
    expect(within(section).getByRole("button", { name: fr.gacha.rates })).toBeInTheDocument();
    expect(fr.gacha.pullOne(40)).toBe("1 tirage — 40 xu");
    expect(fr.gacha.pullTen(360)).toBe("10 tirages — 360 xu");
    expect(fr.gacha.pityLine(23)).toBe("Légendaire garanti dans 23 tirages");
    expect(fr.gacha.ownedCount(7, 12)).toBe("7/12 obtenus");
  });

  test("gacha items are never sold: no « Acheter » in the themed section, consumables keep theirs", async () => {
    const services = await make(500);
    setup(services);
    const section = await banner();
    expect(within(section).queryByRole("button", { name: /Acheter/ })).toBeNull();
    for (const b of within(section).getAllByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} `) })) expect(b).not.toHaveTextContent(/xu/); // no price on a piece
    const freeze = await card(nameOf("streak_freeze"));
    expect(within(freeze).getByRole("button", { name: fr.shop.buy(50) })).toBeEnabled();
  });

  test("the set lists the 12 pieces, rarest first, each with its rarity badge; missing ones are silhouettes", async () => {
    const services = await make();
    setup(services);
    const section = await banner();
    const buttons = within(section).getAllByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} `) });
    expect(buttons).toHaveLength(12);
    expect(buttons[0]).toHaveAccessibleName(tryOnName("char_phap_su"));
    expect(buttons[0]?.querySelector('[data-rarity="legendary"]')).not.toBeNull();
    expect(buttons[0]).toHaveAttribute("data-owned", "false");
    expect(within(buttons[0] as HTMLElement).getByText(fr.gacha.notOwned)).toBeInTheDocument();
    const ids = buttons.map((b) => (b.querySelector("[data-look]")?.getAttribute("data-look") ?? "").split(" ").find((t) => SET.includes(t)));
    expect([...ids].sort()).toEqual([...SET].sort());
  });

  test("try-on of a missing piece is a preview without any purchase: a hint, no buy, a close button, no event", async () => {
    const services = await make(500);
    const user = setup(services);
    await user.click(await open("hat_thuy_tinh"));
    const sheet = await screen.findByRole("dialog", { name: nameOf("hat_thuy_tinh") });
    expect(sheet.querySelector("[data-look]")).not.toBeNull();
    expect(within(sheet).getByText(fr.gacha.sheetHint)).toBeInTheDocument();
    expect(within(sheet).getByText(fr.shop.rarities.rare)).toBeInTheDocument();
    expect(within(sheet).getAllByRole("button")).toHaveLength(1);
    expect(within(sheet).queryByRole("button", { name: /Acheter/ })).toBeNull();
    await user.click(within(sheet).getByRole("button", { name: fr.gacha.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await types(services)).toEqual(["demo_grant"]);
  });

  test("the preview adds the piece to what the hero already wears", async () => {
    const services = await make(100);
    await runGachaPull(services, THEME, 1); // acc_giao_tre
    await services.activity.equip("accessory", "acc_giao_tre");
    const user = setup(services);
    await user.click(await open("hat_mu_chien"));
    const sheet = await screen.findByRole("dialog");
    const look = sheet.querySelector("[data-look]")?.getAttribute("data-look") ?? "";
    expect(look).toContain("acc_giao_tre");
    expect(look).toContain("hat_mu_chien");
  });

  test("an owned piece offers Équiper, then Retirer", async () => {
    const services = await make(100);
    await runGachaPull(services, THEME, 1);
    const user = setup(services);
    const mine = await open("acc_giao_tre");
    expect(mine).toHaveAttribute("data-owned", "true");
    await user.click(mine);
    let sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(fr.shop.tryOn.owned)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.equip }));
    await waitFor(async () => expect((await services.activity.getWallet()).equipped["accessory"]).toBe("acc_giao_tre"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(await open("acc_giao_tre"));
    sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: fr.shop.tryOn.unequip }));
    await waitFor(async () => expect((await services.activity.getWallet()).equipped["accessory"]).toBeUndefined());
  });

  test("keyboard: the sheet traps Tab, Escape closes it alone and returns the focus to the piece", async () => {
    const services = await make();
    const user = setup(services);
    const trigger = await open("hat_thuy_tinh");
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog");
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 3; i++) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  test("« Taux » opens the four rates with their refunds and the guarantees", async () => {
    const services = await make();
    const user = setup(services);
    await user.click(await screen.findByRole("button", { name: fr.gacha.rates }));
    const sheet = await screen.findByRole("dialog", { name: fr.gacha.ratesTitle });
    const rows = within(sheet).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      `${fr.shop.rarities.common}${fr.gacha.refund(8)}${fr.gacha.ratePercent(60)}`,
      `${fr.shop.rarities.rare}${fr.gacha.refund(20)}${fr.gacha.ratePercent(28)}`,
      `${fr.shop.rarities.epic}${fr.gacha.refund(50)}${fr.gacha.ratePercent(10)}`,
      `${fr.shop.rarities.legendary}${fr.gacha.refund(120)}${fr.gacha.ratePercent(2)}`,
    ]);
    expect(within(sheet).getByText(fr.gacha.pityRule(40))).toBeInTheDocument();
    expect(within(sheet).getByText(fr.gacha.tenRule)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: fr.gacha.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("a single pull: the result list, the new balance, the progress and the guarantee counter", async () => {
    const services = await make(100);
    const user = setup(services);
    const section = await banner();
    await user.click(within(section).getByRole("button", { name: fr.gacha.pullOne(40) }));
    const sheet = await screen.findByRole("dialog", { name: fr.gacha.resultLabel(40) });
    const lines = within(sheet).getAllByRole("listitem");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent(nameOf("acc_giao_tre"));
    expect(lines[0]).toHaveTextContent(fr.shop.rarities.common);
    expect(lines[0]).toHaveTextContent(fr.gacha.resultNew, { normalizeWhitespace: false });
    expect(await screen.findByText(fr.shop.balance(60))).toBeInTheDocument();
    expect(await types(services)).toEqual(["demo_grant", "gacha_pulled"]);
    await user.click(within(sheet).getByRole("button", { name: fr.gacha.resultContinue }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(await banner()).getByText(fr.gacha.ownedCount(1, 12))).toBeInTheDocument();
    expect(within(await banner()).getByText(fr.gacha.pityLine(39))).toBeInTheDocument();
  });

  test("a x10 pull lists ten lines, duplicates with their refund, and costs 360 xu minus the refunds", async () => {
    const services = await make(400);
    const user = setup(services);
    const section = await banner();
    await user.click(within(section).getByRole("button", { name: fr.gacha.pullTen(360) }));
    const sheet = await screen.findByRole("dialog", { name: fr.gacha.resultLabel(360) });
    const lines = within(sheet).getAllByRole("listitem");
    expect(lines).toHaveLength(10);
    const wallet = await services.activity.getWallet();
    const event = (await services.progress.listEvents()).find((e) => e.type === "gacha_pulled");
    const refunds = ((event?.payload["items"] as { refund: number }[]) ?? []).reduce((n, i) => n + i.refund, 0);
    expect(refunds).toBeGreaterThan(0);
    expect(wallet.coins).toBe(400 - 360 + refunds);
    expect(within(sheet).getByText(fr.gacha.resultTotal(refunds))).toBeInTheDocument();
    expect(within(sheet).getAllByText(/^Doublon · \+\d+ xu$/).length).toBeGreaterThan(0);
  });

  test("not enough xu: both pulls are disabled with the reason", async () => {
    const services = await make(0);
    setup(services);
    const section = await banner();
    expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeDisabled();
    expect(within(section).getByRole("button", { name: fr.gacha.pullTen(360) })).toBeDisabled();
    expect(within(section).getByRole("status")).toHaveTextContent(fr.gacha.missing(40));
  });

  test("between 40 and 359 xu: the single pull works, the x10 is disabled and says what is missing", async () => {
    const services = await make(100);
    setup(services);
    const section = await banner();
    expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeEnabled();
    const ten = within(section).getByRole("button", { name: fr.gacha.pullTen(360) });
    expect(ten).toBeDisabled();
    expect(within(section).getByRole("status")).toHaveTextContent(fr.gacha.missing(260));
    expect(ten).toHaveAccessibleDescription(fr.gacha.missing(260));
  });

  test("offline: the pulls are disabled with « Connecte-toi pour tirer. »", async () => {
    const services = await make(500);
    (services.gacha as FakeGachaGateway).online = false;
    setup(services);
    const section = await banner();
    await waitFor(() => expect(within(section).getByRole("status")).toHaveTextContent(fr.gacha.offline));
    expect(fr.gacha.offline).toBe("Connecte-toi pour tirer.");
    expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeDisabled();
    expect(within(section).getByRole("button", { name: fr.gacha.pullTen(360) })).toBeDisabled();
  });

  test("the check uses min(local, server): a lower server balance blocks the pull", async () => {
    const services = await make(500);
    (services.gacha as FakeGachaGateway).serverCoins = 10;
    setup(services);
    const section = await banner();
    await waitFor(() => expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeDisabled());
    expect(within(section).getByRole("status")).toHaveTextContent(fr.gacha.missing(30));
  });

  test("the server balance is re-checked at the tap: when it dropped meanwhile nothing is pulled", async () => {
    const services = await make(500);
    const gacha = services.gacha as FakeGachaGateway;
    const user = setup(services);
    const section = await banner();
    const one = await within(section).findByRole("button", { name: fr.gacha.pullOne(40) });
    await waitFor(() => expect(one).toBeEnabled());
    gacha.serverCoins = 5;
    const pull = vi.spyOn(gacha, "pull");
    await user.click(one);
    expect(await within(section).findByText(fr.gacha.missing(35))).toBeInTheDocument();
    expect(pull).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a refusal from the server shows a message and spends nothing", async () => {
    const services = await make(500);
    const gacha = services.gacha as FakeGachaGateway;
    vi.spyOn(gacha, "pull").mockResolvedValue({ ok: false, error: "unknown_theme" });
    const user = setup(services);
    const section = await banner();
    await user.click(await within(section).findByRole("button", { name: fr.gacha.pullOne(40) }));
    expect(await within(section).findByText(fr.gacha.error)).toBeInTheDocument();
    expect(await types(services)).toEqual(["demo_grant"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the connection dropping mid-pull keeps the id pending and says the pull will reappear", async () => {
    const services = await make(500);
    const gacha = services.gacha as FakeGachaGateway;
    vi.spyOn(gacha, "pull").mockRejectedValue(new OfflineError());
    const user = setup(services);
    const section = await banner();
    await user.click(await within(section).findByRole("button", { name: fr.gacha.pullOne(40) }));
    expect(await within(section).findByText(fr.gacha.interrupted)).toBeInTheDocument();
    expect(readPendingPulls()).toHaveLength(1);
    await waitFor(() => expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeDisabled()); // unreachable
  });

  test("while a pull runs, every other button of the screen is locked", async () => {
    const services = await make(500);
    const gacha = services.gacha as FakeGachaGateway;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const real = FakeGachaGateway.prototype.pull;
    vi.spyOn(gacha, "pull").mockImplementation(async (...a) => {
      await gate;
      return real.call(gacha, ...a);
    });
    const user = setup(services);
    const section = await banner();
    await user.click(await within(section).findByRole("button", { name: fr.gacha.pullTen(360) }));
    await waitFor(() => expect(within(section).getByRole("button", { name: fr.gacha.pullOne(40) })).toBeDisabled());
    for (const b of within(section).getAllByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} `) })) expect(b).toBeDisabled();
    release();
    await screen.findByRole("dialog", { name: fr.gacha.resultLabel(360) });
  });

  test("a complete set shows « Panoplie complète ! » and the pulls still work (every item is a refunded duplicate)", async () => {
    const services = createFakeServices({ clock: () => NOW }); // random draws
    await services.activity.demoGrant(100000, 0);
    const owned = async () => (await services.activity.getWallet()).inventory.filter((id) => SET.includes(id));
    for (let i = 0; i < 40 && (await owned()).length < 12; i++) await runGachaPull(services, THEME, 10);
    expect(await owned()).toHaveLength(12);
    const user = setup(services);
    const section = await banner();
    expect(within(section).getByText(fr.gacha.complete)).toBeInTheDocument();
    expect(within(section).getByText(fr.gacha.ownedCount(12, 12))).toBeInTheDocument();
    const before = (await services.activity.getWallet()).coins;
    await user.click(within(section).getByRole("button", { name: fr.gacha.pullOne(40) }));
    const sheet = await screen.findByRole("dialog", { name: fr.gacha.resultLabel(40) });
    expect(within(sheet).getByText(/^Doublon · \+\d+ xu$/)).toBeInTheDocument();
    const after = (await services.activity.getWallet()).coins;
    expect(after).toBeGreaterThan(before - 40);
  }, 30000);

  test("a pull recovered after a crash is shown once as « Tirage récupéré »", async () => {
    const services = await make(100);
    const res = await services.gacha.pull("lost", THEME, 1);
    if (!res.ok) throw new Error("unreachable");
    await services.activity.claimGachaPulls([res.pull]);
    useRecoveredPulls.setState({ recovered: [res.pull] });
    setup(services);
    const sheet = await screen.findByRole("dialog", { name: fr.gacha.resultLabel(40) });
    expect(within(sheet).getByRole("heading", { name: fr.gacha.recovered })).toBeInTheDocument();
    expect(useRecoveredPulls.getState().recovered).toEqual([]);
  });
});
