import { useEffect, useRef, useState, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus management for a mounted dialog: moves focus in, traps Tab / Shift+Tab,
 * calls `onEscape` on Escape, and restores focus to the previously focused element on unmount.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement>, onEscape?: () => void): void {
  // Captured during the first render, before any child `autoFocus` runs in the commit phase.
  const [previous] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.activeElement));
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!container.contains(document.activeElement)) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escapeRef.current) {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Do not steal focus back when another modal took over meanwhile (e.g. a confirmation opened from a closing sheet).
      const active = document.activeElement;
      const otherModal = active instanceof HTMLElement && !container.contains(active) && active.closest('[aria-modal="true"]') !== null;
      if (!otherModal && previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [containerRef, previous]);
}
