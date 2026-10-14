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

  // Signing out wipes local settings, so the device may be asked for its test again before the home path.
  const next = page.getByRole("button", { name: fr.onboarding.device.next });
  const nav = page.getByRole("navigation", { name: fr.ui.nav.label });
  await next.or(nav).first().waitFor();
  if (await next.isVisible()) {
    await next.click();
    await page.getByRole("button", { name: fr.onboarding.install.later }).or(page.getByRole("button", { name: fr.onboarding.install.finish })).first().click();
  }
  await expect(page).toHaveURL(/\/$/);
  await expect(nav).toBeVisible();
});
