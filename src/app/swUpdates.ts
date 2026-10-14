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
