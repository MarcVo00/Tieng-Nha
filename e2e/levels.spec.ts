import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, seedBossWon, seedDialoguesCompleted, seedLessonsCompleted } from "./helpers";

const SHOTS = process.env.NAV_SHOTS; // optional output directory for design-review screenshots
const ids = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, "0")}`);

test("level 2 stays locked until Thủy Tinh is beaten, then opens up to Sơn Tinh", async ({ page }) => {
  await onboard(page);
  await seedLessonsCompleted(page, ids("l", 1, 10));
  await seedDialoguesCompleted(page, ["d01"]);
  await page.goto("/");

  // All the lessons of level 1 are not enough: the boss closes the way.
  await expect(page.getByText(fr.home.level.locked("Thủy Tinh"))).toBeVisible();
  const first = page.getByRole("button", { name: /À la maison.*verrouillée/ });
  await first.scrollIntoViewIfNeeded();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/level-locked.png` });
  await first.click({ force: true }); // aria-disabled: Playwright would wait for it to be enabled
  await expect(page.getByText(fr.home.level.lockedToast("Thủy Tinh"))).toBeVisible();

  await seedBossWon(page, "exam");
  await page.goto("/");
  await expect(page.getByText(fr.home.level.locked("Thủy Tinh"))).toHaveCount(0);
  const open = page.getByRole("link", { name: /À la maison.*disponible/ });
  await expect(open).toHaveAttribute("href", "/lesson/l11");
  await open.scrollIntoViewIfNeeded();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/level-open.png` });

  await seedLessonsCompleted(page, ids("l", 11, 16));
  await page.goto("/");
  await page.getByRole("link", { name: fr.home.exam.aria("Sơn Tinh", 2, false) }).click();
  await expect(page).toHaveURL(/\/exam\/boss_son_tinh$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sơn Tinh" })).toBeVisible();
  if (SHOTS) {
    await page.waitForTimeout(800); // the page transition
    await page.screenshot({ path: `${SHOTS}/son-tinh.png` });
  }
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: fr.exam.run.bossHp("Sơn Tinh", 15, 15) })).toBeVisible();
  await expect(page.locator("[data-exercise-id]").first()).toHaveAttribute("data-exercise-id", /^exam_e(0[7-9]|1)/);
});

test("the Tagalog path: Bakunawa opens level 2 and the Tikbalang waits at its end", async ({ page }) => {
  await onboard(page, { language: "tl" });
  await seedLessonsCompleted(page, ids("tl_l", 1, 8));
  await seedBossWon(page, "tl_exam");
  await seedLessonsCompleted(page, ids("tl_l", 9, 14));
  await page.goto("/");
  await page.getByRole("link", { name: fr.home.exam.aria("Tikbalang", 2, false) }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tikbalang" })).toHaveAttribute("lang", "tl");
  if (SHOTS) {
    await page.waitForTimeout(800); // the page transition
    await page.screenshot({ path: `${SHOTS}/tikbalang.png` });
  }
});
