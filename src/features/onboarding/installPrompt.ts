// `beforeinstallprompt` fires once, early; capture it at module load so the install step can use it later.
export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function isInstallPromptEvent(e: Event): e is InstallPromptEvent {
  return "prompt" in e && typeof e.prompt === "function";
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    if (!isInstallPromptEvent(e)) return;
    e.preventDefault();
    deferred = e;
    for (const cb of listeners) cb();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    for (const cb of listeners) cb();
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Shows the native install dialog; resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === "accepted";
}
