import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { fixGachaRolls, onboard, seedCoins, seedCompleteGachaSet, shakeTube } from "./helpers";

// Every roll is 0: the first common by id (Lance de bambou), then, in a x10, the forced rare (Éventail de fer).
const BAMBOO = fr.shop.items.acc_giao_tre!.name;
const FAN = fr.shop.items.acc_quat_sat!.name;

const banner = (page: Page) => page.getByRole("heading", { name: fr.shop.themes.legendes_sombres! }).locator("xpath=ancestor::section");
const openShop = (page: Page) => page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();
const balance = (page: Page, xu: number) => expect(page.getByText(fr.shop.balance(xu), { exact: true })).toBeVisible();

async function wardrobe(page: Page) {
  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  const section = page.locator("#me-wardrobe");
  await section.scrollIntoViewIfNeeded();
  return section;
}

test("pull once: the stick, the scroll, the new piece in the wardrobe, 40 xu less", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  await page.reload();
  await openShop(page);
  await balance(page, 100);

  await banner(page).getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await scene.getByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.common) }).click();
  await expect(scene.locator('[data-seal="common"]')).toHaveText(fr.shop.rarities.common);
  await expect(scene.getByRole("heading", { name: BAMBOO })).toBeVisible();
  await expect(scene.getByRole("status")).toHaveText(fr.gacha.scene.announce(BAMBOO, fr.shop.rarities.common, fr.gacha.resultNew));
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 60);
  await expect(banner(page).getByText(fr.gacha.ownedCount(1, 12))).toBeVisible();

  const section = await wardrobe(page);
  const card = section.getByRole("listitem").filter({ hasText: BAMBOO });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: fr.shop.tryOn.equip }).click();
  await expect(card.getByRole("button", { name: fr.shop.tryOn.unequip })).toBeVisible();
});

test("pull ten: one stick opened, then the recap with the refunds, the balance and the wardrobe", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 400);
  await page.reload();
  await openShop(page);

  await banner(page).getByRole("button", { name: fr.gacha.pullTen(360) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(360) });
  await shakeTube(page);
  await expect(scene.locator("[data-stick]")).toHaveCount(10);
  // Nine wooden tips, then the rare the x10 rule forces.
  await expect(scene.locator('[data-stick="common"]')).toHaveCount(9);
  await scene.getByRole("button", { name: fr.gacha.scene.stick(10, fr.gacha.scene.tips.rare) }).click();
  await expect(scene.getByRole("heading", { name: FAN })).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.scene.next }).click();
  await expect(scene.getByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.common) })).toBeFocused();
  await scene.getByRole("button", { name: fr.gacha.scene.revealAll }).click();

  await expect(scene.getByRole("heading", { name: fr.gacha.resultTitle })).toBeVisible();
  await expect(scene.getByRole("listitem")).toHaveCount(10);
  await expect(scene.getByText(fr.gacha.resultNew)).toHaveCount(2);
  await expect(scene.getByText(fr.gacha.scene.duplicate(8))).toHaveCount(8);
  await expect(scene.getByText(fr.gacha.resultTotal(64))).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 400 - 360 + 64);

  const section = await wardrobe(page);
  await expect(section.getByRole("listitem").filter({ hasText: BAMBOO })).toBeVisible();
  await expect(section.getByRole("listitem").filter({ hasText: FAN })).toBeVisible();
});

test("a complete set can still be pulled: everything comes back in xu", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 40);
  await seedCompleteGachaSet(page);
  await page.reload();
  await openShop(page);
  await expect(banner(page).getByText(fr.gacha.complete)).toBeVisible();

  await banner(page).getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await scene.getByRole("button", { name: fr.gacha.scene.stick(1, fr.gacha.scene.tips.common) }).click();
  await expect(scene.locator("[data-scroll]").getByText(fr.gacha.scene.duplicate(8))).toBeVisible(); // the status line says it too
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 8); // 40 - 40 + 8
  await expect(banner(page).getByText(fr.gacha.ownedCount(12, 12))).toBeVisible();
});

test("a pull the phone never applied is recovered once, as « Tirage récupéré »", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  // The app asked for this pull and closed before seeing the answer: only its id is left on the phone.
  await page.evaluate(() => localStorage.setItem("tn-gacha-pending:me", JSON.stringify([{ id: "lost-pull-1", theme: "legendes_sombres", count: 1 }])));
  await page.reload();

  await expect(page.getByText(fr.gacha.recovered, { exact: true })).toHaveCount(1);
  await openShop(page);
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await expect(scene).toHaveAttribute("data-phase", "recap");
  await expect(scene.getByRole("heading", { name: fr.gacha.recovered })).toBeVisible();
  await expect(scene.getByText(BAMBOO)).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 60);
  expect(await page.evaluate(() => localStorage.getItem("tn-gacha-pending:me"))).toBe("[]");

  // Nothing comes back a second time.
  await page.reload();
  await openShop(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(fr.gacha.recovered, { exact: true })).toHaveCount(0);
});
