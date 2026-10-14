import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";

type NoEnergyProps = { wait: { hours: number; minutes: number } | null; onReview: () => void; onBack: () => void };

/** Shown where a lesson, dialogue or boss would start when energy is too low. One primary action: review. */
export function NoEnergy({ wait, onReview, onBack }: NoEnergyProps) {
  return (
    <EmptyState
      illustration="lantern"
      title={fr.energy.empty.title}
      body={wait ? fr.energy.empty.body(wait.hours, wait.minutes) : fr.energy.empty.bodyNoWait}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onReview}>{fr.energy.review}</Button>
          <Button variant="secondary" onClick={onBack}>
            {fr.energy.empty.back}
          </Button>
        </div>
      }
    />
  );
}
