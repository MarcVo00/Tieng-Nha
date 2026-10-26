import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeServices } from "@/adapters/fakes";
import type { GachaPull, GachaPullItem, ShopItem } from "@/domain/types";
import { revealAllOrder } from "@/features/shop/gachaReveal";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

const LOOK = { character: "char_default" };
const SLOW = { timeout: 5000 };
const CHAIN = { timeout: 9000 };
let shop: ShopItem[] = [];
beforeAll(async () => {
  shop = await createFakeServices().content.getShop();
});

const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false, refund = 0): GachaPullItem => ({ itemId, rarity, duplicate, refund });
const pullOf = (items: GachaPullItem[]): GachaPull => ({ id: `p-${items.length}`, theme: "legendes_sombres", count: items.length, cost: items.length === 1 ? 40 : 360, items, createdAt: "2026-10-24T10:00:00.000Z", claimed: true });
const nameOf = (id: string) => fr.shop.items[id]?.name ?? id;
const RARITY_WORDS = [...Object.keys(fr.shop.rarities), ...Object.values(fr.shop.rarities)];

function show(pull: GachaPull, opts: { recovered?: boolean } = {}) {
  const onClose = vi.fn();
  render(<XinXamScene pull={pull} recovered={opts.recovered ?? false} items={shop} baseLook={LOOK} onClose={onClose} />);
  return { onClose, user: userEvent.setup(), dialog: screen.getByRole("dialog", { name: fr.gacha.resultLabel(pull.cost) }) };
}

/** Shakes the tube once and waits for the face-down cards (after the omen). */
async function deal(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "cards"), SLOW);
  const grid = dialog.querySelector<HTMLElement>("[data-cards]");
  if (!grid) throw new Error("no card grid");
  return grid;
}

const TEN = [
  item("acc_giao_tre", "common", true, 8),
  item("hat_thuy_tinh", "rare"),
  item("hat_khan_vanh", "common"),
  item("outfit_ao_chen", "common", true, 8),
  item("char_phap_su", "legendary"),
  item("aura_suong_mu", "common"),
  item("acc_quat_sat", "rare", true, 20),
  item("outfit_son_tinh", "epic"),
  item("hat_mu_chien", "rare"),
  item("aura_waves", "rare"),
];

test("x1: shake the tube, the omen, one face-down card; a touch turns it and opens the scroll on the hero; Continuer closes", async () => {
  const { user, dialog, onClose } = show(pullOf([item("hat_thuy_tinh", "rare")]));
  expect(within(dialog).getByText(fr.gacha.scene.shakeHint)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.skip })).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  expect(dialog).toHaveAttribute("data-phase", "shaking");
  await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "omen"), SLOW);
  expect(within(dialog).getByRole("status")).toHaveTextContent(fr.gacha.scene.omen);
  const card = await within(dialog).findByRole("button", { name: fr.gacha.scene.card(1) }, SLOW);
  expect(within(dialog).getByText(fr.gacha.scene.tapOne)).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: fr.gacha.scene.revealAll })).toBeNull(); // a single card: nothing to reveal at once
  await user.click(card);
  const hero = await within(dialog).findByRole("img", { name: fr.gacha.scene.wearing(nameOf("hat_thuy_tinh")) }, SLOW);
  expect(within(dialog).getByRole("status").textContent).toBe(fr.gacha.scene.announce(nameOf("hat_thuy_tinh"), fr.shop.rarities.rare, fr.gacha.resultNew));
  expect(hero.querySelector("[data-look]")?.getAttribute("data-look")).toContain("hat_thuy_tinh");
  expect(within(dialog).getByRole("heading", { name: nameOf("hat_thuy_tinh") })).toBeInTheDocument();
  expect(dialog.querySelector('[data-seal="rare"]')).toHaveTextContent(fr.shop.rarities.rare);
  expect(within(dialog).getByText(fr.gacha.resultNew)).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a duplicate says what it gave back", async () => {
  const { user, dialog } = show(pullOf([item("acc_quat_sat", "rare", true, 20)]));
  await deal(user, dialog);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) }));
  expect(await within(dialog).findByText(fr.gacha.scene.duplicate(20), {}, SLOW)).toBeInTheDocument();
  expect(within(dialog).getByRole("status").textContent).toBe(fr.gacha.scene.announce(nameOf("acc_quat_sat"), fr.shop.rarities.rare, fr.gacha.scene.duplicate(20)));
  expect(fr.gacha.scene.duplicate(20)).toBe("Déjà obtenu → +20 xu");
});

test("the omen grows with the best piece: wood alone, a jade glow, two lanterns, the gold flood with its confetti", async () => {
  const cases = [
    { items: [item("acc_giao_tre", "common")], fx: [] as string[] },
    { items: [item("acc_giao_tre", "common"), item("hat_thuy_tinh", "rare")], fx: ["jade"] },
    { items: [item("hat_thuy_tinh", "rare"), item("outfit_son_tinh", "epic")], fx: ["lantern", "lantern"] },
    { items: [item("acc_giao_tre", "common"), item("char_phap_su", "legendary")], fx: ["gold", "rays"] },
  ];
  for (const c of cases) {
    const { user, dialog } = show({ ...pullOf(c.items), id: `omen-${c.items.length}-${c.fx.join()}` });
    await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
    await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "omen"), SLOW);
    const stage = dialog.querySelector("[data-stage]");
    expect(stage?.getAttribute("data-omen")).toBe(c.fx.length === 0 ? "common" : c.items[1]?.rarity);
    expect([...(stage?.querySelectorAll("[data-fx]") ?? [])].map((n) => n.getAttribute("data-fx"))).toEqual(c.fx);
    if (c.fx.includes("gold")) {
      expect(stage?.querySelector('[data-fx="rays"]')?.querySelectorAll("path")).toHaveLength(1); // static rays: one path
      await waitFor(() => expect(dialog.querySelector('[data-fx="confetti"]')?.children).toHaveLength(24), SLOW); // the existing confetti, once
    }
    await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "cards"), SLOW);
    expect(dialog.querySelector("[data-fx]")).toBeNull(); // everything of the omen is unmounted with it
    dialog.closest("body")?.replaceChildren();
  }
}, 20000);

test("x10: before a card is turned, nothing in the grid tells a rarity", async () => {
  const { user, dialog } = show(pullOf(TEN));
  const grid = await deal(user, dialog);
  const cards = grid.querySelectorAll("[data-card]");
  expect(cards).toHaveLength(10);
  expect(grid.querySelector("[data-rarity]")).toBeNull();
  expect(grid.querySelector("[data-face]")).toBeNull();
  expect(grid.querySelector("[data-seal]")).toBeNull();
  for (const word of RARITY_WORDS) expect(grid.innerHTML).not.toContain(word);
  expect(new Set([...cards].map((c) => c.innerHTML.replace(/Carte \d+/, ""))).size).toBe(1); // ten identical backs
  expect([...cards].map((c) => c.getAttribute("aria-label"))).toEqual(TEN.map((_, i) => fr.gacha.scene.card(i + 1)));
  expect(within(dialog).getByText(fr.gacha.scene.tapMany(10))).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.skip })).toBeInTheDocument();
});

test("x10: turning card 3 shows its piece; back on the grid it stays turned with its preview, and focus goes to a face-down card", async () => {
  const { user, dialog } = show(pullOf(TEN));
  await deal(user, dialog);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(3) }));
  expect(await within(dialog).findByRole("heading", { name: nameOf("hat_khan_vanh") }, SLOW)).toBeInTheDocument();
  expect(dialog.querySelector('[data-seal="common"]')).toHaveTextContent(fr.shop.rarities.common);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
  const turned = await within(dialog).findByRole("button", { name: fr.gacha.scene.cardOpen(3, nameOf("hat_khan_vanh"), fr.shop.rarities.common) }, SLOW);
  expect(turned).toHaveAttribute("data-flipped", "true");
  expect(turned.querySelector('[data-face="common"]')).not.toBeNull();
  await waitFor(() => expect(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) })).toHaveFocus());
  expect(within(dialog).getByText(fr.gacha.scene.tapMany(9))).toBeInTheDocument();
});

test("« Tout découvrir » turns the cards lowest rarity first, ends on the best one, then the recap", async () => {
  const { user, dialog } = show(pullOf(TEN));
  const grid = await deal(user, dialog);
  const order: number[] = [];
  const watch = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      if (el.getAttribute("data-flipped") === "true") order.push([...grid.querySelectorAll("[data-card]")].indexOf(el));
    }
  });
  watch.observe(grid, { subtree: true, attributes: true, attributeFilter: ["data-flipped"] });
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.revealAll }));
  await waitFor(() => expect(within(dialog).getByText(fr.gacha.scene.revealing)).toBeInTheDocument());
  // The best piece (the legendary) opens its focus view and waits.
  expect(await within(dialog).findByRole("heading", { name: nameOf("char_phap_su") }, CHAIN)).toBeInTheDocument();
  watch.disconnect();
  expect(order).toEqual(revealAllOrder(TEN, Array(10).fill(false)));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.toRecap }));
  expect(within(dialog).getByRole("heading", { name: fr.gacha.resultTitle })).toBeInTheDocument();
  const lines = within(dialog).getAllByRole("listitem");
  expect(lines.map((l) => l.querySelector("span.text-body-strong")?.textContent)).toEqual(
    ["char_phap_su", "outfit_son_tinh", "hat_thuy_tinh", "hat_mu_chien", "aura_waves", "hat_khan_vanh", "aura_suong_mu", "acc_quat_sat", "acc_giao_tre", "outfit_ao_chen"].map(nameOf),
  );
  expect(within(dialog).getByText(fr.gacha.resultTotal(36))).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: fr.gacha.scene.skip })).toBeNull();
  expect(within(dialog).getByRole("button", { name: fr.gacha.resultContinue })).toHaveFocus();
}, 15000);

test("a legendary without a signature: the generic gold rays, then its scroll with the gold seal", async () => {
  const { user, dialog } = show(pullOf([item("acc_giao_tre", "common"), item("char_phap_su", "legendary")]));
  await deal(user, dialog);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(2) }));
  await waitFor(() => expect(dialog.querySelector("[data-focus] [data-fx='rays']")).not.toBeNull(), SLOW);
  expect(dialog).toHaveAttribute("data-phase", "focus"); // the registry is empty: no signature phase
  expect(dialog.querySelector('[data-seal="legendary"]')).toHaveTextContent(fr.shop.rarities.legendary);
});

test("« Passer » goes to the recap of exactly what was drawn, without closing, from the tube or the cards", async () => {
  const first = show(pullOf(TEN));
  await first.user.click(within(first.dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(within(first.dialog).getAllByRole("listitem")).toHaveLength(10);
  for (const t of TEN) expect(within(first.dialog).getAllByText(nameOf(t.itemId)).length).toBeGreaterThan(0);
  expect(first.onClose).not.toHaveBeenCalled();
  first.dialog.closest("body")?.replaceChildren();

  const { user, dialog } = show({ ...pullOf(TEN), id: "again" });
  await deal(user, dialog);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(5) }));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(10);
});

test("« Passer » during the omen goes to the recap", async () => {
  const { user, dialog } = show(pullOf(TEN));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "omen"), SLOW);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(10);
});

test("Escape skips the scene, then closes the recap", async () => {
  const { user, dialog, onClose } = show(pullOf([item("hat_thuy_tinh", "rare")]));
  await user.keyboard("{Escape}");
  expect(dialog).toHaveAttribute("data-phase", "recap");
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a recovered pull opens on its recap: nothing to shake for something already drawn", () => {
  const { dialog } = show(pullOf([item("hat_thuy_tinh", "rare")]), { recovered: true });
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(within(dialog).getByRole("heading", { name: fr.gacha.recovered })).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: fr.gacha.scene.shake })).toBeNull();
  expect(dialog.querySelector("[data-card]")).toBeNull();
});

test("focus starts on the tube, not on « Passer », then goes to the first card", async () => {
  const { user, dialog } = show(pullOf([item("hat_thuy_tinh", "rare"), item("hat_khan_vanh", "common")]));
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.shake })).toHaveFocus();
  await deal(user, dialog);
  await waitFor(() => expect(within(dialog).getByRole("button", { name: fr.gacha.scene.card(1) })).toHaveFocus());
});

test("the recap words a duplicate like the scroll does", () => {
  const { dialog } = show(pullOf([item("acc_quat_sat", "rare", true, 20)]), { recovered: true });
  expect(within(dialog).getByText("Déjà obtenu → +20 xu")).toBeInTheDocument();
});
