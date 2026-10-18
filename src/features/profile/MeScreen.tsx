import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { THEME_KEY } from "@/domain/storageKeys";
import { OfflineError } from "@/domain/errors";
import { clearCachedProfile, useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { BadgeDef, Boss } from "@/domain/types";
import { lookOf } from "@/services/look";
import { FINAL_BOSS_ID } from "@/services/tree";
import { bossMention, livesFromScore } from "@/services/bossFight";
import { EXAM_PASS } from "@/services/exam";
import { fr } from "@/i18n/fr";
import {
  Avatar, fxSpill, BadgeMedal, Button, Card, Certificate, ConfirmDialog, Icon, Sheet, StreakFlame, downloadCertificate, tap, useToast,
  type CertificateProps,
} from "@/ui";
import { EditProfileSheet } from "@/features/profile/EditProfileSheet";
import { WardrobeSection } from "@/features/profile/WardrobeSection";
import { RewardsSection } from "@/features/profile/RewardsSection";
import { ReportProblemSheet } from "@/features/profile/ReportProblemSheet";
import { SettingsSection } from "@/features/profile/SettingsSection";

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; nothing to clean then.
  }
}

// Hero: the pseudo and XP. Secondary: badges and settings. The account actions sit quietly at the bottom.

const FLUSH_TIMEOUT_MS = 3000;

async function flushBeforeSignOut(flush: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FLUSH_TIMEOUT_MS);
  });
  try {
    await Promise.race([flush.then(() => undefined), timeout]);
  } catch {
    // Best effort: a failed flush never blocks signing out.
  } finally {
    clearTimeout(timer);
  }
}

function CertificateSheet({ open, onClose, data }: { open: boolean; onClose(): void; data: CertificateProps | null }) {
  const [failed, setFailed] = useState(false);
  const download = async () => {
    if (!data) return;
    setFailed(false);
    const ok = await downloadCertificate(data).catch(() => false);
    if (!ok) setFailed(true);
  };
  return (
    <Sheet open={open} onClose={onClose} label={fr.profile.certificate.sheet}>
      {open && data ? (
        <div className="flex max-h-[80dvh] flex-col gap-4 overflow-y-auto">
          <h2 className="text-heading text-ink">{fr.profile.certificate.sheet}</h2>
          <Certificate {...data} />
          <Button fullWidth onClick={() => void download()}>
            <Icon name="download" size={20} />
            {fr.profile.certificate.download}
          </Button>
          {failed ? (
            <p role="alert" className="text-caption text-error">
              {fr.profile.certificate.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function BadgeSheet({ badge, unlocked, onClose }: { badge: BadgeDef | null; unlocked: boolean; onClose(): void }) {
  return (
    <Sheet open={badge !== null} onClose={onClose} label={badge?.title ?? fr.profile.badges.title}>
      {badge ? (
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <BadgeMedal icon={badge.icon} title={badge.title} unlocked={unlocked} size="lg" />
          <p className="text-body text-ink">{badge.description}</p>
          <p className="text-caption text-ink-muted">{unlocked ? fr.profile.badges.unlocked : fr.profile.badges.locked}</p>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {fr.profile.badges.close}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

export function MeScreen() {
  const { auth, progress, content, sync, outbox } = useServices();
  const navigate = useNavigate();
  const toast = useToast();
  const profile = useAppState((s) => s.profile);
  const snapshot = useAppState((s) => s.snapshot);
  const coins = useAppState((s) => s.wallet?.coins ?? null);
  const frame = useAppState((s) => s.wallet?.equipped.frame ?? null);
  const fx = useAppState((s) => s.wallet?.equipped.profile_fx ?? null);
  const equipped = useAppState((s) => s.wallet?.equipped);
  const look = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [bossFailed, setBossFailed] = useState(false);
  const [badges, setBadges] = useState<BadgeDef[] | null>(null);
  const [badgesFailed, setBadgesFailed] = useState(false);
  const [bestDate, setBestDate] = useState<{ dateIso: string; noSpeaking: boolean } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [badge, setBadge] = useState<BadgeDef | null>(null);
  const [confirm, setConfirm] = useState<"signout" | "unsynced" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const leaving = useRef(false);

  const examBest = snapshot?.examBest ?? null;
  const passed = examBest !== null && examBest >= EXAM_PASS;

  useEffect(() => {
    let cancelled = false;
    content
      .getBadges()
      .then((b) => !cancelled && setBadges(b))
      .catch(() => !cancelled && setBadgesFailed(true));
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    content
      .getBoss(FINAL_BOSS_ID)
      .then((b) => !cancelled && setBoss(b))
      .catch(() => !cancelled && setBossFailed(true)); // The stat falls back to a plain label.
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    if (!passed) return;
    let cancelled = false;
    progress
      .listEvents()
      .then((events) => {
        // The best attempt; on equal scores the earliest one (listEvents is ordered by date).
        let best: { score: number; dateIso: string; noSpeaking: boolean } | null = null;
        for (const e of events) {
          if (e.type !== "exam_finished") continue;
          const score = typeof e.payload.score === "number" ? e.payload.score : -1;
          if (best === null || score > best.score) best = { score, dateIso: e.createdAt, noSpeaking: e.payload.noSpeaking === true };
        }
        if (!cancelled && best) setBestDate({ dateIso: best.dateIso, noSpeaking: best.noSpeaking });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [passed, progress]);

  const lives = passed && boss && examBest !== null ? livesFromScore(examBest, boss.playerLives) : null;
  // Won is decided by the score alone; the boss sheet only adds the name and the lives. Nothing is claimed while it loads.
  const bossStat =
    passed && bossFailed
      ? fr.profile.stats.bossWonNoLives
      : passed
        ? boss && lives !== null
          ? fr.profile.stats.bossWon(boss.name, lives, boss.playerLives)
          : null
        : boss || examBest === null || bossFailed
          ? fr.profile.stats.examNone
          : null;
  const mention = examBest === null ? "presque" : bossMention(examBest);
  const certificate: CertificateProps | null =
    passed && examBest !== null && mention !== "presque" && profile && bestDate
      ? { pseudo: profile.pseudo, score: examBest, mention, dateIso: bestDate.dateIso, noSpeaking: bestDate.noSpeaking }
      : null;

  const unlockedIds = new Set(snapshot?.badges ?? []);
  const sortedBadges = badges ? [...badges].sort((a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id))) : [];

  async function leave(kind: "signout" | "delete", skipUnsyncedCheck = false): Promise<void> {
    if (leaving.current) return;
    leaving.current = true;
    setPending(true);
    // Only the remote call can abort: once it succeeded the user is gone, so local cleanup never blocks.
    try {
      // Flush while the session is still valid; a slow network must not keep the dialog busy.
      if (kind === "signout" && !skipUnsyncedCheck) {
        await flushBeforeSignOut(sync.flush());
        // Signing out wipes local data: warn first when some progress never reached the server.
        if ((await outbox.size().catch(() => 0)) > 0) {
          leaving.current = false;
          setPending(false);
          setConfirm("unsynced");
          return;
        }
      }
      if (kind === "signout") await auth.signOut();
      else await auth.deleteAccount();
    } catch (e) {
      leaving.current = false;
      setPending(false);
      setConfirm(null);
      toast.show({ title: e instanceof OfflineError ? fr.profile.account.offline : fr.profile.account.error });
      return;
    }
    try {
      await progress.clearAll();
    } catch (e) {
      console.warn("Local cleanup failed", e);
    } finally {
      clearCachedProfile();
      removeKey(THEME_KEY);
      useAppState.getState().set({
        session: null,
        profile: null,
        snapshot: null,
        dueCount: 0,
        settings: { ...DEFAULT_SETTINGS, onboardingDone: false },
      });
      navigate("/welcome", { replace: true });
    }
  }

  const a = fr.profile.account;

  return (
    <div className="flex flex-col gap-8 pb-8">
      <h1 className="sr-only">{fr.profile.title}</h1>

      <Card raised className="flex flex-col gap-4 p-5">
        {/* The whole hero is the star of the header (spec 5.4); name and XP sit quietly beneath. */}
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.button type="button" whileTap={tap} onClick={() => setEditOpen(true)} aria-label={fr.profile.editAria} className={`rounded-full ${fxSpill(fx, "xl")}`}>
            <Avatar emoji={profile?.avatarEmoji ?? ""} size="xl" ring="gold" frame={frame} fx={fx} look={look} />
          </motion.button>
          <div className="min-w-0 max-w-full">
            <p className="truncate text-title text-ink">{profile?.pseudo ?? ""}</p>
            <p className="tabular text-heading text-gold-ink">{fr.leaderboard.xp(snapshot?.xpTotal ?? 0)}</p>
            <p className="text-caption text-ink-muted">{fr.profile.stats.xp}</p>
            <Link to="/shop" className="mt-1 inline-flex min-h-11 items-center text-caption text-primary underline underline-offset-2">
              {fr.profile.changeOutfit}
            </Link>
          </div>
        </div>
        <dl className="flex gap-6">
          <div>
            <dt className="text-caption text-ink-muted">{fr.profile.stats.streak}</dt>
            <dd>
              <StreakFlame days={snapshot?.streak ?? 0} size="sm" />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{fr.profile.stats.exam}</dt>
            <dd className="tabular text-body-strong text-ink">{bossStat ?? "…"}</dd>
          </div>
        </dl>
        {certificate ? (
          <Button variant="secondary" fullWidth onClick={() => setCertOpen(true)}>
            {fr.profile.certificate.open}
          </Button>
        ) : null}
      </Card>

      <Link
        to="/shop"
        className="flex min-h-11 items-center justify-between gap-3 rounded-md border-2 border-line bg-surface px-5 py-3 text-body-strong text-ink"
      >
        <span className="flex items-center gap-2">
          <Icon name="coin" size={24} className="text-gold" />
          {fr.shop.open}
        </span>
        {coins !== null ? <span className="tabular text-gold-ink">{fr.shop.balance(coins)}</span> : null}
      </Link>

      <section aria-labelledby="me-badges">
        <div className="flex items-baseline justify-between">
          <h2 id="me-badges" className="text-heading text-ink">
            {fr.profile.badges.title}
          </h2>
          {badges ? <span className="tabular text-caption text-ink-muted">{fr.profile.badges.count(sortedBadges.filter((b) => unlockedIds.has(b.id)).length, sortedBadges.length)}</span> : null}
        </div>
        {badgesFailed ? <p className="mt-3 text-body text-ink-muted">{fr.profile.badges.loadError}</p> : null}
        <ul className="mt-3 grid list-none grid-cols-3 gap-4">
          {sortedBadges.map((b) => (
            <li key={b.id} className="flex justify-center">
              <motion.button type="button" whileTap={tap} onClick={() => setBadge(b)} className="min-h-11 rounded-md p-1">
                <BadgeMedal icon={b.icon} title={b.title} unlocked={unlockedIds.has(b.id)} />
              </motion.button>
            </li>
          ))}
        </ul>
      </section>

      <WardrobeSection />

      <RewardsSection badges={badges} />

      <SettingsSection onReport={() => setReportOpen(true)} />

      <section aria-labelledby="me-account" className="flex flex-col gap-3 pt-4">
        <h2 id="me-account" className="text-heading text-ink">
          {a.title}
        </h2>
        <Button variant="secondary" fullWidth onClick={() => setConfirm("signout")}>
          {a.signOut.open}
        </Button>
        <div className="pt-6">
          <Button variant="danger" fullWidth onClick={() => setConfirm("delete")}>
            {a.delete.open}
          </Button>
        </div>
      </section>

      {profile ? <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} current={profile} /> : null}
      <ReportProblemSheet open={reportOpen} onClose={() => setReportOpen(false)} />
      <CertificateSheet open={certOpen} onClose={() => setCertOpen(false)} data={certificate} />
      <BadgeSheet badge={badge} unlocked={badge !== null && unlockedIds.has(badge.id)} onClose={() => setBadge(null)} />
      <ConfirmDialog
        open={confirm === "signout"}
        title={a.signOut.title}
        body={a.signOut.body}
        busy={pending}
        confirmLabel={a.signOut.confirm}
        cancelLabel={a.signOut.cancel}
        onConfirm={() => void leave("signout")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "unsynced"}
        title={a.unsynced.title}
        body={a.unsynced.body}
        busy={pending}
        confirmLabel={a.unsynced.confirm}
        cancelLabel={a.unsynced.cancel}
        danger
        onConfirm={() => void leave("signout", true)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={a.delete.title}
        body={a.delete.body}
        confirmLabel={a.delete.confirm}
        cancelLabel={a.delete.cancel}
        danger
        busy={pending}
        requireText={a.delete.word}
        onConfirm={() => void leave("delete")}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
