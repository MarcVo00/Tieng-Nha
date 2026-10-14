import { chromeIntentUrl, detectPlatform, isInAppBrowser } from "@/domain/platform";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui";

/**
 * Shown only inside the browser of a messaging or social app (Instagram, Messenger…). Installing from there gives a
 * package Google Play Protect blocks, so the user is sent to Chrome (Android) or told how to reach Safari (iOS).
 */
export function InAppBrowserNotice({ className = "" }: { className?: string }) {
  if (!isInAppBrowser(navigator.userAgent)) return null;
  const t = fr.onboarding.inApp;
  const android = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === "android";
  return (
    <div role="note" className={`flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card ${className}`}>
      <p className="text-body-strong text-ink">{t.title}</p>
      <p className="text-body text-ink-muted">{android ? t.android : t.ios}</p>
      {android ? (
        <Button variant="secondary" fullWidth onClick={() => window.location.assign(chromeIntentUrl(window.location.href))}>
          {t.open}
        </Button>
      ) : null}
    </div>
  );
}
