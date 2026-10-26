import type { ComponentType } from "react";

// Signature reveals of the legendaries (spec sound-and-reveal §6): a scene of its own, keyed by item id, played in the
// focus view before the piece appears. Adding one only adds an entry here; the rest of the reveal never changes.

export type SignatureProps = { onEnd: () => void; reduced: boolean };

/** Registered signatures by item id. A legendary without an entry gets the generic gold treatment. */
export const SIGNATURES: Readonly<Record<string, ComponentType<SignatureProps>>> = {};

export function hasSignature(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNATURES, itemId);
}
