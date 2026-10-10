import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { duration, ease } from "@/ui/motion";
import { ReportButton } from "@/ui/ReportButton";
import { Sheet } from "@/ui/Sheet";
import { SpeakerButton } from "@/ui/SpeakerButton";

type FeedbackSheetProps = {
  open: boolean;
  correct: boolean;
  expected: string;
  heard?: string;
  onContinue: () => void;
  onSpeak?: () => void;
  onReport?: () => void;
  children?: ReactNode;
};

function ResultIcon({ correct }: { correct: boolean }) {
  return (
    <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-on ${correct ? "bg-success" : "bg-error"}`}>
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {correct ? (
          <motion.path d="M5 12.5 10 17.5 19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, ease: ease.out }} />
        ) : (
          <>
            <motion.path d="M7 7l10 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, ease: ease.out }} />
            <motion.path d="M17 7 7 17" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, delay: duration.instant, ease: ease.out }} />
          </>
        )}
      </svg>
    </span>
  );
}

function Body({ correct, expected, heard, onContinue, onSpeak, onReport, children }: Omit<FeedbackSheetProps, "open">) {
  // Enter continues, unless a control already handles the key natively.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest("button, a, input, textarea, select")) return;
      onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="flex items-center gap-3">
        <ResultIcon correct={correct} />
        <span className="text-heading text-ink">{correct ? fr.ui.feedback.correct : fr.ui.feedback.wrong}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-ink-muted">{fr.ui.feedback.expected}</p>
          <p lang="vi" className="text-heading text-ink">
            {expected}
          </p>
          {heard ? (
            <p className="mt-2 text-caption text-ink-muted">
              {fr.ui.feedback.heard}
              <span> : </span>
              <span lang="vi" className="text-body-strong text-ink">
                {heard}
              </span>
            </p>
          ) : null}
        </div>
        {onSpeak ? <SpeakerButton onSpeak={onSpeak} /> : null}
      </div>
      {children}
      <div className="flex items-center gap-2">
        {onReport ? <ReportButton onClick={onReport} /> : null}
      </div>
      <Button size="lg" fullWidth autoFocus onClick={onContinue}>
        {fr.ui.feedback.continue}
      </Button>
    </div>
  );
}

export function FeedbackSheet({ open, correct, ...rest }: FeedbackSheetProps) {
  return (
    <Sheet open={open} label={fr.ui.feedback.sheetLabel} tone={correct ? "success" : "error"}>
      <Body correct={correct} {...rest} />
    </Sheet>
  );
}
