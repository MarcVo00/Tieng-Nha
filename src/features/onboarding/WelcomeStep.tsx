import { fr } from "@/i18n/fr";
import { Button, Motif } from "@/ui";

type WelcomeStepProps = { message: string; onStart(): void; onSignIn(): void };

// Hero: the Vietnamese greeting. One action: start; signing in is the quiet link under it.
export function WelcomeStep({ message, onStart, onSignIn }: WelcomeStepProps) {
  const t = fr.onboarding.welcome;
  return (
    <section className="relative flex min-h-[70dvh] flex-col justify-center gap-6">
      <div className="pointer-events-none absolute inset-y-0 -inset-x-5 text-ink" aria-hidden="true">
        <Motif kind="clouds" />
      </div>
      <h1 lang="vi" className="relative text-display text-primary">
        {t.title}
      </h1>
      <p className="relative text-body text-ink-muted">{t.lead}</p>
      {message ? (
        <p className="relative rounded-md border-2 border-gold bg-surface p-4 text-body text-ink shadow-card">{message}</p>
      ) : null}
      <Button size="lg" fullWidth className="relative" onClick={onStart}>
        {t.start}
      </Button>
      <Button variant="ghost" fullWidth className="relative" onClick={onSignIn}>
        {t.signIn}
      </Button>
    </section>
  );
}
