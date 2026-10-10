import { useEffect, useState, type FormEvent } from "react";
import { OfflineError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui";
import { TextField } from "@/features/onboarding/TextField";

const RESEND_DELAY_S = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteStepProps = {
  inviteCode: string;
  inviteError: string | null;
  /** Set when the user already signed in (e.g. sent back from the profile step): no new code is needed. */
  session: Session | null;
  onInviteChange(code: string): void;
  onAuthenticated(session: Session): Promise<void>;
};

export function InviteStep({ inviteCode, inviteError, session, onInviteChange, onAuthenticated }: InviteStepProps) {
  const { auth } = useServices();
  const t = fr.onboarding.invite;
  const [email, setEmail] = useState(session?.email ?? "");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [localInviteError, setLocalInviteError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function messageFor(e: unknown): string {
    return e instanceof OfflineError ? t.offline : t.generic;
  }

  async function submitEmail(ev: FormEvent) {
    ev.preventDefault();
    setLocalInviteError(null);
    setEmailError(null);
    if (!inviteCode.trim()) {
      setLocalInviteError(t.inviteEmpty);
      return;
    }
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(t.emailInvalid);
      return;
    }
    setBusy(true);
    try {
      if (session) {
        await onAuthenticated(session);
        return;
      }
      await auth.requestOtp(trimmed);
      setPhase("code");
      setWait(RESEND_DELAY_S);
    } catch (e) {
      setEmailError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(ev: FormEvent) {
    ev.preventDefault();
    setCodeError(null);
    setBusy(true);
    let verified: Session;
    try {
      verified = await auth.verifyOtp(email.trim(), code);
    } catch (e) {
      setCodeError(e instanceof Error && e.message === "invalid_otp" ? t.invalidOtp : messageFor(e));
      setBusy(false);
      return;
    }
    // The code is spent: from here on the parent handles every failure and moves on.
    await onAuthenticated(verified);
    setBusy(false);
  }

  async function resend() {
    if (resending || wait > 0) return;
    setResending(true);
    setCodeError(null);
    setResent(false);
    try {
      await auth.requestOtp(email.trim());
      setResent(true);
      setWait(RESEND_DELAY_S);
    } catch (e) {
      setCodeError(messageFor(e));
    } finally {
      setResending(false);
    }
  }

  if (phase === "code") {
    return (
      <form onSubmit={(ev) => void submitCode(ev)} className="flex flex-col gap-5">
        <h1 className="text-title text-ink">{t.codeTitle}</h1>
        <p className="text-body text-ink-muted">{t.codeLead(email.trim())}</p>
        <TextField
          label={t.codeLabel}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={codeError}
          inputClassName="text-center text-title tracking-[0.4em] tabular-nums"
        />
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length !== 6}>
          {t.verify}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" disabled={wait > 0 || resending} onClick={() => void resend()}>
            {wait > 0 ? t.resendIn(wait) : t.resend}
          </Button>
          <Button variant="ghost" onClick={() => setPhase("email")}>
            {t.changeEmail}
          </Button>
        </div>
        <p role="status" className="min-h-[1.125rem] text-caption text-ink-muted">
          {resent ? t.resent : ""}
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={(ev) => void submitEmail(ev)} noValidate className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      <TextField
        label={t.inviteLabel}
        value={inviteCode}
        onChange={(e) => onInviteChange(e.target.value.toUpperCase())}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        error={localInviteError ?? inviteError}
        inputClassName="uppercase tracking-wider"
      />
      <TextField
        label={t.emailLabel}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        inputMode="email"
        error={emailError}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {t.send}
      </Button>
    </form>
  );
}
