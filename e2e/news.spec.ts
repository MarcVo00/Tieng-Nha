import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

const SHOTS = process.env.NAV_SHOTS; // optional output directory for design-review screenshots

test("Nouveautés: a dot on Moi until the page is opened, and the current version is marked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await onboard(page);

  const bar = page.getByRole("navigation", { name: fr.ui.nav.label });
  await expect(bar.getByTestId("tab-dot")).toBeVisible();
  await bar.getByRole("link", { name: fr.app.tabs.me }).click();
  const row = page.getByRole("link", { name: fr.news.meRow("1.7.0") });
  await expect(row).toBeVisible();

  if (SHOTS) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(400);
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/moi-nouveautes-360-${scheme}.png` });
    }
  }

  await row.click();
  await expect(page).toHaveURL(/\/news$/);
  await expect(page.getByRole("heading", { name: fr.news.title })).toBeVisible();
  await expect(page.getByText(fr.news.current)).toHaveCount(1);
  await expect(bar.getByTestId("tab-dot")).toHaveCount(0);
  await expect(bar.getByRole("link", { name: fr.app.tabs.me })).toHaveAttribute("aria-current", "page");

  if (SHOTS) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/nouveautes-360-${scheme}.png` });
    }
  }

  // Seen survives a reload: no dot on Moi any more.
  await page.reload();
  await expect(page.getByRole("heading", { name: fr.news.title })).toBeVisible();
  await expect(bar.getByTestId("tab-dot")).toHaveCount(0);
  await page.getByRole("link", { name: fr.news.back }).click();
  await expect(page).toHaveURL(/\/me$/);
});
