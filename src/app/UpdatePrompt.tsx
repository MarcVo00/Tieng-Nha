import { useMatch } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui";

/** Never reloads on its own: the user chooses when to take the new version. Hidden during focus flows. */
export function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const inLesson = useMatch("/lesson/*");
  const inExam = useMatch("/exam/run");
  const inDialogue = useMatch("/dialogue/*");
  const inReview = useMatch("/review/run");
  if (!needRefresh[0] || inLesson || inExam || inDialogue || inReview) return null;
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
