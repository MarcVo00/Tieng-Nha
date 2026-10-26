export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

type Env = {
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  nav: Pick<Navigator, "onLine">;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: never) => void;
};

/**
 * Browsers only look for a new service worker on navigation. An installed PWA resumed from the background never
 * navigates, so it would keep an old version forever: ask for an update each time the app comes back to the
 * foreground, and periodically while it stays open. A found update surfaces through the existing prompt.
 */
export function watchForUpdates(registration: Pick<ServiceWorkerRegistration, "update">, env: Env = defaultEnv()): () => void {
  const check = () => {
    if (!env.nav.onLine) return;
    registration.update().catch(() => undefined); // A failed check is retried on the next trigger.
  };
  const onVisible = () => {
    if (env.doc.visibilityState === "visible") check();
  };
  env.doc.addEventListener("visibilitychange", onVisible);
  const timer = env.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  return () => {
    env.doc.removeEventListener("visibilitychange", onVisible);
    env.clearInterval(timer as never);
  };
}

function defaultEnv(): Env {
  return {
    doc: document,
    nav: navigator,
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
  };
}

/** An update found this soon after the app opened (or came back to the foreground) is applied at once. */
export const LAUNCH_WINDOW_MS = 15 * 1000;

type ApplyContext = { sinceOpenedMs: number; hidden: boolean; inFocusFlow: boolean };

/**
 * A waiting update is taken without asking when it cannot cost anything: right after the app opens (nothing started
 * yet) or while it is in the background. Never during a lesson, exam, dialogue or review; then the prompt stays.
 */
export function shouldApplyUpdate({ sinceOpenedMs, hidden, inFocusFlow }: ApplyContext): boolean {
  if (inFocusFlow) return false;
  return hidden || sinceOpenedMs <= LAUNCH_WINDOW_MS;
}
