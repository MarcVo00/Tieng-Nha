import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { PROFILE_KEY } from "@/domain/storageKeys";
import { OfflineError } from "@/domain/errors";
import { useAppState, useRefreshProgress, type AppProfile } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { ThemeController } from "@/app/ThemeController";
import { UpdatePrompt } from "@/app/UpdatePrompt";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";

const ProfileSchema = z.object({ pseudo: z.string(), avatarEmoji: z.string() });

function readCachedProfile(): AppProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = ProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: AppProfile | null): void {
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Cache is best-effort; without it an offline cold start just asks to sign in again.
  }
}

function Splash() {
  return (
    <main aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <img src="/icons/icon.svg" alt="" width={96} height={96} className="rounded-lg shadow-raised" />
      <p className="text-title text-primary">{fr.app.name}</p>
    </main>
  );
}

export function Root() {
  const { auth, progress, sync } = useServices();
  const refreshProgress = useRefreshProgress();
  const ready = useAppState((s) => s.ready);

  useEffect(() => {
    let cancelled = false;
    const { set } = useAppState.getState();

    async function loadProfile(): Promise<AppProfile | null> {
      try {
        const profile = await auth.getMyProfile();
        writeCachedProfile(profile);
        return profile;
      } catch (e) {
        // With a valid session, any failure falls back to the cached profile so the app still opens.
        if (!(e instanceof OfflineError)) console.warn("Could not load profile, using cache", e);
        return readCachedProfile();
      }
    }

    sync.start();
    const offSize = sync.onSizeChange((n) => set({ pendingSync: n }));
    const offAuth = auth.onChange((session) => {
      set({ session });
      if (!session) {
        writeCachedProfile(null);
        set({ profile: null });
        return;
      }
      void loadProfile().then((profile) => {
        if (!cancelled) set({ profile });
      });
    });

    void (async () => {
      try {
        const [settings, session] = await Promise.all([progress.getSettings(), auth.getSession()]);
        const profile = session ? await loadProfile() : null;
        if (cancelled) return;
        set({ settings, session, profile });
        // A failing snapshot must not block the app: the header just shows zeros.
        await refreshProgress().catch(() => undefined);
      } catch (e) {
        console.error("Bootstrap failed", e);
        if (!cancelled) set({ settings: { ...DEFAULT_SETTINGS }, session: null, profile: null });
      } finally {
        if (!cancelled) set({ ready: true });
      }
    })();

    return () => {
      cancelled = true;
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
