import { fr } from "@/i18n/fr";
import { EmptyState } from "@/ui";

export function ExamResultScreen() {
  return <EmptyState title={fr.app.soon.title} body={fr.app.soon.body} illustration="lantern" />;
}
