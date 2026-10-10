import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { InvalidInviteError, InvalidProfileError, OfflineError, PseudoTakenError } from "@/domain/errors";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Avatar, Button, tap } from "@/ui";
import { TextField } from "@/features/onboarding/TextField";

const AVATARS = ["🐉", "🐯", "🐼", "🦊", "🐸", "🐙", "🦄", "🐢", "🐧", "🦋", "🌸", "🍜", "🥭", "🛵", "🏮", "⭐"] as const;

type ProfileStepProps = {
  inviteCode: string;
  onInvalidInvite(): void;
  onJoined(profile: { pseudo: string; avatarEmoji: string }): Promise<void>;
};

export function ProfileStep({ inviteCode, onInvalidInvite, onJoined }: ProfileStepProps) {
  const { auth } = useServices();
  const t = fr.onboarding.profile;
  const [pseudo, setPseudo] = useState("");
  const [emoji, setEmoji] = useState<string>(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const clean = pseudo.trim();
    if (clean.length < 2 || clean.length > 20) {
      setError(t.pseudoInvalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.joinGroup(inviteCode.trim(), clean, emoji);
      await onJoined({ pseudo: clean, avatarEmoji: emoji });
    } catch (e) {
      if (e instanceof InvalidInviteError) onInvalidInvite();
      else if (e instanceof PseudoTakenError) setError(t.pseudoTaken);
      else if (e instanceof InvalidProfileError) setError(t.pseudoInvalid);
      else if (e instanceof OfflineError) setError(fr.onboarding.invite.offline);
      else setError(fr.onboarding.invite.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      <div className="flex items-start gap-4">
        <Avatar emoji={emoji} size="lg" ring="primary" />
        <div className="min-w-0 flex-1">
          <TextField
            label={t.pseudoLabel}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={20}
            autoComplete="nickname"
            hint={t.pseudoHint}
            error={error}
          />
        </div>
      </div>
      <div role="radiogroup" aria-label={t.avatarLabel} className="grid grid-cols-4 gap-2">
        {AVATARS.map((a) => (
          <motion.button
            key={a}
            type="button"
            role="radio"
            aria-checked={a === emoji}
            aria-label={t.avatarOption(a)}
            whileTap={tap}
            onClick={() => setEmoji(a)}
            className={`flex min-h-12 items-center justify-center rounded-sm text-heading ${
              a === emoji ? "bg-surface ring-2 ring-primary" : "bg-surface-2"
            }`}
          >
            <span aria-hidden="true">{a}</span>
          </motion.button>
        ))}
      </div>
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {t.submit}
      </Button>
    </form>
  );
}
