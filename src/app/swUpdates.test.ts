import { describe, expect, it, vi } from "vitest";
import { UPDATE_CHECK_INTERVAL_MS, watchForUpdates } from "@/app/swUpdates";

function setup(onLine = true) {
  const listeners = new Map<string, () => void>();
  let tick: (() => void) | null = null;
  const env = {
    doc: {
      visibilityState: "hidden" as DocumentVisibilityState,
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    },
    nav: { onLine },
    setInterval: vi.fn((fn: () => void) => {
      tick = fn;
      return 1;
    }),
    clearInterval: vi.fn(),
  };
  const registration = { update: vi.fn(() => Promise.resolve()) };
  const stop = watchForUpdates(registration, env as never);
  return { env, registration, stop, listeners, tick: () => tick?.() };
}

describe("watchForUpdates", () => {
  it("checks for an update when the app comes back to the foreground", () => {
    const { env, registration, listeners } = setup();
    listeners.get("visibilitychange")?.();
    expect(registration.update).not.toHaveBeenCalled();
    env.doc.visibilityState = "visible";
    listeners.get("visibilitychange")?.();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("checks periodically while the app stays open", () => {
    const { env, registration, tick } = setup();
    expect(env.setInterval).toHaveBeenCalledWith(expect.any(Function), UPDATE_CHECK_INTERVAL_MS);
    tick();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("skips the check offline and swallows a failed check", async () => {
    const offline = setup(false);
    offline.tick();
    expect(offline.registration.update).not.toHaveBeenCalled();

    const online = setup();
    online.registration.update.mockRejectedValueOnce(new Error("network"));
    online.tick();
    await Promise.resolve();
    expect(online.registration.update).toHaveBeenCalledTimes(1);
  });

  it("stops listening when disposed", () => {
    const { env, stop, listeners } = setup();
    stop();
    expect(listeners.has("visibilitychange")).toBe(false);
    expect(env.clearInterval).toHaveBeenCalledWith(1);
  });
});
