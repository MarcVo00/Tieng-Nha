import { useState, type FormEvent } from "react";
import { InvalidCredentialsError, OfflineError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, PasswordField } from "@/ui";
import { TextField } from "@/features/onboarding/TextField";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignInStepProps = {
  initialEmail: string;
  onAuthenticated(session: Session): Promise<void>;
  onForgot(email: string): void;
  onBack(): void;
};

// Hero: the two fields. One action: sign in. Forgot password and back are quiet links.
export function SignInStep({ initialEmail, onAuthenticated, onForgot, onBack }: SignInStepProps) {
  const { auth } = useServices();
  const t = fr.onboarding.signIn;
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(fr.onboarding.invite.emailInvalid);
      return;
    }
    if (!password) {
      setPasswordError(t.passwordEmpty);
      return;
    }
    setBusy(true);
    let session: Session;
    try {
      session = await auth.signInWithPassword(trimmed, password);
    } catch (e) {
      setPasswordError(e instanceof InvalidCredentialsError ? t.invalid : e instanceof OfflineError ? fr.onboarding.invite.offline : fr.onboarding.invite.generic);
      setBusy(false);
      return;
    }
    // Signed in: the parent handles every failure from here on and moves forward.
    await onAuthenticated(session);
    setBusy(false);
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      <TextField
        label={t.emailLabel}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        inputMode="email"
        error={emailError}
      />
      <PasswordField label={t.passwordLabel} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={passwordError} />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {t.submit}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => onForgot(email.trim())}>
          {t.forgot}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          {t.back}
        </Button>
      </div>
    </form>
  );
}
