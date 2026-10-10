import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { firstLessonLink, onboard, openFirstLessonAndFinishDeck } from "./helpers";

test("with the service worker in control, the app shell boots offline and lesson 1 starts from cache", async ({ page, context }) => {
  await onboard(page);

  // The preview build registers the service worker: wait until it is active, then make sure it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect(firstLessonLink(page, "disponible")).toBeVisible();

  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  // A cold reload without network is served by the service worker; the fake session survives in sessionStorage.
  await page.reload();
  await expect(page.getByRole("heading", { name: fr.app.error.title })).toHaveCount(0);
  await expect(firstLessonLink(page, "disponible")).toBeVisible();

  // The lesson itself opens and reaches its first exercise with the network cut.
  await openFirstLessonAndFinishDeck(page);
  await expect(
    page.getByRole("button", { name: fr.exercises.verify }).or(page.getByRole("button", { name: fr.exercises.speak.micLabel, exact: true })),
  ).toBeVisible();

  await context.setOffline(false);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: fr.app.error.title })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: fr.ui.nav.label })).toBeVisible();
  await expect(firstLessonLink(page)).toBeVisible();
});
