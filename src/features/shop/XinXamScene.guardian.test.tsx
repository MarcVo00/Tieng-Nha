import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createFakeServices, FakeSoundPlayer } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { GachaPull, GachaPullItem } from "@/domain/types";
import { omenDuration, REVEAL } from "@/features/shop/gachaReveal";
import { TalismanGuardian } from "@/features/shop/signatures/TalismanGuardian";
import { SIG } from "@/features/shop/signatures/talismanSchedule";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

// The real registry: La gardienne des talismans plays her own scene (spec sound-and-reveal §6.2). Only setTimeout is
// faked (the scene's beats and sounds all run on it), so the 3.5 s scene is stepped through beat by beat; clicks are
// plain events (user-event waits on real timers).

const GUARDIAN = fr.shop.items.char_phap_su?.name ?? "char_phap_su";
const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false, refund = 0): GachaPullItem => ({ itemId, rarity, duplicate, refund });
const pullOf = (items: GachaPullItem[]): GachaPull => ({
  id: `g-${items.length}`,
  theme: "legendes_sombres",
  count: items.length,
  cost: items.length === 1 ? 40 : 360,
  items,
  createdAt: "2026-10-24T10:00:00.000Z",
  claimed: true,
});
const ms = (s: number) => Math.round(s * 1000);

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
  render(
    <ServicesProvider services={services}>
      <XinXamScene pull={pull} items={[]} baseLook={{}} onClose={() => undefined} />
    </ServicesProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: fr.gacha.resultLabel(pull.cost) });
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await advance(REVEAL.shake + omenDuration("legendary") + 0.1);
  expect(dialog).toHaveAttribute("data-phase", "cards");
  return { sound, dialog };
}

const cues = (sound: FakeSoundPlayer, prefix = "") => sound.played.map((p) => p.cue).filter((c) => c.startsWith(prefix));
const ending = (sound: FakeSoundPlayer) => sound.played.map((p) => p.cue).filter((c) => c.startsWith("sig.") || c === "gacha.flip.legendary");

test("her card turns: the signature plays in the focus view (wind, twelve seals, the gong), then she appears", async () => {
  const { sound, dialog } = await show(pullOf([item("acc_giao_tre", "common"), item("char_phap_su", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(2) }));
  expect(dialog).toHaveAttribute("data-phase", "signature");
  expect(dialog.querySelector("[data-focus] [data-signature='char_phap_su']")).not.toBeNull();
  expect(within(dialog).getByRole("status")).toHaveTextContent(fr.gacha.scene.signature);
  expect(within(dialog).queryByRole("heading", { name: GUARDIAN })).toBeNull();

  // The gust: twelve talismans in the air.
  await advance(SIG.wind + 0.05);
  expect(dialog.querySelectorAll("[data-fx='talisman']")).toHaveLength(12);
  expect(cues(sound, "sig.")).toEqual(["sig.wind"]);

  // The seals catch fire one by one; the silhouette inks in while they close on it.
  await advance(SIG.silhouetteAt - SIG.wind);
  expect(cues(sound, "sig.brush")).toHaveLength(12);
  expect(dialog.querySelector("[data-fx='silhouette']")).not.toBeNull();

  // The gong: the talismans are gone, the ink bursts.
  await advance(SIG.gong - SIG.silhouetteAt);
  expect(dialog.querySelectorAll("[data-fx='talisman']")).toHaveLength(0);
  expect(dialog.querySelector("[data-fx='blot']")).not.toBeNull();
  expect(cues(sound, "sig.").at(-1)).toBe("sig.gong");
  expect(dialog).toHaveAttribute("data-phase", "signature");

  // The end: she appears and her card rings as she does; nothing of the scene is left.
  await advance(SIG.end - SIG.gong);
  expect(dialog).toHaveAttribute("data-phase", "focus");
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(dialog.querySelectorAll("[data-fx='talisman'], [data-fx='silhouette'], [data-fx='blot'], [data-fx='seal']")).toHaveLength(0);
  expect(within(dialog).getByRole("heading", { name: GUARDIAN })).toBeInTheDocument();
  expect(ending(sound)).toEqual(["sig.wind", ...Array<string>(12).fill("sig.brush"), "sig.gong", "gacha.flip.legendary"]);
});

test("« Passer » during her signature: the recap at once, every sound stopped, the scene unmounted and silent", async () => {
  const { sound, dialog } = await show(pullOf([item("char_phap_su", "legendary")]));
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  await advance(SIG.firstSeal + 0.2);
  expect(dialog.querySelector("[data-signature]")).not.toBeNull();
  const before = sound.stopped;
  const played = sound.played.length;
  fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(sound.stopped).toBeGreaterThan(before);
  expect(dialog.querySelector("[data-signature]")).toBeNull();
  expect(within(dialog).getByText(GUARDIAN)).toBeInTheDocument();
  await advance(SIG.end);
  expect(sound.played.length).toBe(played); // no brush, no gong, no flip after the skip
});

test("two of her in one pull: each card plays its own signature when it is turned", async () => {
  const { sound, dialog } = await show(pullOf([item("char_phap_su", "legendary"), item("acc_giao_tre", "common"), item("char_phap_su", "legendary", true, 120)]));
  for (const n of [1, 3]) {
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(n) }));
    expect(dialog).toHaveAttribute("data-phase", "signature");
    expect(dialog.querySelector("[data-signature='char_phap_su']")).not.toBeNull();
    await advance(SIG.end + 0.05);
    expect(dialog).toHaveAttribute("data-phase", "focus");
    expect(within(dialog).getByRole("heading", { name: GUARDIAN })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
    await advance(REVEAL.flip);
  }
  expect(cues(sound, "sig.gong")).toHaveLength(2);
  expect(cues(sound, "gacha.flip.legendary")).toHaveLength(2);
});

test("a new onEnd identity never restarts the scene", async () => {
  const { services, sound } = fakeSound();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(
    <ServicesProvider services={services}>
      <TalismanGuardian onEnd={first} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.gong);
  rerender(
    <ServicesProvider services={services}>
      <TalismanGuardian onEnd={second} reduced={false} />
    </ServicesProvider>,
  );
  await advance(SIG.end - SIG.gong + 0.05);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(cues(sound, "sig.wind")).toHaveLength(1);
});

test("reduced motion: the signature ends at once and draws nothing, in silence", () => {
  const { services, sound } = fakeSound();
  const done = vi.fn();
  const { container } = render(
    <ServicesProvider services={services}>
      <TalismanGuardian onEnd={done} reduced />
    </ServicesProvider>,
  );
  expect(done).toHaveBeenCalledTimes(1);
  expect(container.querySelector("[data-signature]")).toBeNull();
  expect(sound.played).toEqual([]);
});
