import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion, useAnimationControls, useReducedMotion, type AnimationControls } from "motion/react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useChallenge } from "@/app/useChallenge";
import { OfflineError } from "@/domain/errors";
import type { Duel, Look } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { lookOf } from "@/services/look";
import { DUEL } from "@/services/duel";
import { Avatar, Button, Confetti, duration, EmptyState, ease, FocusHeader, Icon, Skeleton, spring } from "@/ui";
import { duelReplay, replayStats, verdictOf, type ReplayStats, type ReplayStep } from "@/features/duels/duelReplay";
import { markResultSeen, wasResultSeen } from "@/app/usePendingDuels";
import { otherId } from "@/features/duels/duelsView";

// Hero: the two equipped heroes face to face (mine bottom-left, theirs top-right, like a fight-game stage), then the
// headline of the bilan. One primary action: « Revanche ». The replay uses transform/opacity only; « Passer » or
// reduced motion jump straight to the final poses and the bilan.

const DUELS_HOME = "/duels";

type Side = "me" | "them";
type Kind = ReplayStep["kind"];

type Load =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "error" }
  | { status: "notFound" }
  | { status: "toPlay" }
  | { status: "ready"; duel: Duel; theirLook: Look; theirFrame: string | null };

type Beat = { type: "banner"; round: 1 | 2 } | { type: "step"; step: ReplayStep } | { type: "finale" };

// Beat lengths, composed from the motion tokens (seconds).
const BEAT_S = {
  banner: duration.celebrate + duration.slow,
  hit: duration.slow + duration.base,
  miss: duration.slow + duration.base,
  critical: duration.celebrate + duration.fast,
  finale: duration.celebrate + duration.slow,
} as const;
// Lunge geometry: from my medallion (bottom-left) towards theirs (top-right). `reach` is the share of the path.
const PATH = { x: 160, y: -188 } as const;
const LUNGE = { hit: { reach: 0.3, time: duration.slow, impactAt: 0.45 }, critical: { reach: 0.5, time: duration.slow + duration.base, impactAt: 0.55 } } as const;
const impactDelay = (kind: Kind): number => (kind === "critical" ? LUNGE.critical.time * LUNGE.critical.impactAt : LUNGE.hit.time * LUNGE.hit.impactAt);
const dirOf = (attacker: Side) => (attacker === "me" ? 1 : -1);

const pose = {
  rest: { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
  absent: { x: 0, y: 0, rotate: 0, scale: 0.96, opacity: 0.45 },
  // Like the defeated boss: tilted towards the winner, sunk a little.
  bowed: (side: Side) => ({ x: 0, y: 12, rotate: side === "me" ? 16 : -16, scale: 0.94, opacity: 0.75 }),
} as const;

function buildBeats(steps: readonly ReplayStep[]): Beat[] {
  const beats: Beat[] = [];
  let round: 1 | 2 | null = null;
  for (const step of steps) {
    if (step.round !== round) {
      round = step.round;
      beats.push({ type: "banner", round });
    }
    beats.push({ type: "step", step });
  }
  beats.push({ type: "finale" });
  return beats;
}

function lunge(controls: AnimationControls, attacker: Side, kind: Kind) {
  const d = dirOf(attacker);
  if (kind === "miss") {
    // A stumble: a short step forward, the hero tips over and catches itself.
    return controls.start({
      x: [0, 22 * d, 16 * d, 0],
      y: [0, -12 * d, 6, 0],
      rotate: [0, 18 * d, -8 * d, 0],
      transition: { duration: duration.slow, ease: ease.inOut, times: [0, 0.35, 0.7, 1] },
    });
  }
  const l = LUNGE[kind];
  const big = kind === "critical";
  return controls.start({
    // Wind-up backwards, strike, come back.
    x: [0, -10 * d * (big ? 1.6 : 1), PATH.x * l.reach * d, 0],
    y: [0, -PATH.y * 0.05 * d * (big ? 1.6 : 1), PATH.y * l.reach * d, 0],
    scale: big ? [1, 0.96, 1.1, 1] : [1, 0.98, 1.04, 1],
    rotate: [0, -4 * d, 6 * d, 0],
    transition: { duration: l.time, ease: ease.inOut, times: [0, l.impactAt * 0.55, l.impactAt, 1] },
  });
}

function recoil(controls: AnimationControls, attacker: Side, kind: "hit" | "critical") {
  const d = dirOf(attacker);
  const k = kind === "critical" ? 2 : 1;
  return controls.start({
    x: [0, 12 * k * d, -3 * d, 0],
    y: [0, -10 * k * d, 2 * d, 0],
    rotate: [0, 6 * k * d, -2 * d, 0],
    opacity: kind === "critical" ? [1, 0.25, 1, 0.25, 1] : [1, 0.35, 1, 0.5, 1],
    transition: { duration: kind === "critical" ? duration.slow + duration.base : duration.slow, ease: ease.out, delay: impactDelay(kind) },
  });
}

// A brush-ink slash drawn over the defender on impact.
function Slash({ big }: { big: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={big ? 112 : 80} height={big ? 112 : 80} aria-hidden="true" className={big ? "text-gold" : "text-primary"}>
      <path d="M10 50 C24 36 38 24 56 10" fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" />
      <path d="M14 30 C26 30 40 34 50 42" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" opacity={0.75} />
    </svg>
  );
}

function HpPlate({ name, hp, absent, className }: { name: string; hp: number; absent: boolean; className: string }) {
  const low = hp <= 25;
  return (
    <div className={`absolute w-40 rounded-md bg-surface px-3 py-2 shadow-card ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-body-strong text-ink">{name}</span>
        <span className={`tabular text-caption ${hp === 0 ? "font-semibold text-error" : "text-ink-muted"}`}>
          {absent ? fr.duels.result.forfeit : hp === 0 ? fr.duels.result.ko : hp}
        </span>
      </div>
      <div
        role="meter"
        aria-label={fr.duels.result.hp(name, hp)}
        aria-valuemin={0}
        aria-valuemax={DUEL.hp}
        aria-valuenow={hp}
        className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <motion.div
          className={`h-full w-full origin-left rounded-full ${low ? "bg-error" : "bg-success"}`}
          initial={false}
          animate={{ scaleX: hp / DUEL.hp }}
          transition={spring.soft}
        />
      </div>
    </div>
  );
}

function Fighter({
  side,
  look,
  frame,
  absent,
  controls,
  front,
  label,
}: {
  side: Side;
  look: Look;
  frame: string | null;
  absent: boolean;
  controls: AnimationControls;
  front: boolean;
  label: string;
}) {
  const place = side === "me" ? "bottom-2 left-0" : "right-0 top-2";
  return (
    <div className={`absolute ${place} ${front ? "z-10" : "z-0"}`}>
      {/* Ground shadow: the medallion stands on the paper. */}
      <span aria-hidden="true" className="absolute -bottom-2 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-line" />
      <motion.div role="img" aria-label={label} animate={controls} initial={absent ? pose.absent : pose.rest} className={absent ? "grayscale" : ""}>
        <Avatar emoji="" size="xl" look={look} frame={frame} />
      </motion.div>
      {absent ? (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-3 py-1 text-caption font-semibold text-ink-muted shadow-card">
          {fr.duels.result.forfeit}
        </span>
      ) : null}
    </div>
  );
}

// Where the effects land, in the stage box: centered on each medallion.
const SPOT: Record<Side, string> = { me: "left-0 bottom-2 h-40 w-40", them: "right-0 top-2 h-40 w-40" };

function Effects({ beat, index }: { beat: Beat; index: number }) {
  if (beat.type === "banner") {
    return (
      <div key={`banner-${index}`} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <motion.p
        className="whitespace-nowrap rounded-md bg-surface px-4 py-2 text-heading text-ink shadow-raised"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.96] }}
        transition={{ duration: BEAT_S.banner, times: [0, 0.2, 0.8, 1], ease: ease.out }}
      >
        {beat.round === 1 ? fr.duels.result.round1 : fr.duels.result.round2}
      </motion.p>
      </div>
    );
  }
  if (beat.type !== "step") return null;
  const { attacker, kind, damage } = beat.step;
  const defender: Side = attacker === "me" ? "them" : "me";
  if (kind === "miss") {
    return (
      <div key={`fx-${index}`} className={`pointer-events-none absolute z-20 flex items-start justify-center ${SPOT[attacker]}`}>
        <motion.span
          className="mt-2 rounded-full bg-surface px-3 py-1 text-body-strong text-ink-muted shadow-card"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -4, -8] }}
          transition={{ duration: BEAT_S.miss, times: [0, 0.25, 0.75, 1], ease: ease.out }}
        >
          {fr.duels.result.miss}
        </motion.span>
      </div>
    );
  }
  const big = kind === "critical";
  const delay = impactDelay(kind);
  return (
    <div key={`fx-${index}`} className={`pointer-events-none absolute z-20 flex items-center justify-center ${SPOT[defender]}`}>
      <motion.span
        className="absolute"
        initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.05], rotate: [-20, 0, 0, 0] }}
        transition={{ duration: big ? duration.celebrate : duration.slow + duration.base, times: [0, 0.2, 0.7, 1], delay, ease: ease.out }}
      >
        {big ? <Icon name="bolt" size={104} className="text-gold" fill="currentColor" strokeWidth={1.5} /> : <Slash big={false} />}
      </motion.span>
      {big ? (
        <motion.span
          className="absolute"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 1.3] }}
          transition={{ duration: duration.slow, delay, ease: ease.out }}
        >
          <Slash big />
        </motion.span>
      ) : null}
      <motion.span
        className={`absolute -top-2 tabular ${big ? "text-title text-gold-ink" : "text-heading text-primary"}`}
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, -6, -18, -30] }}
        transition={{ duration: duration.celebrate, times: [0, 0.2, 0.7, 1], delay, ease: ease.out }}
      >
        −{damage}
      </motion.span>
      {big ? (
        <motion.span
          className="absolute -bottom-3 whitespace-nowrap rounded-full bg-surface px-3 py-1 text-heading text-gold-ink shadow-raised"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.08, 1, 1] }}
          transition={{ duration: duration.celebrate, times: [0, 0.25, 0.8, 1], delay, ease: ease.out }}
        >
          {fr.duels.result.critical}
        </motion.span>
      ) : null}
    </div>
  );
}

function Stats({ mine, theirs, theirName }: { mine: ReplayStats | null; theirs: ReplayStats | null; theirName: string }) {
  const r = fr.duels.result;
  const cell = (s: ReplayStats | null, pick: (s: ReplayStats) => string) => (s ? pick(s) : r.absent);
  const rows: [string, (s: ReplayStats) => string][] = [
    [r.damage, (s) => String(s.damage)],
    [r.criticals, (s) => String(s.criticals)],
    [r.time, (s) => r.seconds(s.timeMs)],
  ];
  return (
    <table aria-label={r.statsLabel} className="w-full table-fixed text-left">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="w-[38%] py-2" aria-hidden="true" />
          <th scope="col" className="py-2 text-right text-caption text-ink-muted">{r.me}</th>
          <th scope="col" className="truncate py-2 text-right text-caption text-ink-muted">{theirName}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, pick]) => (
          <tr key={label} className="border-b border-line">
            <th scope="row" className="py-2.5 text-body text-ink-muted">{label}</th>
            <td className="tabular py-2.5 text-right text-body-strong text-ink">{cell(mine, pick)}</td>
            <td className="tabular py-2.5 text-right text-body-strong text-ink">{cell(theirs, pick)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Replay({ duel, myId, theirLook, theirFrame }: { duel: Duel; myId: string; theirLook: Look; theirFrame: string | null }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion() === true;
  const challenge = useChallenge();
  const equipped = useAppState((s) => s.wallet?.equipped);
  const myName = useAppState((s) => s.profile?.pseudo) ?? fr.duels.result.me;
  const myLook = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const theirName = duel.opponentPseudo;
  const them = otherId(duel, myId);
  const verdict = verdictOf(duel, myId);
  const steps = useMemo(() => duelReplay(duel.myRun, duel.theirRun, duel.challenger === myId), [duel, myId]);
  const beats = useMemo(() => (steps.length > 0 ? buildBeats(steps) : []), [steps]);
  const [beat, setBeat] = useState(() => (reduced || verdict === "cancelled" ? beats.length : 0));
  const done = beat >= beats.length;
  // The celebration (confetti) plays only the first time this device shows the result.
  const [firstView] = useState(() => !wasResultSeen(duel.id));
  useEffect(() => markResultSeen(duel.id), [duel.id]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The beat whose blow has landed: HP numbers and bars change on impact, not when the attacker sets off.
  const [landed, setLanded] = useState(-1);
  const meCtl = useAnimationControls();
  const themCtl = useAnimationControls();
  const stageCtl = useAnimationControls();
  const ctl = useCallback((side: Side) => (side === "me" ? meCtl : themCtl), [meCtl, themCtl]);

  const absentMe = duel.myRun === null;
  const absentThem = duel.status === "settled" && duel.theirRun === null;
  const loser: Side | null = verdict === "win" || verdict === "forfeitWin" ? "them" : verdict === "loss" || verdict === "forfeitLoss" ? "me" : null;
  const restPose = useCallback(
    (side: Side) => ((side === "me" ? absentMe : absentThem) ? pose.absent : loser === side && duel.myRun !== null && duel.theirRun !== null ? pose.bowed(side) : pose.rest),
    [absentMe, absentThem, loser, duel.myRun, duel.theirRun],
  );

  // HP shown: the last blow that has landed.
  const shown = useMemo(() => {
    const upTo = done ? beats.length - 1 : landed >= beat ? beat : beat - 1;
    for (let i = upTo; i >= 0; i--) {
      const b = beats[i];
      if (b?.type === "step") return { hpMe: b.step.hpMe, hpThem: b.step.hpThem };
    }
    return { hpMe: DUEL.hp, hpThem: DUEL.hp };
  }, [beat, beats, done, landed]);

  // Final poses when the replay ends, is skipped or never played; focus moves to the verdict (« Passer » is gone).
  useEffect(() => {
    if (!done) return;
    headingRef.current?.focus();
    meCtl.stop();
    themCtl.stop();
    stageCtl.stop();
    meCtl.set(restPose("me"));
    themCtl.set(restPose("them"));
    stageCtl.set({ x: 0 });
  }, [done, meCtl, themCtl, stageCtl, restPose]);

  useEffect(() => {
    if (done) return;
    const b = beats[beat];
    if (!b) return;
    if (b.type === "step") {
      const { attacker, kind } = b.step;
      const defender: Side = attacker === "me" ? "them" : "me";
      void lunge(ctl(attacker), attacker, kind);
      if (kind !== "miss") void recoil(ctl(defender), attacker, kind);
      if (kind === "critical") {
        void stageCtl.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: duration.slow, delay: impactDelay(kind) } });
      }
    } else if (b.type === "finale" && loser !== null && duel.myRun !== null && duel.theirRun !== null) {
      // The winner strikes the last blow, the loser bows like the defeated boss.
      const winner: Side = loser === "me" ? "them" : "me";
      void lunge(ctl(winner), winner, "hit");
      void ctl(loser).start({ ...pose.bowed(loser), transition: { ...spring.soft, delay: impactDelay("hit") } });
    } else if (b.type === "finale" && verdict === "draw") {
      // A draw: both heroes salute each other.
      for (const side of ["me", "them"] as const) {
        void ctl(side).start({
          y: [0, 6, 6, 0],
          rotate: [0, side === "me" ? 10 : -10, side === "me" ? 10 : -10, 0],
          transition: { duration: duration.celebrate, times: [0, 0.3, 0.7, 1], ease: ease.inOut },
        });
      }
    }
    const kindLen = b.type === "step" ? BEAT_S[b.step.kind] : BEAT_S[b.type];
    const timers = [window.setTimeout(() => setBeat((n) => n + 1), Math.round(kindLen * 1000))];
    if (b.type === "step") timers.push(window.setTimeout(() => setLanded(beat), Math.round(impactDelay(b.step.kind) * 1000)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [beat, beats, done, ctl, stageCtl, loser, verdict, duel.myRun, duel.theirRun]);

  const current = beats[beat];
  const front: Side = current?.type === "step" ? current.step.attacker : loser === "me" ? "them" : "me";
  const reward = duel.myRun?.reward ?? 0;
  const won = verdict === "win" || verdict === "forfeitWin";
  const h = fr.duels.result.headline;
  const headline = verdict === "loss" ? h.loss(theirName) : h[verdict];
  const announce = done
    ? fr.duels.result.verdictAnnounce(headline, reward)
    : current?.type === "step"
      ? fr.duels.result.blow(current.step.attacker === "me" ? myName : theirName, current.step.kind, current.step.damage)
      : current?.type === "banner"
        ? current.round === 1
          ? fr.duels.result.round1
          : fr.duels.result.round2
        : "";
  const mine = replayStats(duel.myRun);
  const theirs = replayStats(duel.theirRun);
  const tied = mine !== null && theirs !== null && mine.damage === theirs.damage && verdict !== "draw";

  return (
    <div className="pb-10">
      <FocusHeader
        onClose={() => navigate(DUELS_HOME, { replace: true })}
        closeLabel={fr.duels.result.backAria}
        {...(done ? {} : { progress: beats.length > 0 ? beat / beats.length : 0 })}
        right={
          done ? undefined : (
            <Button variant="ghost" onClick={() => setBeat(beats.length)}>
              {fr.duels.result.skip}
            </Button>
          )
        }
      />

      {/* The stage keeps its 320 px geometry; under 360 px viewports it is scaled down as a whole. */}
      <div className="flex justify-center px-5 max-[359px]:-mb-14">
        {/* Scaled on a static wrapper: the stage's own transform belongs to its shake. */}
        <div className="w-80 shrink-0 origin-top max-[359px]:scale-[0.85]">
        <motion.div
          animate={stageCtl}
          role="group"
          aria-label={fr.duels.result.stage(myName, theirName)}
          className="relative mt-2 h-[23rem] w-80"
        >
          <HpPlate name={theirName} hp={shown.hpThem} absent={absentThem} className="left-0 top-6" />
          <HpPlate name={myName} hp={shown.hpMe} absent={absentMe} className="bottom-6 right-0" />
          <Fighter side="them" look={theirLook} frame={theirFrame} absent={absentThem} controls={themCtl} front={front === "them"} label={theirName} />
          <Fighter side="me" look={myLook} frame={equipped?.frame ?? null} absent={absentMe} controls={meCtl} front={front === "me"} label={myName} />
          {current && !done ? <Effects beat={current} index={beat} /> : null}
        </motion.div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {done ? (
        <motion.section
          aria-labelledby="duel-verdict"
          className="relative flex flex-col gap-6 px-5 pt-6"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
        >
          <Confetti fire={won && firstView} />
          <header className="flex flex-col items-center gap-2 text-center">
            <h1 id="duel-verdict" ref={headingRef} tabIndex={-1} className="text-title text-ink outline-none">{headline}</h1>
            <p className="max-w-xs text-body text-ink-muted">{verdict === "cancelled" ? fr.duels.result.sub.cancelled : fr.duels.result.sub[verdict](theirName)}</p>
            {reward > 0 ? (
              <motion.p
                className="mt-1 flex items-center gap-1.5 text-heading text-gold-ink tabular"
                initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring.bouncy, delay: duration.base }}
              >
                <Icon name="medal" size={24} />
                <span aria-hidden="true">{fr.duels.result.reward(reward)}</span>
                <span className="sr-only">{`${fr.duels.result.rewardLabel} : ${reward}`}</span>
              </motion.p>
            ) : null}
          </header>

          {verdict !== "cancelled" ? (
            <div className="flex flex-col gap-2">
              <Stats mine={mine} theirs={theirs} theirName={theirName} />
              {tied ? <p className="text-caption text-ink-muted">{fr.duels.result.tieBreak}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth loading={challenge.busy} disabled={challenge.unlocked === false} onClick={() => void challenge.start(them)}>
              <Icon name="swords" size={22} />
              {fr.duels.result.rematch}
            </Button>
            {challenge.message ? (
              <p role="alert" className="rounded-md bg-surface-2 p-3 text-body text-ink">{challenge.message}</p>
            ) : null}
            <Button variant="secondary" fullWidth onClick={() => navigate(DUELS_HOME, { replace: true })}>
              {fr.duels.result.back}
            </Button>
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}

function Waiting({ duel, theirLook, theirFrame }: { duel: Duel; theirLook: Look; theirFrame: string | null }) {
  const navigate = useNavigate();
  const equipped = useAppState((s) => s.wallet?.equipped);
  const myLook = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const w = fr.duels.result.waiting;
  return (
    <div className="pb-10">
      <FocusHeader onClose={() => navigate(DUELS_HOME, { replace: true })} closeLabel={fr.duels.result.backAria} />
      <div className="flex items-end justify-center gap-4 px-5 pt-4" aria-hidden="true">
        <Avatar emoji="" size="lg" look={myLook} frame={equipped?.frame ?? null} />
        <Icon name="swords" size={28} className="mb-6 text-ink-muted" />
        <span className="opacity-50 grayscale">
          <Avatar emoji="" size="lg" look={theirLook} frame={theirFrame} />
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 px-5 pt-6 text-center">
        <h1 className="text-title text-ink">{w.title(duel.opponentPseudo)}</h1>
        <p className="max-w-xs text-body text-ink-muted">{w.body(duel.opponentPseudo)}</p>
        {duel.myRun ? <p className="tabular text-body-strong text-ink">{w.yours(duel.myRun.damage)}</p> : null}
      </div>
      <div className="px-5 pt-8">
        <Button size="lg" fullWidth onClick={() => navigate(DUELS_HOME, { replace: true })}>
          {fr.duels.result.back}
        </Button>
      </div>
    </div>
  );
}

export function DuelResultScreen() {
  const { id = "" } = useParams();
  const { duels, leaderboard, activity } = useServices();
  const refresh = useRefreshProgress();
  const navigate = useNavigate();
  const myId = useAppState((s) => s.session?.userId) ?? "";
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const claimedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    void (async () => {
      try {
        const duel = (await duels.list()).find((d) => d.id === id);
        if (cancelled) return;
        if (!duel) return setLoad({ status: "notFound" });
        if (duel.status === "open" && duel.myRun === null) return setLoad({ status: "toPlay" });
        if (duel.status !== "open" && claimedFor.current !== duel.id) {
          // Opening a settled duel pays its Kim bài if the hub has not yet, so the bilan matches the balance.
          // A failed claim is retried on the next load (the wallet counts each duel once anyway).
          claimedFor.current = duel.id;
          void activity
            .claimSettledDuels([duel])
            .then((added) => (added > 0 ? refresh() : undefined))
            .catch(() => {
              if (claimedFor.current === duel.id) claimedFor.current = null;
            });
        }
        const profile = await leaderboard.getPublicProfile(otherId(duel, myId)).catch(() => null);
        if (!cancelled) setLoad({ status: "ready", duel, theirLook: profile?.look ?? {}, theirFrame: profile?.frame ?? null });
      } catch (e) {
        if (!cancelled) setLoad({ status: e instanceof OfflineError ? "offline" : "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duels, leaderboard, activity, refresh, id, myId, attempt]);

  const back = () => navigate(DUELS_HOME, { replace: true });

  if (load.status === "toPlay") return <Navigate to={`/duel/${id}/run`} replace />;
  if (load.status === "loading") {
    return (
      <div className="px-5 pt-6" role="status" aria-label={fr.duels.result.loading}>
        <Skeleton lines={4} />
      </div>
    );
  }
  if (load.status === "notFound") {
    return (
      <EmptyState
        title={fr.duels.run.notFound.title}
        body={fr.duels.run.notFound.body}
        illustration="lantern"
        action={<Button onClick={back}>{fr.duels.result.back}</Button>}
      />
    );
  }
  if (load.status === "offline" || load.status === "error") {
    const text = load.status === "offline" ? fr.duels.result.offline : fr.duels.result.error;
    return (
      <EmptyState
        title={text.title}
        body={text.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={back}>{fr.duels.result.back}</Button>
          </div>
        }
      />
    );
  }
  const { duel, theirLook, theirFrame } = load;
  if (duel.status === "open") return <Waiting duel={duel} theirLook={theirLook} theirFrame={theirFrame} />;
  return <Replay key={duel.id} duel={duel} myId={myId} theirLook={theirLook} theirFrame={theirFrame} />;
}
