import { useSyncExternalStore } from "react";
import { fr } from "@/i18n/fr";
import { Button, Icon } from "@/ui";
import { detectPlatform, isInAppBrowser } from "@/domain/platform";
import { InAppBrowserNotice } from "@/features/onboarding/InAppBrowserNotice";
import { getInstallPrompt, promptInstall, subscribeInstallPrompt } from "@/features/onboarding/installPrompt";

export function isStandalone(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

function AddToHomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function IosSteps() {
  const t = fr.onboarding.install;
  const glyphs = [<Icon key="share" name="share" size={24} />, <AddToHomeGlyph key="add" />, <Icon key="ok" name="check" size={24} />];
  return (
    <ol className="flex flex-col gap-3">
      {t.iosSteps.map((label, i) => (
        <li key={label} className="flex items-center gap-4 rounded-md bg-surface p-4 shadow-card">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-primary">{glyphs[i]}</span>
          <span className="text-body text-ink">{label}</span>
        </li>
      ))}
    </ol>
  );
}

type InstallStepProps = { onFinish(): void };

export function InstallStep({ onFinish }: InstallStepProps) {
  const t = fr.onboarding.install;
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, () => getInstallPrompt() !== null);
  const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === "ios";
  const inApp = isInAppBrowser(navigator.userAgent);

  async function install() {
    try {
      await promptInstall();
    } catch {
      // The native dialog failing must not block the end of onboarding.
    } finally {
      onFinish();
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      {inApp ? <InAppBrowserNotice /> : null}
      {!inApp && ios ? <IosSteps /> : null}
      {!inApp && !ios && !canPrompt ? <p className="text-body text-ink-muted">{t.unavailable}</p> : null}
      {!inApp && !ios && canPrompt ? (
        <>
          <Button size="lg" fullWidth onClick={() => void install()}>
            {t.action}
          </Button>
          <Button variant="ghost" fullWidth onClick={onFinish}>
            {t.later}
          </Button>
        </>
      ) : (
        <Button size="lg" fullWidth onClick={onFinish}>
          {t.finish}
        </Button>
      )}
    </section>
  );
}
