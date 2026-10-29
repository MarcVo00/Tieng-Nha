import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createFakeServices, FakeSoundPlayer } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { SoundSync } from "@/app/SoundSync";
import { useAppState } from "@/app/appState";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import type { GachaPull, GachaPullItem, ShopItem } from "@/domain/types";
import { omenDuration, REVEAL } from "@/features/shop/gachaReveal";
import { DragonSword } from "@/features/shop/signatures/DragonSword";
import { SIG } from "@/features/shop/signatures/dragonSchedule";
import { SIG as GUARDIAN_SIG } from "@/features/shop/signatures/talismanSchedule";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

// The real registry: L'épée du dragon plays its own scene (spec more-banners §4.4). Only setTimeout is faked (the
// scene's beats and sounds all run on it), so the scene is stepped through beat by beat; clicks are plain events.

const SWORD = fr.shop.items.acc_kiem_rong?.name ?? "acc_kiem_rong";
const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false, refund = 0): GachaPullItem => ({ itemId, rarity, duplicate, refund });
const pullOf = (items: GachaPullItem[]): GachaPull => ({
  id: `d-${items.length}`,
  theme: "seigneur_des_mers",
  count: items.length,
  cost: items.length === 1 ? 40 : 360,
  items,
  createdAt: "2026-10-28T10:00:00.000Z",
  claimed: true,
});
const ms = (s: number) => Math.round(s * 1000);
let shop: ShopItem[] = [];

beforeAll(async () => {
  shop = await createFakeServices().content.getShop();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Steps the clock in 20 ms slices, each its own act: a timer set by a render (the next beat) is then run in turn. */
async function advance(s: number) {
  for (let left = ms(s); left > 0; left -= 20) await act(() => vi.advanceTimersByTimeAsync(Math.min(20, left)));
}

function fakeSound() {
  const services = createFakeServices();
  const sound = services.sound;
  if (!(sound instanceof FakeSoundPlayer)) throw new Error("expected the fake sound player");
  return { services, sound };
}

async function show(pull: GachaPull) {
  const { services, sound } = fakeSound();
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS, sound: true } });
  render(
    <ServicesProvider services={services}>
      <SoundSync />
      <XinXamScene pull={pull} items={shop} baseLook={{ character: "hero" }} onClose={() => undefined} />
    </ServicesProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: fr.gacha.resultLabel(pull.cost) });
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await advance(REVEAL.shake + omenDuration("legendary") + 0.1);
  expect(dialog).toHaveAttribute("data-phase", "cards");
  return { sound, dialog };
}

const cues = (sound: FakeSoundPlayer, prefix = "") => sound.played.map((p) => p.cue).filter((c) => c.startsWith(prefix));
const FX_NODES = "[data-fx='dragon'], [data-fx='blade'], [data-fx='vein'], [data-fx='glow']";

test("its card turns: the dragon coils with a roar, dives into the blade, it rings, then the sword appears on the hero", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_dinh_ba", "common"), item("acc_kiem_rong", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(2) }));
  expect(dialog).toHaveAttribute("data-phase", "signature");
  expect(dialog.querySelector("[data-focus] [data-signature='acc_kiem_rong']")).not.toBeNull();
  // The status line is its own, read aloud: what is happening on this stage.
  expect(within(dialog).getByRole("status")).toHaveTextContent(fr.gacha.scene.signatures.acc_kiem_rong ?? "");
  expect(fr.gacha.scene.signatures.acc_kiem_rong).toBeTruthy();
  expect(within(dialog).queryByRole("heading", { name: SWORD })).toBeNull();
  expect(dialog.querySelector("[data-fx='blade']")).not.toBeNull(); // the sword waits on the altar

  // The dragon rises out of the altar, roaring.
  await advance(SIG.rise + 0.05);
  expect(dialog.querySelectorAll("[data-fx='dragon']")).toHaveLength(12);
  expect(cues(sound, "sig.")).toEqual(["sig.roar"]);

  // It dives: the veins light one after the other.
  await advance(SIG.ring - SIG.rise - 0.1);
  expect(dialog.querySelectorAll("[data-fx='vein']")).toHaveLength(3);
  expect(cues(sound, "sig.")).toEqual(["sig.roar"]);

  // The ring: the dragon is all inside the blade.
  await advance(0.1);
  expect(dialog.querySelectorAll("[data-fx='dragon']")).toHaveLength(0);
  expect(dialog.querySelector("[data-fx='glow']")).not.toBeNull();
  expect(cues(sound, "sig.")).toEqual(["sig.roar", "sig.blade"]);
  expect(dialog).toHaveAttribute("data-phase", "signature");

  // The end: the sword appears on the hero and its card rings; nothing of the scene is left.
  await advance(SIG.end - SIG.ring);
  expect(dialog).toHaveAttribute("data-phase", "focus");
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(dialog.querySelectorAll(FX_NODES)).toHaveLength(0);
  expect(within(dialog).getByRole("heading", { name: SWORD })).toBeInTheDocument();
  expect(dialog.querySelector("[data-focus] [data-look~='acc_kiem_rong']")).not.toBeNull();
  expect(cues(sound).filter((c) => c.startsWith("sig.") || c === "gacha.flip.legendary")).toEqual(["sig.roar", "sig.blade", "gacha.flip.legendary"]);
});

test("« Passer » during its signature: the recap at once, every sound stopped, the scene unmounted and silent", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_kiem_rong", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  await advance(SIG.rise + 0.5);
  expect(dialog.querySelector("[data-signature='acc_kiem_rong']")).not.toBeNull();
  const before = sound.stopped;
  const played = sound.played.length;
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(sound.stopped).toBeGreaterThan(before);
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(dialog.querySelectorAll(FX_NODES)).toHaveLength(0);
  expect(within(dialog).getByText(SWORD)).toBeInTheDocument();
  await advance(SIG.end);
  expect(sound.played.length).toBe(played); // no ring, no flip after the skip
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test("the app goes to the background mid-signature: the roar stops, and no ring or flip sounds later", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_kiem_rong", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  await advance(SIG.rise + 0.3);
  const before = { stopped: sound.stopped, played: sound.played.length };
  expect(cues(sound, "sig.")).toEqual(["sig.roar"]);
  try {
    setVisibility("hidden");
    expect(sound.stopped).toBeGreaterThan(before.stopped);
    await advance(SIG.end + 0.5); // the scene's timers still run behind the app
    expect(sound.played.length).toBe(before.played);
    expect(cues(sound, "sig.blade")).toEqual([]);
  } finally {
    setVisibility("visible");
  }
});

test("the sword and the guardian in one pull: each card plays its own signature when it is turned", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_kiem_rong", "legendary"), item("acc_dinh_ba", "common"), item("char_phap_su", "legendary")]));
  for (const [n, id, name] of [
    [1, "acc_kiem_rong", SWORD],
    [3, "char_phap_su", fr.shop.items.char_phap_su?.name ?? ""],
  ] as const) {
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(n) }));
    expect(dialog).toHaveAttribute("data-phase", "signature");
    expect(dialog.querySelectorAll("[data-signature]")).toHaveLength(1);
    expect(dialog.querySelector(`[data-signature='${id}']`)).not.toBeNull();
    await advance(Math.max(SIG.end, GUARDIAN_SIG.end) + 0.05);
    expect(dialog).toHaveAttribute("data-phase", "focus");
    expect(within(dialog).getByRole("heading", { name })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
    await advance(REVEAL.flip);
  }
  expect(cues(sound, "sig.blade")).toHaveLength(1);
  expect(cues(sound, "sig.gong")).toHaveLength(1);
  expect(cues(sound, "gacha.flip.legendary")).toHaveLength(2);
});

test("a new onEnd identity never restarts the scene", async () => {
  const { services, sound } = fakeSound();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(
    <ServicesProvider services={services}>
      <DragonSword onEnd={first} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.ring);
  rerender(
    <ServicesProvider services={services}>
      <DragonSword onEnd={second} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.end - SIG.ring + 0.05);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(cues(sound, "sig.roar")).toHaveLength(1);
});

test("reduced motion: the signature ends at once and draws nothing, in silence", () => {
  const { services, sound } = fakeSound();
  const done = vi.fn();
  const { container } = render(
    <ServicesProvider services={services}>
      <DragonSword onEnd={done} reduced />
    </ServicesProvider>,
  );
  expect(done).toHaveBeenCalledTimes(1);
  expect(container.querySelector("[data-signature]")).toBeNull();
  expect(sound.played).toEqual([]);
});
