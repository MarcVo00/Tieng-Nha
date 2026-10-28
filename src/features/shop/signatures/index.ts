import type { ComponentType } from "react";
import { DragonSword } from "@/features/shop/signatures/DragonSword";
import { NineTailFox } from "@/features/shop/signatures/NineTailFox";
import { TalismanGuardian } from "@/features/shop/signatures/TalismanGuardian";
import type { SignatureProps } from "@/features/shop/signatures/types";

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
