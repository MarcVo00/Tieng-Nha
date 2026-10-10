import { useId, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { InvalidProfileError, OfflineError, PseudoTakenError } from "@/domain/errors";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Avatar, Button, Sheet, tap, useToast } from "@/ui";

const AVATARS = ["🐉", "🐯", "🐼", "🦊", "🐸", "🐙", "🦄", "🐢", "🐧", "🦋", "🌸", "🍜", "🥭", "🛵", "🏮", "⭐"] as const;
const PROFILE_KEY = "vl-profile";

type Props = { open: boolean; onClose(): void; current: { pseudo: string; avatarEmoji: string } };

function Form({ onClose, current }: Omit<Props, "open">) {
  const { auth } = useServices();
  const toast = useToast();
  const t = fr.profile.edit;
  const fieldId = useId();
  const [pseudo, setPseudo] = useState(current.pseudo);
  const [emoji, setEmoji] = useState(current.avatarEmoji);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const clean = pseudo.trim();
    if (clean.length < 2 || clean.length > 20) {
      setError(t.pseudoInvalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.updateProfile({ pseudo: clean, avatarEmoji: emoji });
      const next = { pseudo: clean, avatarEmoji: emoji };
      useAppState.getState().set({ profile: next });
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {
        // The offline cache is best-effort.
      }
      toast.show({ title: t.saved });
      onClose();
    } catch (e) {
      setError(e instanceof PseudoTakenError ? t.pseudoTaken : e instanceof InvalidProfileError ? t.pseudoInvalid : e instanceof OfflineError ? t.offline : t.generic);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate className="flex flex-col gap-4">
      <h2 className="text-heading text-ink">{t.title}</h2>
      <div className="flex items-start gap-4">
        <Avatar emoji={emoji} size="lg" ring="primary" />
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="block text-caption text-ink-muted">
            {t.pseudoLabel}
          </label>
          <input
            id={fieldId}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={20}
            autoComplete="nickname"
            aria-invalid={error !== null}
            className="mt-1 min-h-11 w-full rounded-sm border-2 border-line bg-bg px-3 text-body text-ink"
          />
          <span className="mt-1 block text-caption text-ink-muted">{t.pseudoHint}</span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
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
            className={`flex min-h-12 items-center justify-center rounded-sm text-heading ${a === emoji ? "bg-surface ring-2 ring-primary" : "bg-surface-2"}`}
          >
            <span aria-hidden="true">{a}</span>
          </motion.button>
        ))}
      </div>
      <Button type="submit" fullWidth loading={busy}>
        {t.save}
      </Button>
    </form>
  );
}

export function EditProfileSheet({ open, onClose, current }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={fr.profile.edit.title}>
      {open ? <Form onClose={onClose} current={current} /> : null}
    </Sheet>
  );
}
