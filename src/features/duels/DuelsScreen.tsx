import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useChallenge } from "@/app/useChallenge";
import { OfflineError } from "@/domain/errors";
import type { Duel, LeaderboardRow } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Avatar, Button, Card, duration, EmptyState, ease, Icon, Skeleton, tap } from "@/ui";
import { readPending, readRun, unsentDuelIds } from "@/features/duels/duelRunState";
import { hoursLeft, otherId, outcomeOf, splitDuels } from "@/features/duels/duelsView";

// Hero: what is waiting for me (« À toi de jouer »). Kim bài is the quiet gold counter in the corner.
// One primary action: playing a waiting duel; challenging someone is a secondary button per member.

type Load =
  | { status: "loading" }
  | { status: "offline" | "error" }
  | { status: "ready"; duels: Duel[]; members: LeaderboardRow[]; membersFailed: boolean };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-heading text-ink">{title}</h2>
      <ul className="mt-3 flex list-none flex-col gap-3">{children}</ul>
    </section>
  );
}

function DuelRow({ duel, to, title, caption, trailing }: { duel: Duel; to: string; title: string; caption: string; trailing?: ReactNode }) {
  return (
    <motion.li whileTap={tap}>
      <Card raised>
        <Link to={to} className="flex min-h-14 items-center gap-3 p-3">
          <Avatar emoji={duel.opponentAvatar} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-strong text-ink">{title}</span>
            <span className="block truncate text-caption text-ink-muted">{caption}</span>
          </span>
          {trailing}
          <Icon name="chevron-right" size={20} className="shrink-0 text-ink-muted" />
        </Link>
      </Card>
    </motion.li>
  );
}

export function DuelsScreen() {
  const { duels, leaderboard, activity, clock } = useServices();
  const refresh = useRefreshProgress();
  const myId = useAppState((s) => s.session?.userId) ?? "";
  const kimBai = useAppState((s) => s.wallet?.kimBai ?? 0);
  const challenge = useChallenge();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [challenging, setChallenging] = useState<string | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    void (async () => {
      try {
        const list = await duels.list();
        if (cancelled) return;
        // Settled duels pay out once; the wallet is refreshed only when something was added.
        void activity
          .claimSettledDuels(list)
          .then((added) => (added > 0 ? refresh() : undefined))
          .catch(() => undefined);
        let members: LeaderboardRow[] = [];
        let membersFailed = false;
        try {
          members = (await leaderboard.list("all")).filter((m) => !m.isMe);
        } catch {
          membersFailed = true; // the duels themselves loaded: only the challenge list gets a quiet hint
        }
        if (!cancelled) setLoad({ status: "ready", duels: list, members, membersFailed });
      } catch (e) {
        if (!cancelled) setLoad({ status: e instanceof OfflineError ? "offline" : "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duels, leaderboard, activity, refresh, attempt]);

  const ready = load.status === "ready" ? load : null;
  const sections = useMemo(() => (ready ? splitDuels(ready.duels, clock()) : null), [ready, clock]);
  // Local runs are re-read with every load of the list.
  const unsent = useMemo(() => new Set(load.status === "loading" ? [] : unsentDuelIds()), [load]);
  const busyWith = useMemo(() => new Set((ready?.duels ?? []).filter((d) => d.status === "open").map((d) => otherId(d, myId))), [ready, myId]);

  const onChallenge = (userId: string) => {
    setChallenging(userId);
    void challenge.start(userId).finally(() => setChallenging(null));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: ease.out }} className="pb-8">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-title text-ink">{fr.duels.title}</h1>
        <p className="tabular flex items-center gap-1.5 text-body-strong text-gold-ink">
          <Icon name="medal" size={22} />
          <span aria-hidden="true">{kimBai}</span>
          <span className="sr-only">{`${fr.duels.kimBaiLabel} : ${fr.duels.kimBai(kimBai)}`}</span>
        </p>
      </div>

      {challenge.unlocked === false ? null : (
        <motion.div whileTap={tap} className="mt-4">
          <Card>
            <Link to="/arena" className="flex min-h-14 items-center gap-3 p-3">
              <Icon name="medal" size={28} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-body-strong text-ink">{fr.arena.entry}</span>
                <span className="block truncate text-caption text-ink-muted">{fr.arena.entryHint}</span>
              </span>
              <Icon name="chevron-right" size={20} className="shrink-0 text-ink-muted" />
            </Link>
          </Card>
        </motion.div>
      )}

      {challenge.unlocked === false ? (
        <EmptyState title={fr.duels.hub.lockedTitle} body={fr.duels.locked} illustration="lantern" />
      ) : load.status === "loading" ? (
        <div role="status" aria-label={fr.app.loading} className="pt-6"><Skeleton lines={4} className="h-14" /></div>
      ) : load.status === "offline" ? (
        <>
          <EmptyState
            title={fr.duels.hub.offline.title}
            body={fr.duels.hub.offline.body}
            illustration="boat"
            action={<Button variant="secondary" onClick={reload}>{fr.app.error.retry}</Button>}
          />
          <ul className="list-none">
            {[...unsent].map((id) => (
              <li key={id}>
                <Link to={`/duel/${id}/run`} className="flex min-h-11 items-center gap-2 px-5 text-body-strong text-primary">
                  <Icon name="bolt" size={18} />
                  {fr.duels.hub.unsentHint}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : load.status === "error" ? (
        <EmptyState
          title={fr.duels.hub.error.title}
          body={fr.duels.hub.error.body}
          illustration="boat"
          action={<Button variant="secondary" onClick={reload}>{fr.app.error.retry}</Button>}
        />
      ) : sections && ready ? (
        <>
          {sections.toPlay.length > 0 ? (
            <Section id="duels-to-play" title={fr.duels.toPlay}>
              {sections.toPlay.map((d, index) => {
                const pending = unsent.has(d.id);
                const resumable = pending || readRun(d.id) !== null || readPending(d.id) !== null;
                return (
                  <DuelRow
                    key={d.id}
                    duel={d}
                    to={`/duel/${d.id}/run`}
                    title={fr.duels.hub.versus(d.opponentPseudo)}
                    caption={pending ? fr.duels.hub.unsentHint : fr.duels.hub.timeLeft(hoursLeft(d, clock()))}
                    trailing={
                      <span className={`rounded-full px-3 py-1 text-caption font-semibold ${index === 0 ? "bg-primary text-primary-on" : "bg-surface-2 text-primary"}`}>
                        {pending ? fr.duels.hub.unsent : resumable ? fr.duels.hub.resume : fr.duels.hub.play}
                      </span>
                    }
                  />
                );
              })}
            </Section>
          ) : null}

          {sections.waiting.length > 0 ? (
            <Section id="duels-waiting" title={fr.duels.waiting}>
              {sections.waiting.map((d) => (
                <DuelRow
                  key={d.id}
                  duel={d}
                  to={`/duel/${d.id}`}
                  title={fr.duels.hub.waitingFor(d.opponentPseudo)}
                  caption={fr.duels.hub.timeLeft(hoursLeft(d, clock()))}
                />
              ))}
            </Section>
          ) : null}

          <section aria-labelledby="duels-challenge" className="mt-8">
            <h2 id="duels-challenge" className="text-heading text-ink">{fr.duels.hub.challengeTitle}</h2>
            <p className="text-caption text-ink-muted">{fr.duels.hub.challengeSub}</p>
            {challenge.message ? <p role="alert" className="mt-3 rounded-md bg-surface-2 p-3 text-body text-ink">{challenge.message}</p> : null}
            {ready.membersFailed ? (
              <div className="mt-3 flex items-center gap-3 text-caption text-ink-muted">
                <p className="flex-1">{fr.duels.hub.membersError}</p>
                <Button variant="ghost" onClick={reload}>{fr.app.error.retry}</Button>
              </div>
            ) : null}
            {ready.members.length > 0 ? (
              <ul aria-label={fr.duels.hub.membersLabel} className="mt-3 list-none">
                {ready.members.map((m) => (
                  <li key={m.userId} className="flex min-h-14 items-center gap-3 border-b border-line py-2">
                    <Avatar emoji={m.avatarEmoji} size="md" frame={m.frame} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-strong text-ink">{m.pseudo}</span>
                      {busyWith.has(m.userId) ? (
                        <span id={`duel-why-${m.userId}`} className="block text-caption text-ink-muted">{fr.duels.hub.alreadyOpen}</span>
                      ) : null}
                    </span>
                    <Button
                      variant="secondary"
                      aria-label={fr.duels.hub.challengeWho(m.pseudo)}
                      aria-describedby={busyWith.has(m.userId) ? `duel-why-${m.userId}` : undefined}
                      disabled={busyWith.has(m.userId) || challenge.busy}
                      loading={challenging === m.userId}
                      onClick={() => onChallenge(m.userId)}
                    >
                      {fr.duels.challenge}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {sections.done.length > 0 ? (
            <Section id="duels-done" title={fr.duels.done}>
              {sections.done.map((d) => {
                const reward = d.myRun?.reward ?? 0;
                return (
                  <DuelRow
                    key={d.id}
                    duel={d}
                    to={`/duel/${d.id}`}
                    title={fr.duels.hub.versus(d.opponentPseudo)}
                    caption={fr.duels.hub.outcome[outcomeOf(d, myId)]}
                    trailing={reward > 0 ? <span className="tabular text-caption font-semibold text-gold-ink">{fr.duels.kimBaiWon(reward)}</span> : null}
                  />
                );
              })}
            </Section>
          ) : null}

          {sections.toPlay.length + sections.waiting.length + sections.done.length === 0 && ready.members.length === 0 && !ready.membersFailed ? (
            <EmptyState title={fr.duels.hub.empty.title} body={fr.duels.hub.empty.body} illustration="lantern" />
          ) : null}
        </>
      ) : null}
    </motion.div>
  );
}
