import { useState, type FormEvent } from "react";
import { OfflineError, SamePasswordError, WeakPasswordError } from "@/domain/errors";
import { passwordProblem } from "@/domain/password";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, PasswordField } from "@/ui";

export type PasswordMode = "create" | "upgrade" | "reset";

type SetPasswordStepProps = {
  mode: PasswordMode;
  onDone(): Promise<void>;
  /** Only used by the "upgrade" mode, which can be postponed. */
  onSkip?: () => void;
};

// Hero: the new password. One action: save. Upgrade adds a quiet "Plus tard".
export function SetPasswordStep({ mode, onDone, onSkip }: SetPasswordStepProps) {
  const { auth } = useServices();
  const t = fr.onboarding.password[mode];
  const p = fr.password;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setPasswordError(null);
    setConfirmError(null);
    const problem = passwordProblem(password, confirmation);
    if (problem === "too_short") {
      setPasswordError(p.tooShort);
      return;
    }
    if (problem === "mismatch") {
      setConfirmError(p.mismatch);
      return;
    }
    setBusy(true);
    try {
      await auth.setPassword(password);
    } catch (e) {
      setPasswordError(e instanceof WeakPasswordError ? p.tooShort : e instanceof SamePasswordError ? p.same : e instanceof OfflineError ? fr.onboarding.invite.offline : fr.onboarding.invite.generic);
      setBusy(false);
      return;
    }
    await onDone();
    setBusy(false);
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      <PasswordField label={p.label} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint={p.hint} error={passwordError} />
      <PasswordField label={p.confirmLabel} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" error={confirmError} />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {p.submit}
      </Button>
      {mode === "upgrade" && onSkip ? (
        <Button variant="ghost" onClick={onSkip}>
          {fr.onboarding.password.upgrade.later}
        </Button>
      ) : null}
    </form>
  );
}
