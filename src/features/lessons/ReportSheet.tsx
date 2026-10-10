import { useId, useState } from "react";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, Sheet, useToast } from "@/ui";

export const REPORT_MAX = 500;

type ReportSheetProps = { refId: string | null; contentVersion?: number; onClose: () => void };

function Form({ refId, contentVersion, onClose }: { refId: string; contentVersion?: number; onClose: () => void }) {
  const { reporter } = useServices();
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
      await reporter.report({ refId, message: trimmed, ...(contentVersion !== undefined ? { contentVersion } : {}) });
      toast.show({ title: fr.lessons.report.sent });
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
      <h2 className="text-heading text-ink">{fr.lessons.report.title}</h2>
      <p className="text-body text-ink-muted">{fr.lessons.report.hint}</p>
      <label htmlFor={fieldId} className="text-caption text-ink-muted">
        {fr.lessons.report.field}
      </label>
      <textarea
        id={fieldId}
        value={message}
        maxLength={REPORT_MAX}
        rows={4}
        placeholder={fr.lessons.report.placeholder}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full resize-none rounded-sm border-2 border-line bg-bg p-3 text-body text-ink"
      />
      <div className="flex items-center justify-between text-caption text-ink-muted">
        <span role={failed ? "alert" : undefined} className={failed ? "text-error" : ""}>
          {failed ? fr.lessons.report.error : ""}
        </span>
        <span className="tabular">{fr.lessons.report.count(message.length, REPORT_MAX)}</span>
      </div>
      <Button type="submit" fullWidth loading={sending} disabled={trimmed === ""}>
        {fr.lessons.report.send}
      </Button>
    </form>
  );
}

export function ReportSheet({ refId, contentVersion, onClose }: ReportSheetProps) {
  return (
    <Sheet open={refId !== null} onClose={onClose} label={fr.lessons.report.title}>
      {refId !== null ? <Form refId={refId} {...(contentVersion !== undefined ? { contentVersion } : {})} onClose={onClose} /> : null}
    </Sheet>
  );
}
