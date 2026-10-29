import { expect, test, type Page } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { finishRevealAll, fixGachaRolls, onboard, seedCoins, seedCompleteGachaSet, shakeTube } from "./helpers";

// Every roll is 0: the first common by id (Lance de bambou), then, in a x10, the forced rare (Éventail de fer).
const BAMBOO = fr.shop.items.acc_giao_tre!.name;
const FAN = fr.shop.items.acc_quat_sat!.name;

const banner = (page: Page) => page.getByRole("tabpanel", { name: fr.shop.themes.legendes_sombres! });
const openShop = (page: Page) => page.getByRole("link", { name: fr.app.tabs.shop, exact: true }).click();
const balance = (page: Page, xu: number) => expect(page.getByText(fr.shop.balance(xu), { exact: true })).toBeVisible();

async function wardrobe(page: Page) {
  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  const section = page.locator("#me-wardrobe");
  await section.scrollIntoViewIfNeeded();
  return section;
}

test("pull once: the omen, one face-down card, the scroll, the new piece in the wardrobe, 40 xu less", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  await page.reload();
  await openShop(page);
  await balance(page, 100);

  await banner(page).getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await expect(scene.locator("[data-card]")).toHaveCount(1);
  await scene.getByRole("button", { name: fr.gacha.scene.card(1) }).click();
  await expect(scene.locator('[data-seal="common"]')).toHaveText(fr.shop.rarities.common);
  await expect(scene.getByRole("heading", { name: BAMBOO })).toBeVisible();
  await expect(scene.getByRole("status")).toHaveText(fr.gacha.scene.announce(BAMBOO, fr.shop.rarities.common, fr.gacha.resultNew));
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 60);
  await expect(banner(page).getByText(fr.gacha.ownedCount(1, 12))).toBeVisible();

  const section = await wardrobe(page);
  const card = section.getByRole("listitem").filter({ hasText: BAMBOO });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: fr.shop.tryOn.equip }).click();
  await expect(card.getByRole("button", { name: fr.shop.tryOn.unequip })).toBeVisible();
});

test("pull ten: one card turned, « Tout découvrir », then the recap with the refunds, the balance and the wardrobe", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 400);
  await page.reload();
  await openShop(page);

  await banner(page).getByRole("button", { name: fr.gacha.pullTen(360) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(360) });
  await shakeTube(page);
  // Ten identical face-down cards: nothing tells the rarity before a card is turned.
  await expect(scene.locator("[data-card]")).toHaveCount(10);
  await expect(scene.locator("[data-cards] [data-face], [data-cards] [data-rarity]")).toHaveCount(0);
  // The tenth is the rare the x10 rule forces.
  await scene.getByRole("button", { name: fr.gacha.scene.card(10) }).click();
  await expect(scene.getByRole("heading", { name: FAN })).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene.getByRole("button", { name: fr.gacha.scene.cardOpen(10, FAN, fr.shop.rarities.rare) })).toBeVisible();
  await expect(scene.getByRole("button", { name: fr.gacha.scene.card(1) })).toBeFocused();
  await scene.getByRole("button", { name: fr.gacha.scene.revealAll }).click();
  await finishRevealAll(page);

  await expect(scene.getByRole("heading", { name: fr.gacha.resultTitle })).toBeVisible();
  await expect(scene.getByRole("listitem")).toHaveCount(10);
  await expect(scene.getByText(fr.gacha.resultNew)).toHaveCount(2);
  await expect(scene.getByText(fr.gacha.scene.duplicate(8))).toHaveCount(8);
  await expect(scene.getByText(fr.gacha.resultTotal(64))).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 400 - 360 + 64);

  const section = await wardrobe(page);
  await expect(section.getByRole("listitem").filter({ hasText: BAMBOO })).toBeVisible();
  await expect(section.getByRole("listitem").filter({ hasText: FAN })).toBeVisible();
});

test("« Passer » during the omen shows the recap of the ten pieces drawn", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 400);
  await page.reload();
  await openShop(page);

  await banner(page).getByRole("button", { name: fr.gacha.pullTen(360) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(360) });
  await scene.getByRole("button", { name: fr.gacha.scene.shake }).click();
  await expect(scene).toHaveAttribute("data-phase", "omen");
  await scene.getByRole("button", { name: fr.gacha.scene.skip }).click();
  await expect(scene).toHaveAttribute("data-phase", "recap");
  await expect(scene.getByRole("listitem")).toHaveCount(10);
  await expect(scene.getByText(fr.gacha.resultTotal(64))).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 400 - 360 + 64);
});

test("a complete set can still be pulled: everything comes back in xu", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 40);
  await seedCompleteGachaSet(page);
  await page.reload();
  await openShop(page);
  await expect(banner(page).getByText(fr.gacha.complete)).toBeVisible();

  await banner(page).getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await scene.getByRole("button", { name: fr.gacha.scene.card(1) }).click();
  await expect(scene.locator("[data-scroll]").getByText(fr.gacha.scene.duplicate(8))).toBeVisible(); // the status line says it too
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 8); // 40 - 40 + 8
  await expect(banner(page).getByText(fr.gacha.ownedCount(12, 12))).toBeVisible();
});

test("a pull the server made but the phone never applied is recovered once, as « Tirage récupéré », debited once", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  await page.reload();
  await openShop(page);
  await banner(page).getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await scene.getByRole("button", { name: fr.gacha.scene.card(1) }).click();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 60);

  // Simulate the crash: the (fake) server kept and debited the pull, the phone lost the journal entry and still has the pending id.
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("tieng-nha");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    const all: { clientId: string; type: string; refId: string }[] = await new Promise((res) => {
      const q = store.getAll();
      q.onsuccess = () => res(q.result);
    });
    const pulled = all.filter((e) => e.type === "gacha_pulled");
    for (const e of pulled) store.delete(e.clientId);
    await new Promise((res) => { tx.oncomplete = res; });
    localStorage.setItem("tn-gacha-pending:me", JSON.stringify(pulled.map((e) => ({ id: e.refId, theme: "legendes_sombres", count: 1 }))));
    window.dispatchEvent(new Event("online"));
  });

  const recovery = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await expect(recovery).toHaveAttribute("data-phase", "recap");
  await expect(recovery.getByRole("heading", { name: fr.gacha.recovered })).toBeVisible();
  await expect(recovery.getByText(BAMBOO)).toBeVisible();
  await recovery.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(recovery).toHaveCount(0);
  await balance(page, 60); // debited once, not twice
  await expect.poll(() => page.evaluate(() => localStorage.getItem("tn-gacha-pending:me"))).toBe("[]");

  // Nothing comes back a second time.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await balance(page, 60);
});

test("a pending id the server never saw is dropped: no surprise pull, no xu spent", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  await page.evaluate(() => localStorage.setItem("tn-gacha-pending:me", JSON.stringify([{ id: "never-sent", theme: "legendes_sombres", count: 1 }])));
  await page.reload();
  await openShop(page);
  await balance(page, 100);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("tn-gacha-pending:me"))).toBe("[]");
});

test("three banners: a pull in « Esprits de la nuit » counts only there, and the tab is remembered after a reload", async ({ page }) => {
  await fixGachaRolls(page);
  await onboard(page);
  await seedCoins(page, 100);
  await page.reload();
  await openShop(page);

  const night = fr.shop.themes.esprits_de_la_nuit!;
  const nightPanel = page.getByRole("tabpanel", { name: night });
  const nightPiece = fr.shop.items.acc_long_den!.name; // the first common by id of the theme
  await page.getByRole("tab", { name: night }).click();
  await expect(nightPanel).toBeVisible();
  await expect(nightPanel.getByText(fr.gacha.ownedCount(0, 12))).toBeVisible();

  await nightPanel.getByRole("button", { name: fr.gacha.pullOne(40) }).click();
  const scene = page.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  await shakeTube(page);
  await scene.getByRole("button", { name: fr.gacha.scene.card(1) }).click();
  await expect(scene.getByRole("heading", { name: nightPiece })).toBeVisible();
  await scene.getByRole("button", { name: fr.gacha.resultContinue }).click();
  await expect(scene).toHaveCount(0);
  await balance(page, 60);
  await expect(nightPanel.getByText(fr.gacha.ownedCount(1, 12))).toBeVisible();

  // The first banner is untouched.
  await page.getByRole("tab", { name: fr.shop.themes.legendes_sombres! }).click();
  await expect(banner(page).getByText(fr.gacha.ownedCount(0, 12))).toBeVisible();

  // The chosen tab is remembered.
  await page.getByRole("tab", { name: night }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: night })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: night }).getByText(fr.gacha.ownedCount(1, 12))).toBeVisible();
});
