import { useMemo } from "react";
import type { Look } from "@/domain/types";
import { lookOf } from "@/services/look";
import { useAppState } from "@/app/appState";

/** What the player's hero wears now (the starter hero when nothing is equipped or the wallet is not loaded). */
export function useHeroLook(): Look {
  const equipped = useAppState((s) => s.wallet?.equipped);
  return useMemo(() => lookOf(equipped ?? {}), [equipped]);
}
