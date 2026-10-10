import type { Capabilities } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/icons";

export type DeviceCheckProps = {
  result: Capabilities | null;
  platform: "ios" | "android" | "other";
  onTestVoice(): Promise<void>;
  onTestMic(): Promise<void>;
  busy: boolean;
};

type RowKey = "tts" | "stt" | "mic";

function Row({ label, ok, help }: { label: string; ok: boolean | null; help: string | null }) {
  const status = ok === null ? fr.onboarding.device.unknown : ok ? fr.onboarding.device.ok : fr.onboarding.device.ko;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          ok === null ? "bg-surface-2 text-ink-muted" : ok ? "bg-success-soft text-success" : "bg-error-soft text-error"
        }`}
      >
        {ok === null ? <span aria-hidden="true">–</span> : <Icon name={ok ? "check" : "cross"} size={18} />}
      </span>
      <div className="min-w-0">
        <p className="text-body-strong text-ink">
          {label} <span className="sr-only">{status}</span>
        </p>
        {ok === false && help ? <p className="text-caption text-ink-muted">{help}</p> : null}
      </div>
    </li>
  );
}

/** Presentational device test: two action buttons and one status row per capability. */
export function DeviceCheck({ result, platform, onTestVoice, onTestMic, busy }: DeviceCheckProps) {
  const d = fr.onboarding.device;
  const values: Record<RowKey, boolean | null> = {
    tts: result ? result.tts : null,
    stt: result ? result.stt : null,
    mic: result ? result.recorder : null,
  };
  const help: Record<RowKey, string> = { tts: d.helpTts[platform], stt: d.helpStt, mic: d.helpMic };
  const rows: RowKey[] = ["tts", "stt", "mic"];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => void onTestVoice()} className="flex-1">
          <Icon name="speaker" size={20} />
          {d.listen}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void onTestMic()} className="flex-1">
          <Icon name="mic" size={20} />
          {busy ? d.listening : d.speak}
        </Button>
      </div>
      <ul aria-label={d.resultsLabel} className="divide-y divide-line rounded-md bg-surface px-4 shadow-card">
        {rows.map((key) => (
          <Row key={key} label={d.rows[key]} ok={values[key]} help={help[key]} />
        ))}
      </ul>
    </div>
  );
}
