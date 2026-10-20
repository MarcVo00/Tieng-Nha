import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedDialoguesCompleted, seedKimBai, seedLessonsCompleted } from "./helpers";

test("win Kim bài then buy the Tây Sơn headband", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await seedDialoguesCompleted(page, ["d01"]);
  await seedKimBai(page, 7);
  await page.goto("/arena");

  const name = fr.shop.items["hat_tay_son"]?.name;
  if (!name) throw new Error("missing i18n name for hat_tay_son");
  await expect(page.getByText(fr.arena.balance(7), { exact: true })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await page.getByRole("button", { name: fr.arena.buy(6) }).click();
  await page.getByRole("button", { name: fr.shop.confirm.confirm, exact: true }).click();

  await expect(page.getByText(fr.arena.balance(1), { exact: true })).toBeVisible();

  await page.goto("/");
  const token = page.getByRole("img", { name: /^Toi, / });
  await expect(token.locator('[data-look~="hat_tay_son"]')).toBeAttached();
});
