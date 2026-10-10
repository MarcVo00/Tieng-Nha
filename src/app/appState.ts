import { create } from "zustand";
import { useCallback, useState } from "react";
import type { Capabilities, ProgressSnapshot, Session, Settings } from "@/domain/types";
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

/** Device test wiring shared by onboarding and the profile screen. Detection and persistence are best-effort. */
export function useDeviceTest() {
  const { tts, stt, detectCapabilities } = useServices();
  const { settings, updateSettings } = useSettings();
  const [result, setResult] = useState<Capabilities | null>(settings.capabilities);
  const [busy, setBusy] = useState<"voice" | "mic" | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const caps = await detectCapabilities();
      setResult(caps);
      await updateSettings({ capabilities: caps });
    } catch {
      // Keep whatever result is already shown.
    }
  }, [detectCapabilities, updateSettings]);

  // Called straight from the click handler: iOS only starts speech synthesis inside a user gesture.
  const testVoice = useCallback(async (): Promise<void> => {
    setBusy("voice");
    try {
      await tts.speak("Xin chào!", { rate: 1 });
    } catch {
      // A failed test voice is reported by the detection below.
    }
    await refresh();
    setBusy(null);
  }, [tts, refresh]);

  const testMic = useCallback(async (): Promise<void> => {
    setBusy("mic");
    try {
      await stt.listen({ lang: "vi-VN", timeoutMs: 6000 });
    } catch {
      // Denied, silent or unsupported: the detection below shows what works.
    }
    await refresh();
    setBusy(null);
  }, [stt, refresh]);

  return { result, busy: busy !== null, listening: busy === "mic", testVoice, testMic, refresh };
}
