import { useServices } from "@/app/ServicesProvider";
import { ReportSheet } from "@/ui";

export function ReportProblemSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { reporter } = useServices();
  return <ReportSheet open={open} onClose={onClose} onSubmit={(message) => reporter.report({ refId: "app", message })} />;
}
