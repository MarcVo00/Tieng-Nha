import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("coins from perfect lessons buy a frame, which can then be equipped", async ({ page }) => {
  await onboard(page);
  // 4 perfect lessons = 4 x 15 = 60 xu, seeded straight in the local event log.
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("tieng-nha");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("events", "readwrite");
    for (let i = 1; i <= 4; i++) {
      const id = `l${String(i).padStart(2, "0")}`;
      tx.objectStore("events").put({ clientId: crypto.randomUUID(), schemaVersion: 1, type: "lesson_completed", refId: id, xp: 15, payload: { mistakes: 0, durationMs: 1000, perfect: true }, createdAt: new Date(Date.now() - (5 - i) * 60000).toISOString() });
    }
    await new Promise((res) => { tx.oncomplete = res; });
  });
  await page.reload();

  await page.getByRole("link", { name: fr.app.tabs.me }).click();
  await page.getByRole("link", { name: new RegExp(fr.shop.open) }).click();
  await expect(page.getByText(fr.shop.balance(60))).toBeVisible();

  const bronzeName = fr.shop.items["frame_bronze"]?.name ?? "";
  const bronze = page.getByRole("listitem").filter({ hasText: bronzeName });
  await bronze.getByRole("button", { name: fr.shop.buy(40) }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: fr.shop.confirm.confirm }).click();
  await expect(page.getByText(fr.shop.balance(20))).toBeVisible();

  await bronze.getByRole("button", { name: fr.shop.equip }).click();
  await expect(bronze.getByRole("button", { name: fr.shop.equipped })).toBeVisible();
});
