import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeServices } from "@/adapters/fakes";
import type { GachaPull, GachaPullItem, ShopItem } from "@/domain/types";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

const LOOK = { character: "char_default" };
const SLOW = { timeout: 5000 };
let shop: ShopItem[] = [];
beforeAll(async () => {
  shop = await createFakeServices().content.getShop();
});

const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false, refund = 0): GachaPullItem => ({ itemId, rarity, duplicate, refund });
const pullOf = (items: GachaPullItem[]): GachaPull => ({ id: `p-${items.length}`, theme: "legendes_sombres", count: items.length, cost: items.length === 1 ? 40 : 360, items, createdAt: "2026-10-24T10:00:00.000Z", claimed: true });
const nameOf = (id: string) => fr.shop.items[id]?.name ?? id;

function show(pull: GachaPull, opts: { recovered?: boolean } = {}) {
  const onClose = vi.fn();
  render(<XinXamScene pull={pull} recovered={opts.recovered ?? false} items={shop} baseLook={LOOK} onClose={onClose} />);
  return { onClose, user: userEvent.setup(), dialog: screen.getByRole("dialog", { name: fr.gacha.resultLabel(pull.cost) }) };
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

test("x1: shake the tube, the stick falls showing its tip, a touch unrolls the scroll on the hero, Continuer closes", async () => {
  const { user, dialog, onClose } = show(pullOf([item("hat_thuy_tinh", "rare")]));
  expect(within(dialog).getByText(fr.gacha.scene.shakeHint)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.skip })).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  expect(dialog).toHaveAttribute("data-phase", "shaking");
  const stick = await within(dialog).findByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.rare) }, SLOW);
  await waitFor(() => expect(stick).toBeEnabled(), SLOW);
  expect(stick).toHaveAttribute("data-stick", "rare");
  expect(within(dialog).getByText(fr.gacha.scene.tapOne)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.skip })).toBeInTheDocument();
  await user.click(stick);
  const hero = await within(dialog).findByRole("img", { name: fr.gacha.scene.wearing(nameOf("hat_thuy_tinh")) });
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
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  const stick = await within(dialog).findByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.rare) }, SLOW);
  await waitFor(() => expect(stick).toBeEnabled(), SLOW);
  await user.click(stick);
  expect(await within(dialog).findByText(fr.gacha.scene.duplicate(20))).toBeInTheDocument();
  expect(within(dialog).getByRole("status").textContent).toBe(fr.gacha.scene.announce(nameOf("acc_quat_sat"), fr.shop.rarities.rare, fr.gacha.scene.duplicate(20)));
  expect(fr.gacha.scene.duplicate(20)).toBe("Déjà obtenu → +20\u00A0xu");
});

test("x10: ten sticks fan out with their tips; « Tout révéler » shows the recap, new pieces first then by rarity", async () => {
  const { user, dialog } = show(pullOf(TEN));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  const all = await within(dialog).findByRole("button", { name: fr.gacha.scene.revealAll }, SLOW);
  const sticks = dialog.querySelectorAll("[data-stick]");
  expect(sticks).toHaveLength(10);
  expect([...sticks].map((s) => s.getAttribute("data-stick"))).toEqual(TEN.map((t) => t.rarity));
  expect(within(dialog).getByText(fr.gacha.scene.tapMany(10))).toBeInTheDocument();
  await user.click(all);
  const lines = within(dialog).getAllByRole("listitem");
  expect(lines.map((l) => l.querySelector("span.text-body-strong")?.textContent)).toEqual(
    ["char_phap_su", "outfit_son_tinh", "hat_thuy_tinh", "hat_mu_chien", "aura_waves", "hat_khan_vanh", "aura_suong_mu", "acc_quat_sat", "acc_giao_tre", "outfit_ao_chen"].map(nameOf),
  );
  expect(within(dialog).getByRole("heading", { name: fr.gacha.resultTitle })).toBeInTheDocument();
  expect(within(dialog).getByText(fr.gacha.resultTotal(36))).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: fr.gacha.scene.skip })).toBeNull();
});

test("legendary: a longer hold with static gold rays, the gold seal, confetti once; reading it again does not hold", async () => {
  const { user, dialog } = show(pullOf(TEN));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await within(dialog).findByRole("button", { name: fr.gacha.scene.revealAll }, SLOW);
  const gold = within(dialog).getByRole("button", { name: fr.gacha.scene.stick(5, fr.gacha.scene.tips.legendary) });
  await user.click(gold);
  expect(dialog).toHaveAttribute("data-phase", "hold");
  expect(within(dialog).getByText(fr.gacha.scene.holding)).toBeInTheDocument();
  const rays = dialog.querySelector('[data-fx="rays"]');
  expect(rays?.querySelectorAll("path")).toHaveLength(1);
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.skip })).toBeInTheDocument();
  await waitFor(() => expect(dialog.querySelector('[data-seal="legendary"]')).not.toBeNull(), SLOW);
  await waitFor(() => expect(dialog.querySelector('[data-fx="confetti"]')?.children).toHaveLength(24), SLOW); // the existing confetti
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.next }));
  await within(dialog).findByText(fr.gacha.scene.tapMany(9));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.stick(5, fr.gacha.scene.tips.legendary) }));
  expect(dialog).toHaveAttribute("data-phase", "scroll");
});

test("« Passer » goes to the recap of exactly what was drawn, without closing", async () => {
  const { user, dialog, onClose } = show(pullOf(TEN));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.skip }));
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(10);
  for (const t of TEN) expect(within(dialog).getAllByText(nameOf(t.itemId)).length).toBeGreaterThan(0);
  expect(onClose).not.toHaveBeenCalled();
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
});

test("focus starts on the tube, not on « Passer »", () => {
  const { dialog } = show(pullOf([item("hat_thuy_tinh", "rare")]));
  expect(within(dialog).getByRole("button", { name: fr.gacha.scene.shake })).toHaveFocus();
});

test("x10: closing a scroll puts focus on the next unread stick, then on the recap when none is left", async () => {
  const two = [item("hat_thuy_tinh", "rare"), item("hat_khan_vanh", "common")];
  const { user, dialog } = show(pullOf(two.concat(two.map((t) => ({ ...t })))));
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await within(dialog).findByRole("button", { name: fr.gacha.scene.revealAll }, SLOW);
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.stick(2, fr.gacha.scene.tips.common) }));
  await user.click(await within(dialog).findByRole("button", { name: fr.gacha.scene.next }));
  const first = within(dialog).getByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.rare) });
  await waitFor(() => expect(first).toHaveFocus());
  await user.click(first);
  await user.click(await within(dialog).findByRole("button", { name: fr.gacha.scene.next }));
  await waitFor(() => expect(dialog.querySelector('[data-stick][data-read="false"]')).toHaveFocus());
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.revealAll }));
  expect(within(dialog).getByRole("button", { name: fr.gacha.resultContinue })).toHaveFocus();
});

test("the recap words a duplicate like the scroll does", () => {
  const { dialog } = show(pullOf([item("acc_quat_sat", "rare", true, 20)]), { recovered: true });
  expect(within(dialog).getByText("Déjà obtenu → +20\u00A0xu")).toBeInTheDocument();
});
