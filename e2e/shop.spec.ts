import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedBadges, seedLessonsCompleted } from "./helpers";

test("a badge reward frame can be equipped from Moi", async ({ page }) => {
  await onboard(page);
  await seedBadges(page, ["streak_7"]);
  await page.reload();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  const bronze = page.getByRole("listitem").filter({ hasText: fr.shop.items.frame_bronze!.name });
  await bronze.getByRole("button", { name: fr.rewards.equip }).click();

  await expect(page.locator("header [data-frame]")).toHaveAttribute("data-frame", "frame_bronze");
  await expect(bronze.getByRole("button", { name: fr.rewards.unequip })).toBeVisible();
});

test("the shop no longer sells frames", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();

  await expect(page.getByText(fr.rewards.hint)).toBeVisible();
  await expect(page.getByText(fr.shop.items.frame_bronze!.name)).toHaveCount(0);
});

test("a missing gacha piece is previewed in the shop, never sold", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();

  const crown = fr.shop.items.hat_thuy_tinh!;
  await page.getByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} ${crown.name}`) }).click();
  const sheet = page.getByRole("dialog", { name: crown.name });
  await expect(sheet.getByText(fr.gacha.sheetHint)).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Acheter/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: fr.gacha.close }).click();
  await expect(sheet).toHaveCount(0);
});

test("pull once from the dark legends banner, see the result, and the set fills up", async ({ page }) => {
  await onboard(page);
  // 4 perfect lessons are worth more than the 40 xu of one pull (the old crown cost 60).
  await seedLessonsCompleted(page, ["l01", "l02", "l03", "l04"], { perfect: true });
  await page.reload();
  await page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();

  const banner = page.getByRole("heading", { name: fr.shop.themes.legendes_sombres! }).locator("xpath=ancestor::section");
  await expect(banner.getByText(fr.gacha.ownedCount(0, 12))).toBeVisible();
  await banner.getByRole("button", { name: fr.gacha.pullOne(40) }).click();

  const result = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await expect(result.getByRole("listitem")).toHaveCount(1);
  await result.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(result).toHaveCount(0);

  await expect(banner.getByText(fr.gacha.pityLine(39))).toBeVisible();
  await expect(banner.getByText(fr.gacha.ownedCount(1, 12))).toBeVisible();
});

test("the rates sheet lists the four rarities", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();
  await page.getByRole("button", { name: fr.gacha.rates }).click();
  const sheet = page.getByRole("dialog", { name: fr.gacha.ratesTitle });
  for (const label of Object.values(fr.shop.rarities)) await expect(sheet.getByText(label, { exact: true })).toBeVisible();
  await expect(sheet.getByText(fr.gacha.ratePercent(2), { exact: true })).toBeVisible();
});
