import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedLessonsCompleted } from "./helpers";

test("coins from perfect lessons buy a frame, which can then be equipped", async ({ page }) => {
  await onboard(page);
  // 4 perfect lessons = 4 x 15 = 60 xu.
  await seedLessonsCompleted(page, ["l01", "l02", "l03", "l04"], { perfect: true });
  await page.reload();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await page.getByRole("link", { name: fr.shop.open }).click();
  await expect(page.getByText(fr.shop.balance(60), { exact: true })).toBeVisible();

  const bronze = page.getByRole("listitem").filter({ hasText: fr.shop.items.frame_bronze!.name });
  await bronze.getByRole("button", { name: fr.shop.buy(40) }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: fr.shop.confirm.confirm }).click();
  await expect(page.getByText(fr.shop.balance(20), { exact: true })).toBeVisible();

  await bronze.getByRole("button", { name: fr.shop.equip }).click();
  await expect(bronze.getByRole("button", { name: fr.shop.equipped })).toBeVisible();
});
