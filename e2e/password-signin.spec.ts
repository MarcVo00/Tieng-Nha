import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { EMAIL, onboard, PASSWORD } from "./helpers";

test("sign out, then sign back in with e-mail and password", async ({ page }) => {
  await onboard(page);

  await page.goto("/me"); // deep link: the fake session survives a full page load
  await page.getByRole("button", { name: fr.profile.account.signOut.open }).click();
  await page.getByRole("button", { name: fr.profile.account.signOut.confirm, exact: true }).click();
  await page.waitForURL("**/welcome");

  await page.getByRole("button", { name: fr.onboarding.welcome.signIn }).click();
  await page.getByLabel(fr.onboarding.signIn.emailLabel).fill(EMAIL);
  await page.getByLabel(fr.onboarding.signIn.passwordLabel, { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: fr.onboarding.signIn.submit }).click();
  await expect(page.getByText(fr.onboarding.signIn.invalid)).toBeVisible();

  await page.getByLabel(fr.onboarding.signIn.passwordLabel, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: fr.onboarding.signIn.submit }).click();

  // A returning user skips the device and install steps and lands on the home path directly.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: fr.ui.nav.label })).toBeVisible();
});
