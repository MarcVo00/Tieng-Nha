import { useEffect, useRef, useState } from "react";
import { useRefreshProgress } from "@/app/appState";
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
      timer = setInterval(() => {
        setTick((t) => t + 1);
        if (Date.parse(targetIso) - Date.parse(clock()) <= 0) stop(); // due: no endless 1 Hz timer
      }, 1000);
    };
    if (Date.parse(targetIso) - Date.parse(clock()) <= 0) return;
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [targetIso, clock]);

  return targetIso === null ? null : Date.parse(targetIso) - Date.parse(clock());
}

/**
 * A countdown for a screen that is blocked until `targetIso`: when it reaches 0 the shared progress is refreshed once
 * (so the header gauge fills) and `resume` runs once, to retry whatever was refused for lack of energy.
 */
export function useResumeAtZero(targetIso: string | null, resume: () => void): number | null {
  const remaining = useCountdown(targetIso);
  const refreshProgress = useRefreshProgress();
  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const firedFor = useRef<string | null>(null);
  const due = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (!due || targetIso === null || firedFor.current === targetIso) return;
    firedFor.current = targetIso;
    void refreshProgress()
      .catch(() => undefined)
      .then(() => resumeRef.current());
  }, [due, targetIso, refreshProgress]);

  return remaining;
}
