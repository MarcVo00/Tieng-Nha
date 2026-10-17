import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedLessonsCompleted } from "./helpers";

test("after the ten lessons, Thủy Tinh can be challenged: HP bar and five lives", async ({ page }) => {
  await onboard(page);
  // Mark the ten lessons as done straight in the local event log.
  await seedLessonsCompleted(page, Array.from({ length: 10 }, (_, i) => `l${String(i + 1).padStart(2, "0")}`));
  await page.goto("/exam");
  await expect(page.getByRole("heading", { name: "Thủy Tinh" })).toBeVisible();
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeVisible();
  await expect(page.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeVisible();
});
