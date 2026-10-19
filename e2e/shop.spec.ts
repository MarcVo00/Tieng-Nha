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

test("buy and play as the wandering blade", async ({ page }) => {
  await onboard(page);
  // 10 perfect lessons (10 + 5 each = 150 xu) + 5 badges (10 each = 50 xu) = 200 xu, exactly the price.
  await seedLessonsCompleted(page, ["l01", "l02", "l03", "l04", "l05", "l06", "l07", "l08", "l09", "l10"], { perfect: true });
  await seedBadges(page, ["first_lesson", "five_lessons", "streak_3", "perfect_lesson", "first_dialogue"]);
  await page.reload();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await page.getByRole("link", { name: fr.shop.open }).click();
  await expect(page.getByText(fr.shop.balance(200), { exact: true })).toBeVisible();

  const blade = fr.shop.items.char_kiem_khach!;
  await page.getByRole("button", { name: new RegExp(`^${fr.shop.tryOn.prefix} ${blade.name}`) }).click();
  await page.getByRole("button", { name: fr.shop.tryOn.buy(200) }).click();
  await page.getByRole("button", { name: fr.shop.confirm.confirm, exact: true }).click();
  await expect(page.getByText(fr.shop.tryOn.equipped, { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.locator('[data-look~="char_kiem_khach"]').first()).toBeVisible();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  const starter = page.getByRole("listitem").filter({ hasText: fr.shop.characters.starter });
  await starter.getByRole("button", { name: fr.shop.tryOn.equip }).click();
  await expect(starter.getByText(fr.rewards.equipped)).toBeVisible();

  await page.goto("/");
  await expect(page.locator('[data-look~="char_kiem_khach"]')).toHaveCount(0);
  await expect(page.locator("[data-look]").first()).toBeVisible();
});
