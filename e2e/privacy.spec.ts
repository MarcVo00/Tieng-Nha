import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("the profile leads to the privacy page, the data download and a password-guarded deletion", async ({ page }) => {
  await onboard(page);
  await page.goto("/me");

  await page.getByRole("link", { name: fr.privacy.title }).click();
  await expect(page.getByRole("heading", { name: fr.privacy.title })).toBeVisible();
  await expect(page.getByText(fr.privacy.who.fallback)).toBeVisible();
  if (process.env["PRIVACY_SHOT"]) await page.screenshot({ path: process.env["PRIVACY_SHOT"], fullPage: true });
  await page.getByRole("link", { name: fr.privacy.back }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: fr.profile.account.export.open }).click();
  expect((await download).suggestedFilename()).toBe("tieng-nha-mes-donnees.json");

  await page.getByRole("button", { name: fr.profile.account.delete.open }).click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: fr.profile.account.delete.confirm });
  await dialog.getByLabel(fr.ui.confirm.inputLabel).fill(fr.profile.account.delete.word);
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(fr.ui.confirm.passwordLabel).fill("wrong-password");
  await confirm.click();
  await expect(page.getByText(fr.profile.account.delete.wrongPassword)).toBeVisible();
  await expect(page).toHaveURL(/\/me$/);
});
