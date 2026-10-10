import { useId, useState } from "react";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

export const REPORT_MAX = 500;

type ReportSheetProps = { open: boolean; onClose: () => void; onSubmit: (message: string) => Promise<void> };

function Form({ onClose, onSubmit }: Omit<ReportSheetProps, "open">) {
  const toast = useToast();
  const fieldId = useId();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = message.trim();

  const send = async () => {
    if (sending || trimmed === "") return;
    setSending(true);
    setFailed(false);
    try {
      await onSubmit(trimmed);
      toast.show({ title: fr.report.sent });
      onClose();
    } catch {
      setFailed(true);
      setSending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <h2 className="text-heading text-ink">{fr.report.title}</h2>
      <p className="text-body text-ink-muted">{fr.report.hint}</p>
      <label htmlFor={fieldId} className="text-caption text-ink-muted">
        {fr.report.field}
      </label>
      <textarea
        id={fieldId}
        value={message}
        maxLength={REPORT_MAX}
        rows={4}
        placeholder={fr.report.placeholder}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full resize-none rounded-sm border-2 border-line bg-bg p-3 text-body text-ink"
      />
      <div className="flex items-center justify-between text-caption text-ink-muted">
        <span role={failed ? "alert" : undefined} className={failed ? "text-error" : ""}>
          {failed ? fr.report.error : ""}
        </span>
        <span className="tabular">{fr.report.count(message.length, REPORT_MAX)}</span>
      </div>
      <Button type="submit" fullWidth loading={sending} disabled={trimmed === ""}>
        {fr.report.send}
      </Button>
    </form>
  );
}

export function ReportSheet({ open, onClose, onSubmit }: ReportSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label={fr.report.title}>
      {open ? <Form onClose={onClose} onSubmit={onSubmit} /> : null}
    </Sheet>
  );
}
