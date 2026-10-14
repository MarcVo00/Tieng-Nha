import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";

type NoEnergyProps = {
  wait: { hours: number; minutes: number } | null;
  /** False when no word is due: reviewing would lead nowhere, so only the wait is offered. */
  canReview: boolean;
  onReview: () => void;
  onBack: () => void;
};

/** Shown where a lesson, dialogue or boss would start when energy is too low. Primary action: review, or back when there is nothing to review. */
export function NoEnergy({ wait, canReview, onReview, onBack }: NoEnergyProps) {
  return (
    <EmptyState
      illustration="lantern"
      title={fr.energy.empty.title}
      body={
        canReview
          ? wait
            ? fr.energy.empty.body(wait.hours, wait.minutes)
            : fr.energy.empty.bodyNoWait
          : wait
            ? fr.energy.empty.waitOnly(wait.hours, wait.minutes)
            : fr.energy.empty.later
      }
      action={
        <div className="flex flex-wrap items-center gap-3">
          {canReview ? <Button onClick={onReview}>{fr.energy.review}</Button> : null}
          <Button variant={canReview ? "secondary" : "primary"} onClick={onBack}>
            {fr.energy.empty.back}
          </Button>
        </div>
      }
    />
  );
}
