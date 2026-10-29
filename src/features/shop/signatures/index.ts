import type { ComponentType } from "react";
import { DragonSword } from "@/features/shop/signatures/DragonSword";
import { NineTailFox } from "@/features/shop/signatures/NineTailFox";
import { TalismanGuardian } from "@/features/shop/signatures/TalismanGuardian";
import type { SignatureProps } from "@/features/shop/signatures/types";
import { fr } from "@/i18n/fr";

// Signature reveals of the legendaries (spec sound-and-reveal §6): a scene of its own, keyed by item id, played in the
// focus view before the piece appears. Adding one only adds an entry here; the rest of the reveal never changes.

export type { SignatureProps };

/** Registered signatures by item id. A legendary without an entry gets the generic gold treatment. */
export const SIGNATURES: Readonly<Record<string, ComponentType<SignatureProps>>> = {
  char_phap_su: TalismanGuardian,
  acc_kiem_rong: DragonSword,
  char_ho_ly: NineTailFox,
};

export function hasSignature(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNATURES, itemId);
}

/** The status line read while `itemId`'s signature plays: its own, or the neutral one. */
export function signatureLine(itemId: string): string {
  const lines = fr.gacha.scene.signatures;
  return (Object.prototype.hasOwnProperty.call(lines, itemId) ? lines[itemId] : undefined) ?? fr.gacha.scene.signature;
}
