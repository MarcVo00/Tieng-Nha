import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import {
  finishRevealAll,
  fixGachaRolls,
  onboard,
  openFirstLessonAndFinishDeck,
  playedSounds,
  playRun,
  seedCoins,
  seedDialoguesCompleted,
  seedLessonsCompleted,
  shakeTube,
} from "./helpers";

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

test("a x10 pull: the shake, the omen of the forced rare, then ten flips, the best last", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 400);
  await page.reload();
  await page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();
  const banner = page.getByRole("tabpanel", { name: fr.shop.themes.legendes_sombres! });
  await banner.getByRole("button", { name: fr.gacha.pullTen(360) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(360) });
  await shakeTube(page);
  const cues = async () => (await playedSounds(page)).map((s) => s.cue);
  // Nine commons and the rare the x10 rule forces: the omen announces the best piece.
  expect(await cues()).toEqual(["gacha.shake", "gacha.omen.rare"]);

  await scene.getByRole("button", { name: fr.gacha.scene.revealAll }).click();
  await finishRevealAll(page);
  const flips = (await cues()).filter((c) => c.startsWith("gacha.flip."));
  expect(flips).toHaveLength(10);
  expect(flips.filter((c) => c === "gacha.flip.common")).toHaveLength(9);
  expect(flips.at(-1)).toBe("gacha.flip.rare"); // lowest rarity first, highest last
});

test("a duel replay opens with the gong, then the blows, and the verdict sounds only the first time", async ({ page }) => {
  test.setTimeout(150_000);
  await onboard(page);
  await seedLessonsCompleted(page, ["l01", "l02", "l03"]);
  await seedDialoguesCompleted(page, ["d01"]);
  await page.goto("/u/bot_ba_ngoai");
  await page.getByRole("button", { name: fr.duels.challenge }).click();
  await playRun(page);
  await expect(page).toHaveURL(/\/duel\/[^/]+$/);

  // Played to the end: the gong first, then blows, then the verdict.
  const verdict = page.locator("#duel-verdict");
  await expect(verdict).toBeInViewport({ ratio: 1, timeout: 15_000 });
  const first = (await playedSounds(page)).map((s) => s.cue);
  expect(first[0]).toBe("arena.start");
  expect(first.some((c) => c.startsWith("blow."))).toBe(true);
  expect(first.filter((c) => c === "arena.victory" || c === "arena.defeat")).toHaveLength(1);

  // Seen again on this device: the fight is replayed, the verdict stays quiet.
  const heard = first.length;
  // (In-app navigation: the fakes live in memory, a reload would lose the duel.)
  await page.getByRole("button", { name: fr.duels.result.back }).click();
  await page.getByRole("link").filter({ hasText: fr.duels.hub.versus("Bà Ngoại") }).first().click();
  await expect(page).toHaveURL(/\/duel\/[^/]+$/);
  await page.getByRole("button", { name: fr.duels.result.skip }).click();
  await expect(verdict).toBeVisible();
  const again = (await playedSounds(page)).slice(heard).map((s) => s.cue);
  expect(again).toContain("arena.start");
  expect(again.filter((c) => c === "arena.victory" || c === "arena.defeat")).toEqual([]);
});
