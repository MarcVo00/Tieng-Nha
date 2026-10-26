import { useEffect, useState } from "react";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";

// Touch only grants audio on pointerup/touchend (pointerdown counts for a mouse); keydown and click cover the rest.
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;

/**
 * Keeps the sound player in step with the « Sons » setting, and unlocks audio on gestures. The listeners stay armed until the
 * context is really running (iOS may refuse a gesture), and come back whenever it leaves "running" (the app went to
 * the background, a call or Siri interrupted it). While the page is hidden the player is muted: what rings stops, and
 * a cue a scene had scheduled (a signature's gong) stays silent.
 */
export function SoundSync() {
  const { sound } = useServices();
  const enabled = useAppState((s) => s.settings.sound);
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    sound.setEnabled(enabled && visible);
  }, [sound, enabled, visible]);

  useEffect(() => {
    let armed = false;
    const onGesture = () => {
      sound.unlock();
    };
    const arm = () => {
      if (armed) return;
      armed = true;
      GESTURES.forEach((type) => window.addEventListener(type, onGesture, { capture: true, passive: true }));
    };
    const disarm = () => {
      armed = false;
      GESTURES.forEach((type) => window.removeEventListener(type, onGesture, { capture: true }));
    };
    const onVisibility = () => {
      const shown = document.visibilityState === "visible";
      setVisible(shown);
      if (shown) arm(); // iOS may have suspended audio behind our back
    };
    const stopWatching = sound.onStateChange((running) => (running ? disarm() : arm()));
    if (!sound.isRunning()) arm();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopWatching();
      disarm();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sound]);

  return null;
}
