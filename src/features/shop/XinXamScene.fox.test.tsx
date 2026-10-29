import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createFakeServices, FakeSoundPlayer } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { SoundSync } from "@/app/SoundSync";
import { useAppState } from "@/app/appState";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import type { GachaPull, GachaPullItem, ShopItem } from "@/domain/types";
import { omenDuration, REVEAL } from "@/features/shop/gachaReveal";
import { NineTailFox } from "@/features/shop/signatures/NineTailFox";
import { LANTERN_COUNT, outAt, SIG } from "@/features/shop/signatures/foxSchedule";
import { SIG as DRAGON_SIG } from "@/features/shop/signatures/dragonSchedule";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

// The real registry: La renarde à neuf queues plays her own scene (spec more-banners §4.4). Only setTimeout is faked (the
// scene's beats and sounds all run on it), so the scene is stepped through beat by beat; clicks are plain events.

const FOX = fr.shop.items.char_ho_ly?.name ?? "char_ho_ly";
const SWORD = fr.shop.items.acc_kiem_rong?.name ?? "acc_kiem_rong";
const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false, refund = 0): GachaPullItem => ({ itemId, rarity, duplicate, refund });
const pullOf = (items: GachaPullItem[]): GachaPull => ({
  id: `f-${items.length}`,
  theme: "esprits_de_la_nuit",
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
const FX_NODES = "[data-fx^='fox-']";
const count = (root: HTMLElement, fx: string) => root.querySelectorAll(`[data-fx='${fx}']`).length;

test("her card turns: the lanterns go out one by one, nine tails of cold fire fan out, the bells, then she appears", async () => {
  const { sound, dialog } = await show(pullOf([item("hat_thuy_tinh", "rare"), item("char_ho_ly", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(2) }));
  expect(dialog).toHaveAttribute("data-phase", "signature");
  expect(dialog.querySelector("[data-focus] [data-signature='char_ho_ly']")).not.toBeNull();
  // The status line is its own, read aloud: what is happening on this stage.
  expect(within(dialog).getByRole("status")).toHaveTextContent(fr.gacha.scene.signatures.char_ho_ly ?? "");
  expect(fr.gacha.scene.signatures.char_ho_ly).toBeTruthy();
  expect(within(dialog).queryByRole("heading", { name: FOX })).toBeNull();
  // The lanterns hang there, and light up a frame later.
  expect(count(dialog, "fox-lantern")).toBe(LANTERN_COUNT);
  await advance(0.1);
  expect(count(dialog, "fox-light")).toBe(LANTERN_COUNT);

  // They go out one by one, each with a breath.
  for (let i = 0; i < LANTERN_COUNT; i++) {
    await advance(outAt(i) - (i === 0 ? 0.1 : outAt(i - 1)));
    expect(cues(sound, "sig."), `lantern ${i}`).toEqual(Array<string>(i + 1).fill("sig.lantern"));
  }
  expect(cues(sound, "sig.foxfire")).toEqual([]); // her fire has not caught yet

  // In the dark, nine tails of fire fan out behind her, with a crackle of cold fire.
  await advance(SIG.fan - outAt(LANTERN_COUNT - 1) + 0.05);
  expect(count(dialog, "fox-light")).toBe(0); // every lantern is out
  expect(count(dialog, "fox-tail")).toBe(9);
  expect(count(dialog, "fox-silhouette")).toBe(1);
  expect(cues(sound, "sig.").slice(LANTERN_COUNT)).toEqual(["sig.foxfire"]);

  // The bells: her eyes open.
  await advance(SIG.bells - SIG.fan);
  expect(cues(sound, "sig.").at(-1)).toBe("sig.bells");
  expect(count(dialog, "fox-eyes")).toBe(1);
  expect(dialog).toHaveAttribute("data-phase", "signature");

  // The end: she appears, her card rings; nothing of the scene is left.
  await advance(SIG.end - SIG.bells);
  expect(dialog).toHaveAttribute("data-phase", "focus");
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(dialog.querySelectorAll(FX_NODES)).toHaveLength(0);
  expect(within(dialog).getByRole("heading", { name: FOX })).toBeInTheDocument();
  expect(dialog.querySelector("[data-focus] [data-look~='char_ho_ly']")).not.toBeNull();
  expect(cues(sound).filter((c) => c.startsWith("sig.") || c === "gacha.flip.legendary")).toEqual([
    ...Array<string>(LANTERN_COUNT).fill("sig.lantern"),
    "sig.foxfire",
    "sig.bells",
    "gacha.flip.legendary",
  ]);
});

test("« Passer » during her signature: the recap at once, every sound stopped, the scene unmounted and silent", async () => {
  const { sound, dialog } = await show(pullOf([item("char_ho_ly", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  await advance(SIG.fan + 0.2);
  expect(dialog.querySelector("[data-signature='char_ho_ly']")).not.toBeNull();
  const before = sound.stopped;
  const played = sound.played.length;
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(sound.stopped).toBeGreaterThan(before);
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(dialog.querySelectorAll(FX_NODES)).toHaveLength(0);
  expect(within(dialog).getByText(FOX)).toBeInTheDocument();
  await advance(SIG.end);
  expect(sound.played.length).toBe(played); // no bells, no flip after the skip
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test("the app goes to the background between two lanterns: sounds stop, and no breath, crackle or bell sounds later", async () => {
  const { sound, dialog } = await show(pullOf([item("char_ho_ly", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  await advance(outAt(1) + 0.05);
  const before = { stopped: sound.stopped, played: sound.played.length };
  expect(cues(sound, "sig.")).toEqual(["sig.lantern", "sig.lantern"]);
  try {
    setVisibility("hidden");
    expect(sound.stopped).toBeGreaterThan(before.stopped);
    await advance(SIG.end + 0.5); // the scene's timers still run behind the app
    expect(sound.played.length).toBe(before.played);
    expect(cues(sound, "sig.foxfire")).toEqual([]);
  } finally {
    setVisibility("visible");
  }
});

test("the sword and the fox in one pull: each card plays its own signature when it is turned", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_kiem_rong", "legendary"), item("hat_thuy_tinh", "rare"), item("char_ho_ly", "legendary")]));
  for (const [n, id, name] of [
    [1, "acc_kiem_rong", SWORD],
    [3, "char_ho_ly", FOX],
  ] as const) {
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(n) }));
    expect(dialog).toHaveAttribute("data-phase", "signature");
    expect(dialog.querySelectorAll("[data-signature]")).toHaveLength(1);
    expect(dialog.querySelector(`[data-signature='${id}']`)).not.toBeNull();
    // Nothing of the other scene on this card.
    if (id === "acc_kiem_rong") expect(dialog.querySelectorAll(FX_NODES)).toHaveLength(0);
    else expect(dialog.querySelectorAll("[data-fx='dragon'], [data-fx='blade']")).toHaveLength(0);
    await advance(Math.max(SIG.end, DRAGON_SIG.end) + 0.05);
    expect(dialog).toHaveAttribute("data-phase", "focus");
    expect(within(dialog).getByRole("heading", { name })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
    await advance(REVEAL.flip);
  }
  expect(cues(sound, "sig.blade")).toHaveLength(1);
  expect(cues(sound, "sig.bells")).toHaveLength(1);
  expect(cues(sound, "sig.lantern")).toHaveLength(LANTERN_COUNT);
  expect(cues(sound, "gacha.flip.legendary")).toHaveLength(2);
});

test("a new onEnd identity never restarts the scene", async () => {
  const { services, sound } = fakeSound();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(
    <ServicesProvider services={services}>
      <NineTailFox onEnd={first} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.bells);
  rerender(
    <ServicesProvider services={services}>
      <NineTailFox onEnd={second} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.end - SIG.bells + 0.05);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(cues(sound, "sig.foxfire")).toHaveLength(1);
  expect(cues(sound, "sig.lantern")).toHaveLength(LANTERN_COUNT);
});

test("reduced motion: the signature ends at once and draws nothing, in silence", () => {
  const { services, sound } = fakeSound();
  const done = vi.fn();
  const { container } = render(
    <ServicesProvider services={services}>
      <NineTailFox onEnd={done} reduced />
    </ServicesProvider>,
  );
  expect(done).toHaveBeenCalledTimes(1);
  expect(container.querySelector("[data-signature]")).toBeNull();
  expect(sound.played).toEqual([]);
});
