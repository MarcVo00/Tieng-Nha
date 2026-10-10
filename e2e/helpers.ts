import { expect, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";

export const PSEUDO = "Marc";

/** Welcome -> invite + email -> OTP -> pseudo + avatar -> device check -> install, ending on the home path. */
export async function onboard(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForURL("**/welcome");
  await page.getByRole("button", { name: fr.onboarding.welcome.start }).click();

  await page.getByLabel(fr.onboarding.invite.inviteLabel).fill("TEST-CODE");
  await page.getByLabel(fr.onboarding.invite.emailLabel).fill("test@example.com");
  await page.getByRole("button", { name: fr.onboarding.invite.send }).click();

  await page.getByLabel(fr.onboarding.invite.codeLabel).fill("123456");
  await page.getByRole("button", { name: fr.onboarding.invite.verify }).click();

  await page.getByLabel(fr.onboarding.profile.pseudoLabel).fill(PSEUDO);
  await page.getByRole("radiogroup", { name: fr.onboarding.profile.avatarLabel }).getByRole("radio").first().click();
  await page.getByRole("button", { name: fr.onboarding.profile.submit }).click();

  await page.getByRole("button", { name: fr.onboarding.device.next }).click();

  // The install step shows "Plus tard" only when the browser offers a native prompt; otherwise "C'est parti !".
  const later = page.getByRole("button", { name: fr.onboarding.install.later });
  const finish = page.getByRole("button", { name: fr.onboarding.install.finish });
  await later.or(finish).first().click();

  await expect(page).toHaveURL(/\/$/);
}

/** First stop of the home path, available once onboarding is done. */
export function firstLessonLink(page: Page, state: "disponible" | "any" = "any") {
  const suffix = state === "disponible" ? ".*disponible" : "";
  return page.getByRole("link", { name: new RegExp(`^Leçon 1 :${suffix}`) });
}

/** Opens the first available lesson from the home path and clicks through the vocab deck. */
export async function openFirstLessonAndFinishDeck(page: Page): Promise<void> {
  await firstLessonLink(page, "disponible").click();
  await expect(page).toHaveURL(/\/lesson\//);
  const start = page.getByRole("button", { name: fr.lessons.deck.start });
  const next = page.getByRole("button", { name: fr.lessons.deck.next });
  for (let i = 0; i < 60; i++) {
    await start.or(next).first().waitFor();
    if (await start.isVisible()) {
      await start.click();
      return;
    }
    await next.click();
  }
  throw new Error("Vocab deck never reached its last card");
}

/**
 * Plays exercises without knowing the answers: picks the first choice / tone, fills a word bank in displayed order,
 * taps the (fake) mic, then continues. Ends on the done screen or the "no more hearts" panel. Returns which one.
 */
export async function playThrough(page: Page): Promise<"done" | "failed"> {
  const done = page.getByText(new RegExp(`${fr.lessons.done.good}|${fr.lessons.done.perfect}`));
  const failed = page.getByText(fr.lessons.failed.title);
  const verify = page.getByRole("button", { name: fr.exercises.verify });
  const mic = page.getByRole("button", { name: fr.exercises.speak.micLabel, exact: true });
  const cont = page.getByRole("button", { name: fr.ui.feedback.continue, exact: true });
  const bankTiles = page.getByRole("group", { name: fr.exercises.wordOrder.bank }).getByRole("button");
  const choices = page.locator("button[aria-pressed]:not([aria-label])");

  // The feedback sheet animates out: wait until it is gone so the next loop turn never sees the stale button.
  const continueAndWaitGone = async () => {
    await cont.click();
    await expect(cont).toBeHidden();
  };

  for (let i = 0; i < 120; i++) {
    await done.or(failed).or(verify).or(mic).or(cont).first().waitFor();
    if (await done.isVisible()) return "done";
    if (await failed.isVisible()) return "failed";
    if (await cont.isVisible()) {
      await continueAndWaitGone();
      continue;
    }
    if (await mic.isVisible()) {
      await mic.click();
      await cont.or(done).or(failed).first().waitFor();
      continue;
    }
    // Verify is visible: build an answer first.
    if (await page.getByRole("group", { name: fr.exercises.wordOrder.bank }).isVisible()) {
      for (let t = 0; t < 30 && (await bankTiles.count()) > 0; t++) await bankTiles.first().click();
    } else {
      await choices.first().click();
    }
    await verify.click();
    await cont.or(done).or(failed).first().waitFor();
  }
  throw new Error("Lesson did not reach the done or failed state");
}
