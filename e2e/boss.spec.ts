import { expect, test, type Locator, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fr } from "@/i18n/fr";
import { onboard, seedLessonsCompleted } from "./helpers";

test("after the ten lessons, Thủy Tinh can be challenged: HP bar and five lives", async ({ page }) => {
  await onboard(page);
  // Mark the ten lessons as done straight in the local event log.
  await seedLessonsCompleted(page, Array.from({ length: 10 }, (_, i) => `l${String(i + 1).padStart(2, "0")}`));
  await page.goto("/exam");
  await expect(page.getByRole("heading", { name: "Thủy Tinh" })).toBeVisible();
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeVisible();
  await expect(page.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeVisible();
});

// --- Playing the fight to its end -------------------------------------------------------------------------------
// The answers are known from the content files. Without voice capabilities the listening questions print the Vietnamese
// word (the boss name is the first lang="vi" paragraph, the question the last) and the deck has no speaking questions.

async function seedNoVoiceSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("tieng-nha");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    const row = await new Promise<{ value: Record<string, unknown> } | undefined>((res) => {
      const g = store.get("settings");
      g.onsuccess = () => res(g.result as { value: Record<string, unknown> } | undefined);
    });
    store.put({ key: "settings", value: { ...(row?.value ?? {}), capabilities: { tts: false, stt: false, recorder: false } } });
    await new Promise((res) => { tx.oncomplete = res; });
  });
}

// The answers come straight from the content files the app ships (src/content).
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8")) as Json;
const FRENCH_OF_VIETNAMESE = new Map<string, string>();
for (const f of readdirSync(resolve(process.cwd(), "src/content/lessons"))) {
  for (const v of readJson("src/content/lessons/" + f)["vocab"] as { vi: string; fr: string }[]) FRENCH_OF_VIETNAMESE.set(v.vi, v.fr);
}
const TRANSLATION = new Map<string, string>();
const WORD_ORDER = new Map<string, string[]>();
const TONE = new Map<string, string>();
const TONE_MARKS = new RegExp(String.fromCharCode(91, 0x300, 0x301, 0x303, 0x309, 0x323, 93), "g");
const withoutToneMark = (syllable: string): string => syllable.normalize("NFD").replace(TONE_MARKS, "").normalize("NFC");
for (const q of readJson("src/content/exam.json")["questions"] as { exercise: Json }[]) {
  const e = q.exercise;
  if (e["type"] === "translate_choose") TRANSLATION.set(e["promptFr"] as string, e["answerVi"] as string);
  if (e["type"] === "word_order") WORD_ORDER.set(e["fr"] as string, e["tokensVi"] as string[]);
  // The page prints the syllable without its tone mark; the one homograph (tam) keeps its first tone, a miss costs one life of five.
  if (e["type"] === "tone_pick" && !TONE.has(withoutToneMark(e["syllable"] as string))) {
    TONE.set(withoutToneMark(e["syllable"] as string), fr.ui.tones[e["answerTone"] as keyof typeof fr.ui.tones]);
  }
}

/** Answers the question on screen, rightly or wrongly, then continues. */
async function answerOne(page: Page, right: boolean): Promise<void> {
  const verify = page.getByRole("button", { name: fr.exercises.verify });
  const choices = page.locator("button[aria-pressed]:not([aria-label])");

  if (await page.getByRole("group", { name: fr.exercises.wordOrder.bank }).isVisible()) {
    const fre = (await page.locator('h2[lang="fr"]').first().textContent()) ?? "";
    const tokens = WORD_ORDER.get(fre) ?? [];
    const order = right ? tokens : [...tokens].reverse();
    for (const t of order) await page.getByRole("group", { name: fr.exercises.wordOrder.bank }).getByRole("button", { name: t, exact: true }).first().click();
  } else if (await page.locator('h2[lang="fr"]').first().isVisible()) {
    const fre = (await page.locator('h2[lang="fr"]').first().textContent()) ?? "";
    const answerVi = TRANSLATION.get(fre);
    const names = await choices.allTextContents();
    const target = right ? answerVi : names.find((n) => n !== answerVi && n !== "");
    const at = names.findIndex((n) => n === target);
    await choices.nth(at).click();
  } else if (await page.locator('p[lang="vi"]').last().isVisible()) {
    const vi = (await page.locator('p[lang="vi"]').last().textContent()) ?? "";
    const label = TONE.get(vi) ?? FRENCH_OF_VIETNAMESE.get(vi) ?? "";
    const names = await choices.allTextContents();
    const exact = names.findIndex((n) => n.trim() === label); // « café » is also inside « café noir »
    const idx = exact >= 0 ? exact : names.findIndex((n) => n.includes(label));
    await choices.nth(right ? idx : idx === 0 ? 1 : 0).click();
  } else {
    throw new Error("Unknown question on screen");
  }
  await verify.click();
  // Exam mode has no feedback sheet: the next question replaces this one (its Vérifier starts disabled) or the fight ends.
  await expect(verify).toBeDisabled({ timeout: 3000 }).catch(() => undefined);
}

/** Answers until the headline appears (the fight saves, then navigates). */
async function playUntil(page: Page, right: boolean, headline: Locator): Promise<void> {
  const verify = page.getByRole("button", { name: fr.exercises.verify });
  for (let i = 0; i < 40 && !(await headline.isVisible()); i++) {
    if (await verify.isVisible()) await answerOne(page, right);
    else await page.waitForTimeout(100);
  }
}

async function startBossFight(page: Page): Promise<void> {
  await onboard(page);
  await seedLessonsCompleted(page, Array.from({ length: 10 }, (_, i) => `l${String(i + 1).padStart(2, "0")}`));
  await seedNoVoiceSettings(page);
  await page.goto("/exam");
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: /Thủy Tinh/ })).toBeVisible();
  // The fight stage: the player's hero facing Thủy Tinh.
  const stage = page.getByRole("group", { name: fr.exam.run.stage("Thủy Tinh") });
  await expect(stage.getByRole("img", { name: fr.exam.run.hero })).toBeVisible();
  await expect(stage.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeVisible();
}

test("boss lost: the result screen shows and stays on /exam/result", async ({ page }) => {
  await startBossFight(page);
  const lost = page.getByRole("heading", { name: fr.exam.result.lost("Thủy Tinh") });
  await playUntil(page, false, lost);
  await expect(lost).toBeVisible();
  await page.waitForTimeout(800); // a bounce back to the intro would happen while the run screen leaves
  await expect(page).toHaveURL(/\/exam\/result$/);
  await expect(lost).toBeVisible();
  await expect(page.getByText(fr.exam.result.damage(0, 15))).toBeVisible();
  await expect(page.getByRole("button", { name: fr.exam.result.retry(2) })).toBeVisible();
});

test("boss won: the result screen shows and stays on /exam/result", async ({ page }) => {
  await startBossFight(page);
  const won = page.getByRole("heading", { name: fr.exam.result.won("Thủy Tinh") });
  await playUntil(page, true, won);
  await expect(won).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/exam\/result$/);
  await expect(won).toBeVisible();
  // The defeated boss bows beside the hero; the certificate follows.
  await expect(page.getByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Certificat de réussite/ })).toBeVisible();
});
