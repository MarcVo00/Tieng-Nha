import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedDialoguesCompleted, seedKimBai, seedLessonsCompleted } from "./helpers";

const SHOTS = process.env.NAV_SHOTS; // optional output directory for design-review screenshots

test("Arène groups the leaderboard and the duels; the Kim bài shop hangs off Duels", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await seedDialoguesCompleted(page, ["d01"]);
  await seedKimBai(page, 7);
  await page.reload();

  const bar = page.getByRole("navigation", { name: fr.ui.nav.label });
  await bar.getByRole("link", { name: fr.app.tabs.arena }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  const segments = page.getByRole("navigation", { name: fr.app.arenaNav.label });
  await expect(segments.getByRole("link", { name: fr.app.arenaNav.leaderboard })).toHaveAttribute("aria-current", "page");

  await segments.getByRole("link", { name: fr.app.arenaNav.duels }).click();
  await expect(page).toHaveURL(/\/duels$/);
  await expect(bar.getByRole("link", { name: fr.app.tabs.arena })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: new RegExp(fr.arena.entry) }).click();
  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByRole("heading", { name: fr.arena.title })).toBeAttached();
  await expect(bar.getByRole("link", { name: fr.app.tabs.arena })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: fr.arena.back }).click();
  await expect(page).toHaveURL(/\/duels$/);

  await bar.getByRole("link", { name: fr.app.tabs.shop }).click();
  await expect(page).toHaveURL(/\/shop$/);
});

for (const width of [360, 320]) {
  test(`the five tabs fit at ${width} px, one line each, touch-sized`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await onboard(page);
    await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
    await seedDialoguesCompleted(page, ["d01"]);
    await seedKimBai(page, 7);
    await page.reload();

    const bar = page.getByRole("navigation", { name: fr.ui.nav.label });
    const links = bar.getByRole("link");
    await expect(links).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const link = links.nth(i);
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      const label = await link.evaluate((el) => {
        const span = Array.from(el.querySelectorAll("span")).find((s) => s.className.includes("whitespace-nowrap"));
        const r = span?.getBoundingClientRect();
        return { w: r?.width ?? 0, h: r?.height ?? 0, cw: el.getBoundingClientRect().width, sw: span ? span.scrollWidth : 0 };
      });
      expect(label.w, `${await link.innerText()} ${JSON.stringify(label)}`).toBeLessThanOrEqual(label.cw);
      expect(label.h).toBeLessThan(20);
    }
    const wide = await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.tagName + "." + String(e.className).slice(0, 40)).slice(0, 6));
    expect(wide).toEqual([]);

    if (SHOTS) {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForTimeout(400);
        const shoot = async (name: string) => page.screenshot({ path: `${SHOTS}/${name}-${width}-${scheme}.png` });
        await page.goto("/leaderboard");
        await expect(page.getByRole("heading", { name: fr.leaderboard.title })).toBeVisible();
        await shoot("classement");
        await page.goto("/duels");
        await expect(page.getByRole("heading", { name: fr.duels.title })).toBeVisible();
        await shoot("duels");
        await page.goto("/arena");
        await expect(page.getByText(fr.arena.balance(7), { exact: true })).toBeVisible();
        await shoot("boutique-arene");
      }
    }
  });
}
