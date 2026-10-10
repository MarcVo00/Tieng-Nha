import { create } from "zustand";
import { useCallback } from "react";
import type { ProgressSnapshot, Session, Settings } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { useServices } from "@/app/ServicesProvider";

export type AppProfile = { pseudo: string; avatarEmoji: string };
type Fields = {
  ready: boolean; session: Session | null; profile: AppProfile | null; settings: Settings;
  snapshot: ProgressSnapshot | null; dueCount: number; pendingSync: number;
};
export const useAppState = create<Fields & { set(p: Partial<Fields>): void }>((set) => ({
  ready: false, session: null, profile: null, settings: { ...DEFAULT_SETTINGS }, snapshot: null, dueCount: 0, pendingSync: 0,
  set: (p) => set(p),
}));

export function voiceRateOf(s: Settings): number {
  return s.voiceRate === "slow" ? 0.6 : 1;
}

export function useSettings() {
  const { progress } = useServices();
  const settings = useAppState((s) => s.settings);
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...useAppState.getState().settings, ...patch };
    useAppState.getState().set({ settings: next });
    await progress.saveSettings(next);
  }, [progress]);
  return { settings, updateSettings };
}

export function useRefreshProgress() {
  const { activity, progress, clock } = useServices();
  return useCallback(async () => {
    const [snapshot, dueCount] = await Promise.all([activity.getSnapshot(), progress.countDueVocab(clock())]);
    useAppState.getState().set({ snapshot, dueCount });
  }, [activity, progress, clock]);
}
