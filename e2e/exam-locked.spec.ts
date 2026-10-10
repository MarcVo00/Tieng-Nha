import { expect, test } from "@playwright/test";
import { navigateInApp, onboard } from "./helpers";

test("the final test is locked until the 10 lessons are done", async ({ page }) => {
  await onboard(page);
  await navigateInApp(page, "/exam");
  await expect(page.getByText(/0\s*\/\s*10/)).toBeVisible();
});
