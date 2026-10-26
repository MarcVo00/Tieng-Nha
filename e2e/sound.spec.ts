import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard, openFirstLessonAndFinishDeck, playedSounds } from "./helpers";

type LessonFile = { vocab: { id: string; fr: string }[]; exercises: { id: string; type: string; vocabId?: string }[] };
const lesson: LessonFile = JSON.parse(readFileSync(join(process.cwd(), "src/content/lessons/l01.json"), "utf8"));

/** Picks the right French meaning on the first listening exercise (the lesson starts with those), without verifying. */
async function chooseRightAnswer(page: Page): Promise<void> {
  const host = page.locator("[data-exercise-id]");
  await expect(host).toHaveCount(1);
  const id = await host.getAttribute("data-exercise-id");
  const exercise = lesson.exercises.find((e) => e.id === id);
  if (!exercise || exercise.type !== "listen_choose") throw new Error(`expected a listening exercise first, got ${exercise?.type ?? id}`);
  const word = lesson.vocab.find((v) => v.id === exercise.vocabId);
  if (!word) throw new Error(`no vocab for ${exercise.vocabId}`);
  await page.getByRole("button", { name: word.fr, exact: true }).click();
}

const verify = (page: Page) => page.getByRole("button", { name: fr.exercises.verify });

async function startExercises(page: Page): Promise<void> {
  await openFirstLessonAndFinishDeck(page);
  await expect(page.getByText(fr.exercises.listenChoose.prompt)).toBeVisible();
}

test("a right answer sounds as the feedback opens", async ({ page }) => {
  await onboard(page);
  await startExercises(page);
  await chooseRightAnswer(page);
  expect((await playedSounds(page)).map((s) => s.cue)).not.toContain("answer.correct");
  await verify(page).click();
  await expect(page.getByRole("status")).toBeVisible();
  const played = await playedSounds(page);
  expect(played.map((s) => s.cue)).toContain("answer.correct");
});

test("while the voice is speaking the cue is recorded soft, never over it", async ({ page }) => {
  await onboard(page);
  await startExercises(page);
  await chooseRightAnswer(page);
  // Keep the fake voice "speaking" for the whole check.
  await page.evaluate(() => {
    const voice: { delayMs: number } = Reflect.get(window, "__voice");
    const tts: { speak(text: string): Promise<void> } = Reflect.get(window, "__tts");
    voice.delayMs = 20_000;
    void tts.speak("xin chào");
  });
  await verify(page).click();
  await expect(page.getByRole("status")).toBeVisible();
  const played = (await playedSounds(page)).filter((s) => s.cue === "answer.correct");
  expect(played).toHaveLength(1);
  expect(played[0]?.soft).toBe(true);
});

test("turning « Sons » off in Moi silences the lessons, even after a reload", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  const sons = page.getByRole("switch", { name: fr.profile.settings.sound.label });
  await expect(sons).toBeChecked();
  await sons.click();
  await expect(sons).not.toBeChecked();

  await page.reload();
  await page.getByRole("link", { name: fr.app.tabs.learn }).click();
  await startExercises(page);
  await chooseRightAnswer(page);
  await verify(page).click();
  await expect(page.getByRole("status")).toBeVisible();
  expect(await playedSounds(page)).toEqual([]);
});
