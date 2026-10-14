import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("the boss is locked with 0 lessons done and cannot be started", async ({ page }) => {
  await onboard(page);
  await page.goto("/exam"); // deep link: the fake session survives a full page load
  const t = fr.exam.intro.locked;
  await expect(page.getByText(t.title)).toBeVisible();
  await expect(page.getByText(t.progress(0, 10), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: fr.exam.intro.start })).toHaveCount(0);
});
