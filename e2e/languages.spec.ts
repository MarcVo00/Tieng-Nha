import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { firstLessonLink, onboard } from "./helpers";

test("choose Tagalog after onboarding, read the pronunciation, hear a tl-f voice file, then switch back to Vietnamese", async ({
  page,
  request,
}) => {
  // Onboarding ends on the language picker (the helper waits for /languages) and picks the Tagalog tile.
  await onboard(page, { language: "tl" });

  // The Tagalog path starts with its own first lesson.
  await expect(page.getByRole("button", { name: fr.languages.current("Tagalog") })).toBeVisible();
  const first = firstLessonLink(page, "disponible");
  await expect(first).toContainText("Salutations et politesse");

  // The vocab deck shows « salamat » with its pronunciation under it.
  await first.click();
  await expect(page).toHaveURL(/\/lesson\//);
  const next = page.getByRole("button", { name: fr.lessons.deck.next });
  // The card behind the top one is aria-hidden: only the top card counts.
  const top = page.locator('.col-start-1:not([aria-hidden="true"])');
  const pron = top.getByText("sa·LA·mat", { exact: true });
  for (let i = 0; i < 30 && !(await pron.isVisible()); i++) await next.click();
  await expect(pron).toBeVisible();
  await expect(top.locator('[lang="tl"]', { hasText: /^salamat$/ })).toBeVisible();

  // The speaker speaks the word (fake voice in e2e) and a Tagalog female voice file exists for it in the audio pack.
  await page.getByRole("button", { name: fr.ui.speaker.play, exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__voice").spoken as string[]))
    .toContain("salamat");
  const manifest = (await (await request.get("/audio/manifest.json")).json()) as { keys: Record<string, string>; voices: { id: string; keys: string[] }[] };
  const key = manifest.keys["salamat"];
  expect(key).toBeTruthy();
  expect(manifest.voices.find((v) => v.id === "tl-f")?.keys).toContain(key);
  const mp3 = await request.get(`/audio/tl-f/${key}.mp3`);
  expect(mp3.ok()).toBe(true);
  expect(mp3.headers()["content-type"]).toMatch(/audio/);

  // Back on the home, switch to Vietnamese: the Vietnamese path is back.
  await page.goto("/");
  await page.getByRole("button", { name: fr.languages.current("Tagalog") }).click();
  await page.getByRole("button", { name: /Vietnamien/ }).click();
  await expect(page.getByRole("button", { name: fr.languages.current("Vietnamien") })).toBeVisible();
  await expect(firstLessonLink(page)).toContainText("Les 6 tons");
});
