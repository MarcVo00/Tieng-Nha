import { useState } from "react";
import { chromeIntentUrl, detectPlatform, installBlocker } from "@/domain/platform";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui";

const DISMISSED_KEY = "tn.installNotice.dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Shown in browsers where installing gives a package Google Play Protect blocks: the browser built into a messaging
 * app (Instagram, Messenger…) or Samsung Internet. The user is sent to Chrome (Android) or told how to reach Safari
 * (iOS). With `dismissible`, a "Plus tard" button hides it for good on this device.
 */
export function InAppBrowserNotice({ className = "", dismissible = false }: { className?: string; dismissible?: boolean }) {
  const [dismissed, setDismissed] = useState(() => dismissible && readDismissed());
  const blocker = installBlocker(navigator.userAgent);
  if (!blocker || dismissed || isStandalone()) return null;
  const t = fr.onboarding.inApp;
  const android = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === "android";
  const body = blocker === "samsung" ? t.samsung : android ? t.android : t.ios;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode: the notice simply comes back next time.
    }
    setDismissed(true);
  }

  return (
    <div role="note" className={`flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card ${className}`}>
      <p className="text-body-strong text-ink">{android ? t.title : t.titleIos}</p>
      <p className="text-body text-ink-muted">{body}</p>
      {android ? (
        <Button variant="secondary" fullWidth onClick={() => window.location.assign(chromeIntentUrl(window.location.href))}>
          {t.open}
        </Button>
      ) : null}
      {dismissible ? (
        <Button variant="ghost" fullWidth onClick={dismiss}>
          {t.later}
        </Button>
      ) : null}
    </div>
  );
}
