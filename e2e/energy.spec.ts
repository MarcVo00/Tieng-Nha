import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { firstLessonLink, onboard } from "./helpers";

test("starting a lesson spends one energy, shown in the header", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("button", { name: fr.energy.label(5, 5) })).toBeVisible();
  await firstLessonLink(page, "disponible").click();
  await expect(page).toHaveURL(/\/lesson\//);
  // Wait for the lesson to be loaded: the energy is spent once the lesson has opened.
  await page
    .getByRole("button", { name: fr.lessons.deck.next })
    .or(page.getByRole("button", { name: fr.lessons.deck.start }))
    .first()
    .waitFor();
  await page.goto("/");
  await expect(page.getByRole("button", { name: fr.energy.label(4, 5) })).toBeVisible();
  await page.getByRole("button", { name: fr.energy.label(4, 5) }).click();
  await expect(page.getByText(fr.energy.explain)).toBeVisible();
});
