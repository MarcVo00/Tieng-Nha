import { useEffect, useRef } from "react";
import { useMatch } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { shouldApplyUpdate, watchForUpdates } from "@/app/swUpdates";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui";

/**
 * Takes a new version on its own when that costs nothing: right after the app opens or comes back to the foreground,
 * or while it is in the background. Otherwise (app in use) the prompt lets the user choose; hidden during focus flows,
 * which are never reloaded.
 */
export function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) watchForUpdates(registration); // Lives as long as the page: never disposed.
    },
  });
  const inLesson = useMatch("/lesson/*");
  const inExam = useMatch("/exam/run");
  const inDialogue = useMatch("/dialogue/*");
  const inReview = useMatch("/review/run");
  const inFocusFlow = Boolean(inLesson || inExam || inDialogue || inReview);
  const waiting = needRefresh[0];

  const openedAt = useRef(Date.now());
  const applied = useRef(false);
  const latest = useRef({ waiting, inFocusFlow, updateServiceWorker });
  latest.current = { waiting, inFocusFlow, updateServiceWorker };

  useEffect(() => {
    const tryApply = () => {
      const { waiting: w, inFocusFlow: focus, updateServiceWorker: update } = latest.current;
      if (!w || applied.current) return;
      const hidden = document.visibilityState === "hidden";
      if (!shouldApplyUpdate({ sinceOpenedMs: Date.now() - openedAt.current, hidden, inFocusFlow: focus })) return;
      applied.current = true;
      void update(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") openedAt.current = Date.now();
      tryApply();
    };
    tryApply();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [waiting, inFocusFlow]);

  if (!waiting || inFocusFlow) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 mx-auto max-w-md px-5">
      <div className="flex items-center justify-between gap-3 rounded-md bg-surface p-3 pl-4 shadow-raised">
        <span className="text-body-strong text-ink">{fr.app.update.available}</span>
        <Button variant="secondary" onClick={() => void updateServiceWorker(true)}>
          {fr.app.update.action}
        </Button>
      </div>
    </div>
  );
}
