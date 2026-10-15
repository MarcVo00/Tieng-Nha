import { AnimatePresence } from "motion/react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { useAppState } from "@/app/appState";
import { EnergyIndicator } from "@/app/EnergyIndicator";
import { SyncIndicator } from "@/app/SyncIndicator";
import { fr } from "@/i18n/fr";
import { InAppBrowserNotice } from "@/features/onboarding";
import { Avatar, PageTransition, StreakFlame, TabBar, XpCounter } from "@/ui";

export function TabLayout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const profile = useAppState((s) => s.profile);
  const snapshot = useAppState((s) => s.snapshot);
  const frame = useAppState((s) => s.wallet?.equipped.frame ?? null);
  const dueCount = useAppState((s) => s.dueCount);

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 pb-28">
      <header className="flex items-center gap-3 py-3">
        <Link to="/me" aria-label={fr.app.header.profile} className="flex h-11 w-11 items-center justify-center rounded-full">
          <Avatar emoji={profile?.avatarEmoji ?? ""} size="sm" frame={frame} />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <SyncIndicator />
          <EnergyIndicator />
          <StreakFlame days={snapshot?.streak ?? 0} size="sm" />
          <XpCounter value={snapshot?.xpTotal ?? 0} />
        </div>
      </header>
      <InAppBrowserNotice className="mb-4" dismissible />
      <main>
        <AnimatePresence mode="wait">
        <PageTransition key={pathname} variant="tab">
          {outlet}
        </PageTransition>
      </AnimatePresence>
      </main>
      <TabBar
        items={[
          { to: "/", label: fr.app.tabs.learn, icon: "home" },
          { to: "/review", label: fr.app.tabs.review, icon: "review", badge: dueCount },
          { to: "/leaderboard", label: fr.app.tabs.leaderboard, icon: "trophy" },
          { to: "/me", label: fr.app.tabs.me, icon: "user" },
        ]}
      />
    </div>
  );
}
