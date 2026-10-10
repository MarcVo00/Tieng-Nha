import { useEffect, useState } from "react";
import { useAppState } from "@/app/appState";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui";

const SHOW_AFTER_MS = 30_000;

/** Quiet by design: only appears when events have been waiting for more than 30 s. */
export function SyncIndicator() {
  const pending = useAppState((s) => s.pendingSync);
  const [visible, setVisible] = useState(false);
  const waiting = pending > 0;

  useEffect(() => {
    if (!waiting) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!waiting || !visible) return null;
  return (
    <span role="status" aria-label={fr.app.sync.pending(pending)} className="inline-flex items-center gap-1 text-caption text-ink-muted">
      <Icon name="refresh" size={16} />
      <span className="tabular" aria-hidden="true">
        {pending}
      </span>
    </span>
  );
}
