import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "motion/react";
import { spring } from "@/ui";

export const PULL_MAX = 80; // px the content can be pulled down
const PULL_TRIGGER = 56; // px of pull needed to refresh
const RESISTANCE = 0.5;

/**
 * Pull-to-refresh that never fights scrolling: it only starts when the page is at the top
 * and the finger moves downward; any upward move or scroll cancels it. Listeners are passive.
 */
export function usePullToRefresh(onRefresh: () => void, enabled: boolean) {
  const y = useMotionValue(0);
  const latest = useRef(onRefresh);
  latest.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    const settle = () => {
      startY = null;
      void animate(y, 0, spring.soft);
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startY = t && window.scrollY <= 0 ? t.clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (startY === null || !t) return;
      const dy = t.clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        startY = null;
        y.set(0);
        return;
      }
      y.set(Math.min(PULL_MAX, dy * RESISTANCE));
    };
    const onEnd = () => {
      if (startY === null) return;
      const pulled = y.get();
      settle();
      if (pulled >= PULL_TRIGGER) latest.current();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", settle);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", settle);
    };
  }, [enabled, y]);

  return y;
}
