import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("switching the leaderboard period never blocks the next page transition", async ({ page }) => {
  await onboard(page);

  await page.getByRole("link", { name: fr.app.tabs.leaderboard }).click();
  await expect(page.getByRole("heading", { name: fr.leaderboard.title })).toBeVisible();
  await page.getByRole("tab", { name: fr.leaderboard.all }).click();
  await expect(page.getByRole("list", { name: fr.leaderboard.podiumLabel })).toBeVisible();

  // Regression: the refresh spinner's infinite rotation kept the page's exit animation pending forever,
  // so every other tab rendered an empty <main>.
  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await expect(page.getByRole("heading", { name: fr.profile.title })).toBeVisible();
  await page.getByRole("link", { name: fr.app.tabs.learn }).click();
  await expect(page.getByRole("heading", { name: fr.leaderboard.title })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: fr.profile.title })).toHaveCount(0);
});
