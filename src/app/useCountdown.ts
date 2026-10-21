import { useEffect, useState } from "react";
import { useServices } from "@/app/ServicesProvider";

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Milliseconds left until `targetIso` (null when there is no target), re-rendered once a second.
 * The single interval runs only while a target exists and the page is visible; it resyncs when the page comes back.
 */
export function useCountdown(targetIso: string | null): number | null {
  const { clock } = useServices();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (targetIso === null) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const sync = () => {
      stop();
      if (!visible()) return;
      setTick((t) => t + 1); // resync right away on (re)start
      timer = setInterval(() => setTick((t) => t + 1), 1000);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [targetIso]);

  return targetIso === null ? null : Date.parse(targetIso) - Date.parse(clock());
}
