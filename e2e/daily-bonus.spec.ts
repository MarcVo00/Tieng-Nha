import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { firstLessonLink, onboard, playedSounds } from "./helpers";

const title = `${fr.home.bonus.word} ${fr.home.bonus.titleAfter}`;

test("the daily lì xì opens by itself on the first home visit, pays 10 xu once, then stays out of the way", async ({ page }) => {
  await onboard(page, { dailyBonus: true });
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: fr.home.bonus.open }).click();
  await expect(sheet.getByText(fr.home.bonus.gained(10), { exact: true })).toBeVisible();
  await expect.poll(async () => (await playedSounds(page)).map((s) => s.cue)).toContain("arena.coins");
  await sheet.getByRole("button", { name: fr.home.bonus.continue }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: new RegExp(fr.home.bonus.cardAfter) })).toHaveCount(0);

  // The shop shows the new balance; a reload the same day opens nothing.
  await page.goto("/shop");
  await expect(page.getByText(fr.shop.balance(10), { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await expect(firstLessonLink(page)).toBeVisible();
  await expect(page.getByRole("dialog", { name: title })).toHaveCount(0);
});
