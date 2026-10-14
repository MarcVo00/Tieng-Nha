import { useState, type FormEvent } from "react";
import { OfflineError, SamePasswordError, WeakPasswordError } from "@/domain/errors";
import { passwordProblem } from "@/domain/password";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, PasswordField, Sheet, useToast } from "@/ui";

type Props = { open: boolean; onClose(): void };

function Form({ onClose }: Omit<Props, "open">) {
  const { auth } = useServices();
  const toast = useToast();
  const t = fr.profile.settings.password;
  const p = fr.password;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
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
      setPasswordError(e instanceof WeakPasswordError ? p.tooShort : e instanceof SamePasswordError ? p.same : e instanceof OfflineError ? fr.profile.edit.offline : fr.profile.edit.generic);
      setBusy(false);
      return;
    }
    toast.show({ title: t.updated });
    onClose();
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate className="flex flex-col gap-4">
      <h2 className="text-heading text-ink">{t.title}</h2>
      <PasswordField label={p.newLabel} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint={p.hint} error={passwordError} />
      <PasswordField label={p.confirmLabel} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" error={confirmError} />
      <Button type="submit" fullWidth loading={busy}>
        {p.submit}
      </Button>
    </form>
  );
}

export function ChangePasswordSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={fr.profile.settings.password.title}>
      {open ? <Form onClose={onClose} /> : null}
    </Sheet>
  );
}
