import { describe, expect, it, vi } from "vitest";
import { LAUNCH_WINDOW_MS, UPDATE_CHECK_INTERVAL_MS, shouldApplyUpdate, watchForUpdates } from "@/app/swUpdates";

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

describe("shouldApplyUpdate", () => {
  it("applies right after the app opens", () => {
    expect(shouldApplyUpdate({ sinceOpenedMs: 2000, hidden: false, inFocusFlow: false })).toBe(true);
    expect(shouldApplyUpdate({ sinceOpenedMs: LAUNCH_WINDOW_MS, hidden: false, inFocusFlow: false })).toBe(true);
  });

  it("waits while the app is in use, then applies in the background", () => {
    expect(shouldApplyUpdate({ sinceOpenedMs: LAUNCH_WINDOW_MS + 1, hidden: false, inFocusFlow: false })).toBe(false);
    expect(shouldApplyUpdate({ sinceOpenedMs: LAUNCH_WINDOW_MS + 1, hidden: true, inFocusFlow: false })).toBe(true);
  });

  it("never interrupts a lesson, exam, dialogue or review", () => {
    expect(shouldApplyUpdate({ sinceOpenedMs: 0, hidden: false, inFocusFlow: true })).toBe(false);
    expect(shouldApplyUpdate({ sinceOpenedMs: 0, hidden: true, inFocusFlow: true })).toBe(false);
  });
});
