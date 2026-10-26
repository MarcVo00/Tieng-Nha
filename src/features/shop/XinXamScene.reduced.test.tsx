import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { createFakeServices, FakeSoundPlayer } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

// Own file: motion caches the reduced-motion preference on first use, so the media query must be set before any render.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

test("reduced motion: the result directly (the recap), no tube, no omen, no cards; only the best piece rings, once", () => {
  const pull = {
    id: "p1",
    theme: "legendes_sombres",
    count: 1,
    cost: 40,
    items: [{ itemId: "char_phap_su", rarity: "legendary" as const, duplicate: false, refund: 0 }],
    createdAt: "2026-10-24T10:00:00.000Z",
    claimed: true,
  };
  const services = createFakeServices();
  const sound = services.sound;
  if (!(sound instanceof FakeSoundPlayer)) throw new Error("expected the fake sound player");
  render(
    <ServicesProvider services={services}>
      <XinXamScene pull={{ ...pull, count: 2, cost: 40, items: [{ itemId: "acc_giao_tre", rarity: "common" as const, duplicate: false, refund: 0 }, ...pull.items] }} items={[]} baseLook={{}} onClose={() => undefined} />
    </ServicesProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: fr.gacha.resultLabel(40) });
  expect(dialog).toHaveAttribute("data-phase", "recap");
  expect(within(dialog).getByText(fr.shop.items.char_phap_su?.name ?? "")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: fr.gacha.scene.shake })).toBeNull();
  expect(dialog.querySelector("[data-stage]")).toBeNull();
  expect(dialog.querySelector("[data-card]")).toBeNull();
  expect(within(dialog).getByRole("button", { name: fr.gacha.resultContinue })).toBeInTheDocument();
  expect(sound.played.map((p) => p.cue)).toEqual(["gacha.flip.legendary"]);
});
