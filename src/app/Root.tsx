import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { readCachedSession } from "@/domain/sessionCache";
import type { Session } from "@/domain/types";
import { OfflineError } from "@/domain/errors";
import { clearCachedProfile, readCachedProfile, useAppState, useRefreshProgress, useVoicePrefetch, writeCachedProfile, type AppProfile } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { ThemeController } from "@/app/ThemeController";
import { UpdatePrompt } from "@/app/UpdatePrompt";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";

function Splash() {
  return (
    <main aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <img src="/icons/icon.svg" alt="" width={96} height={96} className="rounded-lg shadow-raised" />
      <p lang="vi" className="text-title text-primary">{fr.app.name}</p>
    </main>
  );
}

export function Root() {
  const { auth, progress, sync } = useServices();
  const refreshProgress = useRefreshProgress();
  const ready = useAppState((s) => s.ready);
  useVoicePrefetch();

  useEffect(() => {
    let cancelled = false;
    const { set } = useAppState.getState();

    async function loadProfile(): Promise<AppProfile | null> {
      try {
        const profile = await auth.getMyProfile();
        if (profile) writeCachedProfile(profile);
        else clearCachedProfile();
        return profile;
      } catch (e) {
        // With a valid session, any failure falls back to the cached profile so the app still opens.
        if (!(e instanceof OfflineError)) console.warn("Could not load profile, using cache", e);
        return readCachedProfile();
      }
    }

    sync.start();
    const offSize = sync.onSizeChange((n) => set({ pendingSync: n }));
    const offAuth = auth.onChange((session, event) => {
      if (!session) {
        // Only an explicit sign-out clears local identity; a null INITIAL_SESSION or a failed
        // refresh while offline must not log the user out.
        if (event !== "SIGNED_OUT") return;
        clearCachedProfile();
        set({ session: null, profile: null });
        return;
      }
      set({ session });
      void loadProfile().then((profile) => {
        if (!cancelled) set({ profile });
      });
    });

    // Settings never depend on the session: a session failure must not replace saved settings.
    async function loadSettings() {
      try {
        return await progress.getSettings();
      } catch (e) {
        console.error("Bootstrap failed", e);
        return { ...DEFAULT_SETTINGS };
      }
    }

    async function loadSession(): Promise<Session | null> {
      try {
        return await auth.getSession();
      } catch (e) {
        // Offline with an expired token: keep the last known identity instead of sending the user to onboarding.
        if (e instanceof OfflineError) return readCachedSession();
        console.error("Could not read session", e);
        return null;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync.flush().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);

    void (async () => {
      try {
        const [settings, session] = await Promise.all([loadSettings(), loadSession()]);
        const profile = session ? await loadProfile() : null;
        if (cancelled) return;
        set({ settings, session, profile });
        // A failing snapshot must not block the app: the header just shows zeros.
        await refreshProgress().catch(() => undefined);
      } catch (e) {
        console.error("Bootstrap failed", e);
        if (!cancelled) set({ session: null, profile: null });
      } finally {
        if (!cancelled) set({ ready: true });
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      offSize();
      offAuth();
      sync.stop();
    };
  }, [auth, progress, sync, refreshProgress]);

  return (
    <>
      {ready ? <ThemeController /> : null}
      <ToastViewport />
      <UpdatePrompt />
      {ready ? <Outlet /> : <Splash />}
    </>
  );
}
