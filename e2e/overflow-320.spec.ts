import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedDialoguesCompleted, seedKimBai, seedLessonsCompleted } from "./helpers";

const WIDTH = 320;
const SHOTS = process.env.NAV_SHOTS; // optional output directory for before/after screenshots
const GUTTER = 16;

async function shoot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-320-${scheme}.png` });
  }
}
const TEN = Array.from({ length: 10 }, (_, i) => `l${String(i + 1).padStart(2, "0")}`);

/** The page must not scroll sideways, and no element may poke out of the viewport (the widest offenders are named). */
async function expectNoOverflow(page: Page, label: string): Promise<void> {
  // Wait for the screen to settle (not a fixed pause): main content in, skeleton shimmers gone (they loop forever and sweep outside their clipped box), transitions and animations finished.
  await page.locator("main").first().waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-busy="true"], [aria-hidden="true"] > .overflow-hidden > span.absolute.inset-0.opacity-60').length === 0 && document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = Array.from(document.querySelectorAll("body *"))
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > vw + 1 || r.left < -1))
      .map(({ e, r }) => `${e.tagName.toLowerCase()}.${String(e.getAttribute("class") ?? "").slice(0, 50)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    return { vw, scrollWidth: document.documentElement.scrollWidth, out: out.slice(0, 6) };
  });
  expect(report.scrollWidth, `${label}: page scrolls sideways ${JSON.stringify(report)}`).toBeLessThanOrEqual(report.vw);
  expect(report.out, `${label}: elements outside the viewport`).toEqual([]);
}

test.describe(`no horizontal overflow at ${WIDTH} px`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 640 });
  });

  test("home path: fresh and mid-progress", async ({ page }) => {
    await onboard(page);
    await shoot(page, "home-fresh");
    await expectNoOverflow(page, "home fresh");
    await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
    await page.reload();
    await shoot(page, "home-mid");
    await expectNoOverflow(page, "home mid-progress");
    await seedLessonsCompleted(page, TEN.slice(3));
    await page.reload();
    await expectNoOverflow(page, "home all lessons done");
  });

  test("boss fight HP row", async ({ page }) => {
    await onboard(page);
    await seedLessonsCompleted(page, TEN);
    await page.goto("/exam");
    await expectNoOverflow(page, "boss intro");
    await page.getByRole("button", { name: fr.exam.intro.start }).click();
    await expect(page.getByRole("progressbar", { name: /Thủy Tinh/ })).toBeVisible();
    await shoot(page, "boss-fight");
    await expectNoOverflow(page, "boss fight");
    // The HP row keeps the page gutter: the last water drop does not run into the screen edge.
    const hp = await page.getByRole("progressbar", { name: /Thủy Tinh/ }).boundingBox();
    expect((hp?.x ?? 0) + (hp?.width ?? 0)).toBeLessThanOrEqual(WIDTH - GUTTER);
  });

  test("tab screens", async ({ page }) => {
    await onboard(page);
    await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
    await seedDialoguesCompleted(page, ["d01"]);
    await seedKimBai(page, 7);
    await page.reload();
    for (const path of ["/review", "/leaderboard", "/duels", "/arena", "/shop", "/me", "/news"]) {
      await page.goto(path);
      await expectNoOverflow(page, path);
    }
  });
});
