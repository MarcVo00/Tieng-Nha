import { useEffect, useState } from "react";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";

// Touch only grants audio on pointerup/touchend (pointerdown counts for a mouse); keydown and click cover the rest.
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
// After one of these the page has user activation, so the unlock has had its chance.
const ACTIVATING = new Set<string>(["pointerup", "touchend", "click", "keydown"]);

/**
 * Keeps the sound player in step with the « Sons » setting, and unlocks audio on the first gesture. iOS suspends the
 * context when the app goes to the background, so the listeners come back each time the page is visible again. While the
 * page is hidden the player is muted: what rings stops, and a cue a scene had scheduled (a signature's gong) stays silent.
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
    const onGesture = (e: Event) => {
      sound.unlock();
      if (ACTIVATING.has(e.type)) disarm();
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
      if (shown) arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disarm();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sound]);

  return null;
}
