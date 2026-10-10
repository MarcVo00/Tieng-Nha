import { expect, test } from "@playwright/test";
import { fr } from "../src/i18n/fr";
import { onboard, openFirstLessonAndFinishDeck, playThrough } from "./helpers";

// The service worker is not guaranteed to be active in the first session, so this asserts in-app behaviour:
// once the lesson chunks are loaded, the lesson plays through with the network cut and the app recovers online.
test("lesson 1 is playable offline and the app recovers after reconnecting", async ({ page, context }) => {
  await onboard(page);
  // Warm the lesson route (lazy chunks) while still online, then go back home.
  await page.getByRole("link", { name: /^Leçon 1 :.*disponible/ }).click();
  await expect(page.getByRole("button", { name: fr.lessons.deck.next })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  await context.setOffline(true);
  await openFirstLessonAndFinishDeck(page);
  const outcome = await playThrough(page);
  expect(["done", "failed"]).toContain(outcome);

  // In-app navigation still works offline: leave the result screen and land back on the home path.
  await page.getByRole("button", { name: outcome === "done" ? fr.lessons.done.continue : fr.lessons.failed.back }).click();
  await expect(page.getByRole("link", { name: /^Leçon 1 :/ })).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: fr.app.error.title })).toHaveCount(0);
  // The fake auth session is in-memory, so a reload lands on the welcome screen: the app booted without an error screen.
  await expect(page.getByRole("button", { name: fr.onboarding.welcome.start })).toBeVisible();
});
