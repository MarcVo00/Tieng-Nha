import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("after the ten lessons, Thủy Tinh can be challenged: HP bar and five lives", async ({ page }) => {
  await onboard(page);
  // Mark the ten lessons as done straight in the local event log (blind answers cannot pass a lesson reliably).
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("tieng-nha");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("events", "readwrite");
    for (let i = 1; i <= 10; i++) {
      const id = `l${String(i).padStart(2, "0")}`;
      tx.objectStore("events").put({ clientId: crypto.randomUUID(), schemaVersion: 1, type: "lesson_completed", refId: id, xp: 10, payload: { mistakes: 1, durationMs: 1000, perfect: false }, createdAt: new Date(Date.now() - (11 - i) * 60000).toISOString() });
    }
    await new Promise((res) => { tx.oncomplete = res; });
  });
  await page.goto("/exam");
  await expect(page.getByRole("heading", { name: "Thủy Tinh" })).toBeVisible();
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeVisible();
  await expect(page.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeVisible();
});
