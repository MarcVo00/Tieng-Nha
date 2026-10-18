import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { ContentNotFoundError, OfflineError } from "@/domain/errors";
import type { BadgeDef, Boss, PublicProfile } from "@/domain/types";
import { FINAL_BOSS_ID } from "@/services/tree";
import { livesFromScore } from "@/services/bossFight";
import { EXAM_PASS } from "@/services/exam";
import { fr } from "@/i18n/fr";
import { Avatar, fxSpill, BadgeMedal, Button, Card, EmptyState, Icon, Skeleton, StreakFlame, duration, ease, tap } from "@/ui";

// Hero: avatar + pseudo, with the XP number beside it. The ten lesson dots are the quiet story of progress.

const LESSON_COUNT = 10;
const lessonId = (n: number) => `l${String(n).padStart(2, "0")}`;

type State =
  | { status: "loading" }
  | { status: "redirect" }
  | { status: "offline" | "not-found" | "error" }
  | { status: "ready"; profile: PublicProfile; badges: BadgeDef[] };

function BackLink() {
  return (
    <motion.div whileTap={tap} className="inline-block">
      <Link to="/leaderboard" aria-label={fr.publicProfile.back} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted">
        <Icon name="chevron-left" size={24} />
      </Link>
    </motion.div>
  );
}

// Won is decided by the score alone; the boss sheet only adds the name and the lives. Nothing is claimed while it loads.
function bossStat(examBest: number | null, boss: Boss | null, bossFailed: boolean): string {
  if (examBest !== null && examBest >= EXAM_PASS) {
    if (bossFailed) return fr.publicProfile.bossWonNoLives;
    const lives = boss ? livesFromScore(examBest, boss.playerLives) : null;
    return boss && lives !== null ? fr.publicProfile.bossWon(boss.name, lives, boss.playerLives) : "…";
  }
  return boss || examBest === null || bossFailed ? fr.publicProfile.examNone : "…";
}

export function PublicProfileScreen() {
  const { userId = "" } = useParams();
  const { leaderboard, content, progress } = useServices();
  const myId = useAppState((s) => s.session?.userId);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [bossFailed, setBossFailed] = useState(false);

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
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      // My own id may differ from the session's (leaderboard rows carry isMe): check both cached periods.
      const cached = await Promise.all([progress.getCachedLeaderboard("week"), progress.getCachedLeaderboard("all")]).catch(() => []);
      if (cancelled) return;
      if (cached.some((c) => c?.rows.some((r) => r.isMe && r.userId === userId))) {
        setState({ status: "redirect" });
        return;
      }
      try {
        const [profile, badges] = await Promise.all([leaderboard.getPublicProfile(userId), content.getBadges()]);
        if (!cancelled) setState({ status: "ready", profile, badges });
      } catch (error) {
        if (cancelled) return;
        setState({ status: error instanceof OfflineError ? "offline" : error instanceof ContentNotFoundError ? "not-found" : "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaderboard, content, progress, userId, attempt]);

  if (myId !== undefined && userId === myId) return <Navigate to="/me" replace />;
  if (state.status === "redirect") return <Navigate to="/me" replace />;

  if (state.status === "loading") {
    return (
      <div role="status" aria-label={fr.app.loading}>
        <BackLink />
        <div className="flex items-center gap-4 pt-2">
          <div className="h-20 w-20 shrink-0 rounded-full bg-surface-2" />
          <div className="flex-1"><Skeleton lines={2} /></div>
        </div>
        <div className="pt-6"><Skeleton lines={3} /></div>
      </div>
    );
  }

  if (state.status !== "ready") {
    const copy = state.status === "offline" ? fr.publicProfile.offline : state.status === "not-found" ? fr.publicProfile.notFound : fr.publicProfile.error;
    return (
      <div>
        <BackLink />
        <EmptyState
          title={copy.title}
          body={copy.body}
          illustration={state.status === "not-found" ? "lantern" : "boat"}
          {...(state.status === "not-found" ? {} : { action: <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{fr.app.error.retry}</Button> })}
        />
      </div>
    );
  }

  const { profile, badges } = state;
  const done = new Set(profile.lessonsDone);
  const doneCount = Array.from({ length: LESSON_COUNT }, (_, i) => done.has(lessonId(i + 1))).filter(Boolean).length;
  const unlocked = new Set(profile.badges);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: ease.out }} className="pb-8">
      <BackLink />
      <div className="flex items-center gap-4 pt-2">
        {/* The effect layer spills 40 % of the avatar on every side: leave it room so it never covers the text. */}
        <span className={`inline-flex ${fxSpill(profile.fx)}`}>
          <Avatar emoji={profile.avatarEmoji} size="lg" frame={profile.frame} fx={profile.fx} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title text-ink">{profile.pseudo}</h1>
          <p className="tabular text-heading text-gold-ink">{fr.leaderboard.xp(profile.xpTotal)}</p>
          <p className="text-caption text-ink-muted">{fr.publicProfile.xpTotal}</p>
        </div>
      </div>

      <dl className="mt-5 flex gap-6">
        <div>
          <dt className="text-caption text-ink-muted">{fr.publicProfile.xpWeek}</dt>
          <dd className="tabular text-body-strong text-gold-ink">{fr.leaderboard.xp(profile.xpWeek)}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{fr.publicProfile.streakLabel}</dt>
          <dd><StreakFlame days={profile.streak} size="sm" /></dd>
        </div>
      </dl>

      <section className="mt-8" aria-labelledby="pp-lessons">
        <div className="flex items-baseline justify-between">
          <h2 id="pp-lessons" className="text-heading text-ink">{fr.publicProfile.lessonsTitle}</h2>
          <span className="tabular text-caption text-ink-muted">{fr.publicProfile.lessonsSummary(doneCount)}</span>
        </div>
        <ol className="mt-3 flex list-none gap-2">
          {Array.from({ length: LESSON_COUNT }, (_, i) => {
            const isDone = done.has(lessonId(i + 1));
            return (
              <li key={lessonId(i + 1)} className={`h-6 flex-1 rounded-full ${isDone ? "bg-success" : "bg-surface-2"}`}>
                <span className="sr-only">{fr.publicProfile.lessonDot(i + 1, isDone)}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="pp-badges">
        <h2 id="pp-badges" className="text-heading text-ink">{fr.publicProfile.badgesTitle}</h2>
        <ul className="mt-3 grid list-none grid-cols-3 gap-4">
          {badges.map((b) => (
            <li key={b.id} className="flex justify-center">
              <BadgeMedal icon={b.icon} title={b.title} unlocked={unlocked.has(b.id)} />
            </li>
          ))}
        </ul>
      </section>

      <Card className="mt-8 p-4">
        <p className="text-caption text-ink-muted">{fr.publicProfile.examTitle}</p>
        <p className="tabular text-heading text-ink">
          {bossStat(profile.examBest, boss, bossFailed)}
        </p>
      </Card>
    </motion.div>
  );
}
