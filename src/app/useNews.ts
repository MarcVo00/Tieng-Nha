import { useEffect, useState, useSyncExternalStore } from "react";
import { useServices } from "@/app/ServicesProvider";
import { NEWS_SEEN_KEY } from "@/domain/storageKeys";

const CHANGED = "tn-news-seen";

/** The newest version whose « Nouveautés » this device has shown; null when none, or when storage is unavailable. */
export function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(NEWS_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen(version: string): void {
  try {
    localStorage.setItem(NEWS_SEEN_KEY, version);
  } catch {
    // storage unavailable: the dot simply stays
    return;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Whether the newest changelog version is still unseen (the dot on « Moi » and on the profile row).
 * A changelog that fails to load never shows a dot.
 */
export function useUnseenNews(): boolean {
  const { content } = useServices();
  const [latest, setLatest] = useState<string | null>(null);
  const seen = useSyncExternalStore(subscribe, readSeenVersion, () => null);
  useEffect(() => {
    let cancelled = false;
    content
      .getChangelog()
      .then((entries) => !cancelled && setLatest(entries[0]?.version ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [content]);
  return latest !== null && seen !== latest;
}
