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
  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await page.getByRole("link", { name: fr.shop.open }).click();

  await expect(page.getByText(fr.rewards.hint)).toBeVisible();
  await expect(page.getByText(fr.shop.items.frame_bronze!.name)).toHaveCount(0);
});

test("buy and wear the crown of the tides", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03", "l04"], { perfect: true });
  await page.reload();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await page.getByRole("link", { name: fr.shop.open }).click();

  const crown = fr.shop.items.hat_thuy_tinh!;
  await page.getByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} ${crown.name}`) }).click();
  await page.getByRole("button", { name: fr.shop.tryOn.buy(60) }).click();
  await page.getByRole("button", { name: fr.shop.confirm.confirm, exact: true }).click();
  await expect(page.getByText(fr.shop.tryOn.equipped, { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.locator('[data-look~="hat_thuy_tinh"]').first()).toBeVisible();
});
