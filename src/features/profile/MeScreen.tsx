import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { PROFILE_KEY, THEME_KEY } from "@/domain/storageKeys";
import { OfflineError } from "@/domain/errors";
import type { BadgeDef } from "@/domain/types";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { examMention } from "@/services/exam";
import { fr } from "@/i18n/fr";
import {
  Avatar, BadgeMedal, Button, Card, Certificate, ConfirmDialog, Icon, Sheet, StreakFlame, downloadCertificate, tap, useToast,
  type CertificateProps,
} from "@/ui";
import { EditProfileSheet } from "@/features/profile/EditProfileSheet";
import { ReportProblemSheet } from "@/features/profile/ReportProblemSheet";
import { SettingsSection } from "@/features/profile/SettingsSection";

const PASS = 70;

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; nothing to clean then.
  }
}

// Hero: the pseudo and XP. Secondary: badges and settings. The account actions sit quietly at the bottom.

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
  const { auth, progress, content, sync } = useServices();
  const navigate = useNavigate();
  const toast = useToast();
  const profile = useAppState((s) => s.profile);
  const snapshot = useAppState((s) => s.snapshot);
  const [badges, setBadges] = useState<BadgeDef[] | null>(null);
  const [badgesFailed, setBadgesFailed] = useState(false);
  const [bestDate, setBestDate] = useState<{ dateIso: string; noSpeaking: boolean } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [badge, setBadge] = useState<BadgeDef | null>(null);
  const [confirm, setConfirm] = useState<"signout" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const leaving = useRef(false);

  const examBest = snapshot?.examBest ?? null;
  const passed = examBest !== null && examBest >= PASS;

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

  const mention = examBest === null ? "presque" : examMention(examBest);
  const certificate: CertificateProps | null =
    passed && examBest !== null && mention !== "presque" && profile && bestDate
      ? { pseudo: profile.pseudo, score: examBest, mention, dateIso: bestDate.dateIso, noSpeaking: bestDate.noSpeaking }
      : null;

  const unlockedIds = new Set(snapshot?.badges ?? []);
  const sortedBadges = badges ? [...badges].sort((a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id))) : [];

  async function leave(kind: "signout" | "delete"): Promise<void> {
    if (leaving.current) return;
    leaving.current = true;
    setPending(true);
    // Only the remote call can abort: once it succeeded the user is gone, so local cleanup never blocks.
    try {
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
      if (kind === "signout") await sync.flush().catch(() => undefined);
      await progress.clearAll();
    } catch (e) {
      console.warn("Local cleanup failed", e);
    } finally {
      removeKey(PROFILE_KEY);
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
        <div className="flex items-center gap-4">
          <motion.button type="button" whileTap={tap} onClick={() => setEditOpen(true)} aria-label={fr.profile.editAria} className="rounded-full">
            <Avatar emoji={profile?.avatarEmoji ?? ""} size="lg" ring="gold" />
          </motion.button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-title text-ink">{profile?.pseudo ?? ""}</p>
            <p className="tabular text-heading text-gold-ink">{fr.leaderboard.xp(snapshot?.xpTotal ?? 0)}</p>
            <p className="text-caption text-ink-muted">{fr.profile.stats.xp}</p>
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
            <dd className="tabular text-body-strong text-ink">{examBest === null ? fr.profile.stats.examNone : fr.profile.stats.examScore(examBest)}</dd>
          </div>
        </dl>
        {certificate ? (
          <Button variant="secondary" fullWidth onClick={() => setCertOpen(true)}>
            {fr.profile.certificate.open}
          </Button>
        ) : null}
      </Card>

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
