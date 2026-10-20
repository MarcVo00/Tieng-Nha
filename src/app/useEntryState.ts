import { useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Router state as it was when the screen mounted. FocusLayout keeps a leaving screen mounted during its exit
 * animation, and `useLocation()` there already returns the *next* location: a screen that validates its state and
 * redirects on failure must read this frozen copy, or it bounces the app back while leaving.
 *
 * Only for "validate on entry" screens, which FocusLayout re-mounts per path (`key={pathname}`): a navigation to the
 * same path with new state keeps the component mounted and does NOT update the value. Screens that must follow the
 * state over time keep reading `useLocation()`.
 */
export function useEntryState(): unknown {
  const { state } = useLocation() as { state: unknown };
  const [entry] = useState<unknown>(state);
  return entry;
}
