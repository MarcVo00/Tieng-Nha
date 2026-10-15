import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { EnergyIndicator } from "@/app/EnergyIndicator";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState, useRefreshProgress } from "@/app/appState";
import type { Services } from "@/app/services";
import { LessonDoneScreen } from "@/features/lessons";
import { ShopScreen } from "@/features/shop";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";
import { useEffect } from "react";

const NOW = "2026-10-14T10:00:00.000Z";

function Boot() {
  const refresh = useRefreshProgress();
  useEffect(() => {
    void refresh();
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

test("hides the sheet refill when the player is too poor", async () => {
  const services = createFakeServices({ clock: () => NOW });
  await services.activity.startSession("boss", "boss_thuy_tinh");
  const user = setup(services, <EnergyIndicator />);
  await user.click(await screen.findByRole("button", { name: fr.energy.label(2, 5) }));
  await screen.findByRole("dialog", { name: fr.energy.title });
  expect(screen.queryByRole("button", { name: fr.shop.refill(30) })).toBeNull();
});

test("the lesson done screen shows the coins earned", async () => {
  const services = createFakeServices({ clock: () => NOW });
  const r = await services.activity.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
  useAppState.setState({ wallet: null });
  render(
    <ServicesProvider services={services}>
      <MemoryRouter
        initialEntries={[{ pathname: "/lesson/l05/done", state: { ...r, accuracy: 1, perfect: true } }]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/lesson/:id/done" element={<LessonDoneScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  expect(await screen.findByText(fr.shop.gained(r.coinsGained))).toBeInTheDocument();
  expect(r.coinsGained).toBeGreaterThanOrEqual(15);
});
