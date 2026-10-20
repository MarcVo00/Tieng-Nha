import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedDialoguesCompleted, seedLessonsCompleted } from "./helpers";

const OPPONENT = { id: "bot_ba_ngoai", pseudo: "Bà Ngoại" };

/** Answers every question blindly (first choice, or the fake mic), until the run hands over to the result screen. */
async function playRun(page: Page): Promise<void> {
  const start = page.getByRole("button", { name: fr.duels.run.round2Intro.start });
  const mic = page.getByRole("button", { name: fr.exercises.speak.micLabel, exact: true });
  const verify = page.getByRole("button", { name: fr.exercises.verify });
  const choices = page.locator("button[aria-pressed]:not([aria-label])");
  const exercise = page.locator("[data-exercise-id]");
  const skip = page.getByRole("button", { name: fr.duels.result.skip });

  let last: string | null = null;
  for (let i = 0; i < 40; i++) {
    await start.or(mic).or(choices.first()).or(skip).first().waitFor();
    if (await skip.isVisible()) return;
    if (await start.isVisible()) {
      await start.click();
      continue;
    }
    const id = await exercise.first().getAttribute("data-exercise-id");
    if (id === last) {
      await page.waitForTimeout(100); // the previous question is still leaving
      continue;
    }
    if (await mic.isVisible()) {
      await mic.click();
    } else {
      await choices.first().click();
      if (await verify.isVisible()) await verify.click();
    }
    last = id;
  }
  throw new Error("The duel run never reached the result screen");
}

test("duel against a family member, replay and Kim bài", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await seedDialoguesCompleted(page, ["d01"]);
  await page.goto(`/u/${OPPONENT.id}`);

  await page.getByRole("button", { name: fr.duels.challenge }).click();
  await expect(page).toHaveURL(/\/duel\/[^/]+\/run$/);
  await playRun(page);

  // The opponent already played: the result opens on the replay, which can be skipped.
  await expect(page).toHaveURL(/\/duel\/[^/]+$/);
  await page.getByRole("button", { name: fr.duels.result.skip }).click();
  await expect(page.getByRole("table", { name: fr.duels.result.statsLabel })).toBeVisible();
  const reward = page.getByText(new RegExp(`${fr.duels.result.rewardLabel}\u202f: (\\d+)`));
  await expect(reward).toBeAttached();
  const kim = Number((await reward.textContent())?.match(/(\d+)$/)?.[1]);
  expect(kim).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: fr.duels.result.back }).click();
  await expect(page).toHaveURL(/\/duels$/);
  const done = page.getByRole("region", { name: fr.duels.done }).or(page.locator("section", { has: page.getByRole("heading", { name: fr.duels.done }) })).first();
  await expect(done.getByText(fr.duels.hub.versus(OPPONENT.pseudo))).toBeVisible();
  await expect(done.getByText(fr.duels.kimBaiWon(kim))).toBeVisible();
  await expect(page.getByText(`${fr.duels.kimBaiLabel}\u202f: ${fr.duels.kimBai(kim)}`)).toBeAttached();
});

test("locked duels: the profile explains what is missing", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await page.goto(`/u/${OPPONENT.id}`);

  await expect(page.getByText(fr.duels.locked)).toBeVisible();
  await expect(page.getByRole("button", { name: fr.duels.challenge })).toHaveCount(0);
});
