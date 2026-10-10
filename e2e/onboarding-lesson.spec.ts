import { expect, test } from "@playwright/test";
import { fr } from "../src/i18n/fr";
import { navigateInApp, onboard, openFirstLessonAndFinishDeck, playThrough, PSEUDO } from "./helpers";

test("onboarding, first lesson, then the leaderboard lists the player", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("link", { name: /^Leçon 1 :.*Les 6 tons & bonjour.*disponible/ })).toBeVisible();

  await openFirstLessonAndFinishDeck(page);
  const outcome = await playThrough(page);
  expect(["done", "failed"]).toContain(outcome);
  await expect(
    page.getByText(new RegExp(`${fr.lessons.done.good}|${fr.lessons.done.perfect}`)).or(page.getByText(fr.lessons.failed.title)),
  ).toBeVisible();

  await navigateInApp(page, "/leaderboard");
  await expect(page.getByText(PSEUDO).first()).toBeVisible();
});
