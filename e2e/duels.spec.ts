import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, playRun, seedDialoguesCompleted, seedLessonsCompleted } from "./helpers";

const OPPONENT = { id: "bot_ba_ngoai", pseudo: "Bà Ngoại" };

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

test("the duel verdict is visible without scrolling at 360 × 780, after the replay and after « Passer »", async ({ page }) => {
  test.setTimeout(150_000);
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await seedDialoguesCompleted(page, ["d01"]);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/u/${OPPONENT.id}`);
  await page.getByRole("button", { name: fr.duels.challenge }).click();
  await playRun(page);
  await expect(page).toHaveURL(/\/duel\/[^/]+$/);

  // Played to the end: the whole replay fits in 9 s, then the verdict is in view, focused.
  const verdict = page.locator("#duel-verdict");
  const skip = page.getByRole("button", { name: fr.duels.result.skip });
  await expect(skip).toBeVisible();
  await expect(verdict).toBeInViewport({ ratio: 1, timeout: 10_000 });
  await expect(skip).toHaveCount(0);
  await expect(verdict).toBeFocused();

  // A rematch, skipped this time.
  await page.getByRole("button", { name: fr.duels.result.rematch }).click();
  await expect(page).toHaveURL(/\/duel\/[^/]+\/run$/);
  await expect(verdict).toHaveCount(0); // the result page has left (its exit animation included)
  await playRun(page);
  await skip.click();
  await expect(verdict).toBeInViewport({ ratio: 1 });
  await expect(verdict).toBeFocused();

  // Reduced motion: no replay, the bilan is there at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: fr.duels.result.rematch }).click();
  await expect(page).toHaveURL(/\/duel\/[^/]+\/run$/);
  await expect(verdict).toHaveCount(0); // the result page has left (its exit animation included)
  await playRun(page);
  await expect(verdict).toBeInViewport({ ratio: 1, timeout: 15_000 });
});

test("locked duels: the profile explains what is missing", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await page.goto(`/u/${OPPONENT.id}`);

  await expect(page.getByText(fr.duels.locked)).toBeVisible();
  await expect(page.getByRole("button", { name: fr.duels.challenge })).toHaveCount(0);
});
