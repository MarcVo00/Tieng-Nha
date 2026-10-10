import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { firstLessonLink, onboard, openFirstLessonAndFinishDeck, playThrough, PSEUDO } from "./helpers";

test("onboarding, first lesson, then the leaderboard lists the player", async ({ page }) => {
  await onboard(page);
  await expect(firstLessonLink(page, "disponible")).toContainText("Les 6 tons & bonjour");

  await openFirstLessonAndFinishDeck(page);
  // Answers are unknown to the test, so the lesson legitimately ends either way; each end state is checked for its own screen.
  const outcome = await playThrough(page);
  if (outcome === "done") {
    await expect(page.getByText(new RegExp(`${fr.lessons.done.good}|${fr.lessons.done.perfect}`))).toBeVisible();
  } else {
    await expect(page.getByText(fr.lessons.failed.title)).toBeVisible();
  }

  await page.goto("/leaderboard"); // deep link: the fake session survives a full page load
  await expect(page.getByRole("heading", { name: fr.leaderboard.title })).toBeVisible();
  await expect(page.getByText(PSEUDO).first()).toBeVisible();
});
