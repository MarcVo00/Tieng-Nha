import { useNavigate } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { Button, Icon } from "@/ui";

// Supabase may still open the magic link in another browser: the 6-digit e-mail code stays the main path.
export function AuthCallbackScreen() {
  const navigate = useNavigate();
  const t = fr.onboarding.callback;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 bg-bg px-5">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon name="check" size={28} />
      </span>
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.body}</p>
      <Button size="lg" fullWidth onClick={() => navigate("/welcome")}>
        {t.open}
      </Button>
    </main>
  );
}
