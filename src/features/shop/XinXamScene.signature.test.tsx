import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GachaPull, GachaPullItem } from "@/domain/types";
import { XinXamScene } from "@/features/shop/XinXamScene";
import { fr } from "@/i18n/fr";

// Own file: the registry ships empty (Task 5 fills it), so a stub signature is registered for the guardian here. It
// shows itself, then ends after a short beat, like a real signature.
vi.mock("@/features/shop/signatures", async () => {
  const { createElement, useEffect } = await import("react");
  function Stub({ onEnd }: { onEnd: () => void; reduced: boolean }) {
    useEffect(() => {
      const t = window.setTimeout(onEnd, 300);
      return () => window.clearTimeout(t);
    }, [onEnd]);
    return createElement("span", { "data-signature-stub": "" });
  }
  const SIGNATURES = { char_phap_su: Stub };
  return { SIGNATURES, hasSignature: (id: string) => id in SIGNATURES };
});

const SLOW = { timeout: 5000 };
const item = (itemId: string, rarity: GachaPullItem["rarity"]): GachaPullItem => ({ itemId, rarity, duplicate: false, refund: 0 });
const pull: GachaPull = {
  id: "sig",
  theme: "legendes_sombres",
  count: 2,
  cost: 360,
  items: [item("acc_giao_tre", "common"), item("char_phap_su", "legendary")],
  createdAt: "2026-10-24T10:00:00.000Z",
  claimed: true,
};
const GUARDIAN = fr.shop.items.char_phap_su?.name ?? "char_phap_su";

test("a signature plays in the focus view, then the piece appears there: no flash of the grid, no generic gold after it", async () => {
  render(<XinXamScene pull={pull} items={[]} baseLook={{}} onClose={() => undefined} />);
  const dialog = screen.getByRole("dialog", { name: fr.gacha.resultLabel(360) });
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.shake }));
  await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "cards"), SLOW);

  // From the touch on the card to the scroll, record every time the grid is in the DOM.
  const seen: string[] = [];
  const watch = new MutationObserver(() => {
    if (dialog.querySelector("[data-cards]")) seen.push(dialog.getAttribute("data-phase") ?? "");
  });
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.scene.card(2) }));
  watch.observe(dialog, { subtree: true, childList: true, attributes: true });

  expect(dialog).toHaveAttribute("data-phase", "signature");
  expect(dialog.querySelector("[data-focus] [data-signature-stub]")).not.toBeNull();
  expect(dialog.querySelector("[data-cards]")).toBeNull(); // the card face would tell the piece before its signature
  expect(within(dialog).queryByRole("heading", { name: GUARDIAN })).toBeNull();

  expect(await within(dialog).findByRole("heading", { name: GUARDIAN }, SLOW)).toBeInTheDocument();
  watch.disconnect();
  expect(dialog).toHaveAttribute("data-phase", "focus");
  expect(seen).toEqual([]);
  expect(dialog.querySelector("[data-signature-stub]")).toBeNull(); // unmounted with its phase
  expect(dialog.querySelector("[data-focus] [data-fx='rays']")).toBeNull(); // the signature replaced the generic gold
  expect(within(dialog).getByRole("status").textContent).toBe(fr.gacha.scene.announce(GUARDIAN, fr.shop.rarities.legendary, fr.gacha.resultNew));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: fr.gacha.resultContinue })).toHaveFocus());

  // Back on the grid, touching it again opens it without a second signature.
  await user.click(within(dialog).getByRole("button", { name: fr.gacha.resultContinue }));
  await user.click(await within(dialog).findByRole("button", { name: fr.gacha.scene.cardOpen(2, GUARDIAN, fr.shop.rarities.legendary) }));
  expect(dialog).toHaveAttribute("data-phase", "focus");
  expect(dialog.querySelector("[data-signature-stub]")).toBeNull();
});
