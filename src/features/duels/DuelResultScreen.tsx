import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useChallenge } from "@/app/useChallenge";
import { OfflineError } from "@/domain/errors";
import type { Duel, Look } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { useHeroLook } from "@/app/useHeroLook";
import { useBlowCue } from "@/app/useBlowCue";
import type { SoundCue } from "@/domain/sound";
import { DUEL } from "@/services/duel";
import { Avatar, Button, Confetti, duration, EmptyState, ease, FocusHeader, frameRing, Icon, Skeleton, spring } from "@/ui";
import type { Expression } from "@/ui/characterLayers";
import {
  CritGlint,
  DamageNumber,
  FighterSprite,
  FightSeal,
  InkImpact,
  MissMark,
  useFightBeat,
  useFighterControls,
  type FighterControls,
  type FighterPose,
  type Vec,
} from "@/ui/fight";
import { duelReplay, replaySchedule, replayStats, verdictOf, type ReplayBeat, type ReplayStats } from "@/features/duels/duelReplay";
import { markResultSeen, wasResultSeen } from "@/app/usePendingDuels";
import { otherId } from "@/features/duels/duelsView";

// Hero: the two equipped heroes face to face on their paper medallions (mine bottom-left, theirs top-right, like a
// fight-game stage), then the headline of the bilan. One primary action: « Revanche ». The replay is a shonen exchange
// in the Đông Hồ print style (shared fight kit, `@/ui/fight`): wind-up, strike, a held hit-stop, recoil, an ink slash.
// Only the characters move; the medallions stay on the ground. transform/opacity only, positions from constants.
// « Passer » or reduced motion jump straight to the final poses and the bilan.

const DUELS_HOME = "/duels";

type Side = "me" | "them";

type Load =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "error" }
  | { status: "notFound" }
  | { status: "toPlay" }
  | { status: "ready"; duel: Duel; theirLook: Look; theirFrame: string | null };

// Stage geometry (px), 320 × 304: the medallions sit in opposite corners, the fighters stand on them.
const MAT = 160;
const SPRITE = 104; // fighter width; height 4/3
const MAT_AT: Record<Side, { left: number; top: number }> = { me: { left: 0, top: 144 }, them: { left: 160, top: 0 } };
const SPRITE_TOP = MAT - 5 - (SPRITE * 4) / 3; // standing on the medallion, 3 % above its bottom edge
/** Centre of each fighter's body: where the blows land. */
const BODY: Record<Side, Vec> = {
  me: { x: MAT_AT.me.left + MAT / 2, y: MAT_AT.me.top + SPRITE_TOP + (SPRITE * 2) / 3 },
  them: { x: MAT_AT.them.left + MAT / 2, y: MAT_AT.them.top + SPRITE_TOP + (SPRITE * 2) / 3 },
};
const other = (side: Side): Side => (side === "me" ? "them" : "me");
/** From the attacker to the defender. */
const TOWARD: Record<Side, Vec> = {
  me: { x: BODY.them.x - BODY.me.x, y: BODY.them.y - BODY.me.y },
  them: { x: BODY.me.x - BODY.them.x, y: BODY.me.y - BODY.them.y },
};
const FACING: Record<Side, 1 | -1> = { me: 1, them: -1 };
/** A miss cuts the air beside the defender, off the line of the blow. */
const BESIDE = 40;
const besideOf = (attacker: Side): Vec => {
  const t = TOWARD[attacker];
  const n = Math.hypot(t.x, t.y);
  const d = BODY[other(attacker)];
  return { x: d.x + (t.y / n) * BESIDE, y: d.y - (t.x / n) * BESIDE };
};
const at = (p: Vec, dx = 0, dy = 0) => ({ left: p.x + dx, top: p.y + dy });
const REST = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 } as const;

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

type FighterProps = {
  side: Side;
  look: Look;
  frame: string | null;
  absent: boolean;
  controls: FighterControls;
  expression: Expression;
  pose: FighterPose;
  front: boolean;
  live: boolean;
  label: string;
};

/** The medallion stays on the ground like a mat; only the fighter standing on it moves. */
function Fighter({ side, look, frame, absent, controls, expression, pose, front, live, label }: FighterProps) {
  const mat = MAT_AT[side];
  return (
    <div role="img" aria-label={label} className={`absolute h-40 w-40 ${front ? "z-20" : "z-10"}`} style={{ left: mat.left, top: mat.top }}>
      <div className={absent ? "opacity-50 grayscale" : ""}>
        <span aria-hidden="true" className={`absolute inset-0 rounded-full bg-paper ${frameRing(frame)}`} />
        <span className="absolute" style={{ left: (MAT - SPRITE) / 2, top: SPRITE_TOP }}>
          <FighterSprite look={look} facing={FACING[side]} expression={expression} size={SPRITE} controls={controls} pose={pose} live={live} />
        </span>
      </div>
      {absent ? (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-3 py-1 text-caption font-semibold text-ink-muted shadow-card">
          {fr.duels.result.forfeit}
        </span>
      ) : null}
    </div>
  );
}

/** When each beat's contact happens (seconds), and the index of the next beat that has one. From the schedule only. */
function contactPlan(beats: readonly ReplayBeat[]): { at: (number | null)[]; next: (number | null)[] } {
  const at = beats.map((b) => (b.type === "blow" || b.type === "misses" || b.type === "flurry" ? b.start + b.impact : null));
  const next = beats.map((_, j) => {
    for (let k = j + 1; k < beats.length; k++) if (at[k] !== null) return k;
    return null;
  });
  return { at, next };
}

/**
 * The fight FX on stage: one flat list keyed by beat and role, so a node never remounts when its beat ends (a damage
 * number keeps floating through the next beat instead of popping twice). Lifetimes come from the schedule:
 * - ink, seals, glint: their own beat only, fading out by its end;
 * - the damage number: from its contact to the next contact (≤ `FIGHT.number`), faded by then, so at most 8 elements
 *   animate around a contact (2 fighters, a flash, the stage, an HP bar, ink, number, seal);
 * - « Raté »: from its contact until the first beat that starts `duration.celebrate` later, whatever the tempo (idle
 *   while it holds), then it fades out over `FIGHT.strike`, gone before that beat's contact.
 */
function fightFx(beats: readonly ReplayBeat[], beat: number, landed: number, plan: ReturnType<typeof contactPlan>): ReactNode[] {
  const r = fr.duels.result;
  const items: ReactNode[] = [];
  const layer = (j: number, key: string, child: ReactNode) =>
    items.push(
      <div key={`${key}-${j}`} data-fx-beat={j} className="pointer-events-none absolute inset-0 z-30">
        {child}
      </div>,
    );
  const place = (p: Vec, child: ReactNode) => (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={at(p)}>
      {child}
    </div>
  );
  for (let j = 0; j <= beat && j < beats.length; j++) {
    const b = beats[j];
    if (!b) continue;
    const own = j === beat;
    const hit = landed >= j;
    const contact = plan.at[j] ?? 0;
    const left = b.start + b.length - contact; // time from the contact to the end of the beat
    if (b.type === "banner" && own) {
      layer(
        j,
        "banner",
        <div className="flex h-full items-center justify-center">
          <motion.p
            className="whitespace-nowrap rounded-md bg-surface px-4 py-2 text-heading text-ink shadow-raised"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.96] }}
            transition={{ duration: b.length, times: [0, 0.2, 0.8, 1], ease: ease.out }}
          >
            {b.round === 1 ? r.round1 : r.round2}
          </motion.p>
        </div>,
      );
    }
    if ((b.type === "misses" || b.type === "flurry") && hit) {
      // Readable long enough: until the first beat starting `celebrate` after the contact (or the end).
      let leaveAt = beats.length;
      for (let k = j + 1; k < beats.length; k++) {
        if ((beats[k]?.start ?? 0) >= contact + duration.celebrate) {
          leaveAt = k;
          break;
        }
      }
      // Fading out at the start of that beat, gone by its own contact (the fade is shorter than any wind-up).
      const leaveContact = plan.at[leaveAt] ?? null;
      if (beat < leaveAt || (beat === leaveAt && !(leaveContact !== null && landed >= leaveAt))) {
        const leaving = beat === leaveAt;
        if (b.type === "flurry") {
          layer(j, "flurry", <div className="flex h-full items-center justify-center"><MissMark leaving={leaving}>{r.flurry(b.steps.length)}</MissMark></div>);
        } else {
          for (const m of b.misses) {
            if (own) layer(j, `miss-ink-${m.attacker}`, <InkImpact kind="miss" {...besideOf(m.attacker)} dir={TOWARD[m.attacker]} tempo={b.tempo} life={left} />);
            // Just under the attacker's medallion, on the page: the previous blow's number may still float above its head.
            layer(j, `miss-mark-${m.attacker}`, place({ x: BODY[m.attacker].x, y: MAT_AT[m.attacker].top + MAT + 16 }, <MissMark leaving={leaving}>{r.misses(m.count)}</MissMark>));
          }
        }
      }
    }
    if (b.type !== "blow") continue;
    const { attacker, kind, damage } = b.step;
    const defender = other(attacker);
    const crit = kind === "critical";
    const t = TOWARD[attacker];
    const n = Math.hypot(t.x, t.y);
    if (own && crit && !hit) layer(j, "glint", place({ x: BODY[attacker].x + (t.x / n) * 34, y: BODY[attacker].y + (t.y / n) * 34 }, <CritGlint tempo={b.tempo} />));
    if (!hit) continue;
    const nextContact = plan.next[j] ?? null;
    if (nextContact === null || landed < nextContact) {
      const until = nextContact === null ? Infinity : (plan.at[nextContact] ?? Infinity) - contact;
      layer(j, "dmg", place({ x: BODY[defender].x, y: BODY[defender].y - 86 }, <DamageNumber value={damage} critical={crit} tempo={b.tempo} life={until} />));
    }
    if (!own) continue;
    layer(j, "ink", <InkImpact kind={b.ko ? "ko" : crit ? "crit" : "hit"} {...BODY[defender]} dir={t} tempo={b.tempo} life={left} />);
    if (b.ko) layer(j, "ko", place({ x: BODY[defender].x, y: BODY[defender].y + 30 }, <FightSeal big life={left}>{r.ko}</FightSeal>));
    else if (crit) layer(j, "seal", place({ x: BODY[defender].x, y: BODY[defender].y + 40 }, <FightSeal lang="vi" life={left}>{r.critSeal}</FightSeal>));
  }
  return items;
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
  const { sound } = useServices();
  const reduced = useReducedMotion() === true;
  const challenge = useChallenge();
  const equipped = useAppState((s) => s.wallet?.equipped);
  const myName = useAppState((s) => s.profile?.pseudo) ?? fr.duels.result.me;
  const myLook = useHeroLook();
  const theirName = duel.opponentPseudo;
  const them = otherId(duel, myId);
  const verdict = verdictOf(duel, myId);
  const steps = useMemo(() => duelReplay(duel.myRun, duel.theirRun, duel.challenger === myId), [duel, myId]);
  const beats = useMemo(() => replaySchedule(steps).beats, [steps]);
  const [beat, setBeat] = useState(() => (reduced || verdict === "cancelled" ? beats.length : 0));
  const done = beat >= beats.length;
  // The celebration (confetti) plays only the first time this device shows the result.
  const [firstView] = useState(() => !wasResultSeen(duel.id));
  useEffect(() => markResultSeen(duel.id), [duel.id]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The beat whose blow has landed: HP, faces and contact FX change on impact, not when the attacker sets off.
  const [landed, setLanded] = useState(-1);
  const meCtl = useFighterControls();
  const themCtl = useFighterControls();
  const stageCtl = useAnimationControls();
  const ctl = useCallback((side: Side) => (side === "me" ? meCtl : themCtl), [meCtl, themCtl]);
  const fight = useFightBeat();
  /** When the replay's time 0 was (ms since epoch), set by the first beat. */
  const clock = useRef<number | null>(null);
  // Each fighter strikes with the sound of its own gear. Read from a ref by the beat timers: the catalogue loading
  // later must not restart the beat.
  const myBlow = useBlowCue(myLook);
  const theirBlow = useBlowCue(theirLook);
  const blowOf = useRef<Record<Side, SoundCue>>({ me: myBlow, them: theirBlow });
  blowOf.current = { me: myBlow, them: theirBlow };

  const absentMe = duel.myRun === null;
  const absentThem = duel.status === "settled" && duel.theirRun === null;
  const bothPlayed = duel.myRun !== null && duel.theirRun !== null;
  const loser: Side | null = verdict === "win" || verdict === "forfeitWin" ? "them" : verdict === "loss" || verdict === "forfeitLoss" ? "me" : null;
  const winner: Side | null = loser === null ? null : other(loser);

  // HP shown: the last blow that has landed.
  const shown = useMemo(() => {
    const upTo = done ? beats.length - 1 : landed >= beat ? beat : beat - 1;
    for (let i = upTo; i >= 0; i--) {
      const b = beats[i];
      if (b?.type === "blow") return { hpMe: b.step.hpMe, hpThem: b.step.hpThem };
      const last = b?.type === "flurry" ? b.steps.at(-1) : undefined;
      if (last) return { hpMe: last.hpMe, hpThem: last.hpThem };
    }
    return { hpMe: DUEL.hp, hpThem: DUEL.hp };
  }, [beat, beats, done, landed]);

  const current = beats[beat];
  const finale = done || current?.type === "finale";
  const poseOf = (side: Side): FighterPose =>
    !finale || !bothPlayed || verdict === "cancelled" ? "stand" : verdict === "draw" ? "salute" : loser === side ? "bow" : "stand";
  const expressionOf = (side: Side): Expression => {
    if (finale) return poseOf(side) === "stand" ? "idle" : "ko";
    if ((side === "me" ? shown.hpMe : shown.hpThem) === 0) return "hurt";
    return current?.type === "blow" && landed === beat && other(current.step.attacker) === side ? "hurt" : "idle";
  };

  // Final poses when the replay ends, is skipped or never played; focus moves to the verdict (« Passer » is gone).
  useEffect(() => {
    if (!done) return;
    headingRef.current?.focus();
    sound.stopAll(); // a blow still ringing when « Passer » is pressed ends with the fight
    for (const c of [meCtl, themCtl]) {
      c.body.stop();
      c.flash.stop();
      c.body.set(REST);
      c.flash.set({ opacity: 0 });
    }
    stageCtl.stop();
    stageCtl.set({ x: 0 });
  }, [done, meCtl, themCtl, stageCtl, sound]);

  // The verdict: a short fanfare or a sober pluck, then the Kim bài clink as the reward pops in (spec sound-and-reveal §4.3).
  const won = verdict === "win" || verdict === "forfeitWin";
  const lost = verdict === "loss" || verdict === "forfeitLoss";
  const reward = duel.myRun?.reward ?? 0;
  useEffect(() => {
    if (!done) return;
    if (won) sound.play("arena.victory");
    else if (lost) sound.play("arena.defeat");
    if (reward <= 0) return;
    const coins = window.setTimeout(() => sound.play("arena.coins"), Math.round(duration.base * 1000));
    return () => window.clearTimeout(coins);
  }, [done, won, lost, reward, sound]);
  // Leaving mid-fight leaves nothing ringing.
  useEffect(() => () => sound.stopAll(), [sound]);

  /** On contact: the attacker's gear (louder for a critical), « hurt » when it lands on me, air for a miss. */
  const contactSound = useCallback(
    (b: ReplayBeat) => {
      const strike = (attacker: Side, strong: boolean) => {
        sound.play(blowOf.current[attacker], { strong });
        if (attacker === "them") sound.play("fight.hurt");
      };
      if (b.type === "blow") strike(b.step.attacker, b.step.kind === "critical");
      else if (b.type === "misses") sound.play("fight.miss");
      else if (b.type === "flurry") for (const a of new Set(b.steps.filter((s) => s.kind !== "miss").map((s) => s.attacker))) strike(a, false);
    },
    [sound],
  );

  useEffect(() => {
    if (done) return;
    const b = beats[beat];
    if (!b) return;
    if (b.type === "blow") {
      const { attacker, kind } = b.step;
      fight.blow({
        kind: kind === "critical" ? "crit" : "hit",
        ko: b.ko,
        tempo: b.tempo,
        attacker: ctl(attacker),
        defender: ctl(other(attacker)),
        stage: stageCtl,
        reach: TOWARD[attacker],
      });
    } else if (b.type === "misses") {
      const solo = b.misses.length === 1 ? b.misses[0] : undefined;
      fight.miss({
        tempo: b.tempo,
        attackers: b.misses.map((m) => ({ controls: ctl(m.attacker), reach: TOWARD[m.attacker] })),
        ...(solo ? { dodgers: [{ controls: ctl(other(solo.attacker)), reach: TOWARD[solo.attacker] }] } : {}),
      });
    } else if (b.type === "finale" && winner !== null && !fight.reduced) {
      // The winner hops twice while the loser bows.
      void ctl(winner).body.start({
        y: [0, -10, 0, -10, 0],
        // Delay + hops = the finale (`celebrate`), so the verdict never cuts a hop in the air.
        transition: { duration: duration.celebrate - duration.base, delay: duration.base, times: [0, 0.25, 0.5, 0.75, 1], ease: ease.out },
      });
    }
    // Timers aim at the schedule's absolute times, so render latency never piles up over the fight.
    const now = Date.now();
    if (clock.current === null) {
      clock.current = now - b.start * 1000;
      sound.play("arena.start"); // the gong opens the fight
    }
    const wait = (at: number) => Math.max(0, Math.round(clock.current === null ? 0 : clock.current + at * 1000 - now));
    const timers = [window.setTimeout(() => setBeat((n) => n + 1), wait(b.start + b.length))];
    if (b.type === "blow" || b.type === "misses" || b.type === "flurry") {
      timers.push(
        window.setTimeout(() => {
          setLanded(beat);
          contactSound(b);
        }, wait(b.start + b.impact)),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [beat, beats, done, ctl, stageCtl, fight, winner, contactSound, sound]);

  const front: Side = current?.type === "blow" ? current.step.attacker : winner ?? "me";
  const h = fr.duels.result.headline;
  const headline = verdict === "loss" ? h.loss(theirName) : h[verdict];
  const nameOf = (side: Side) => (side === "me" ? myName : theirName);
  const announce = done
    ? fr.duels.result.verdictAnnounce(headline, reward)
    : current?.type === "blow"
      ? fr.duels.result.blow(nameOf(current.step.attacker), current.step.kind, current.step.damage)
      : current?.type === "misses"
        ? current.misses.map((m) => fr.duels.result.missed(nameOf(m.attacker), m.count)).join(". ")
        : current?.type === "flurry"
          ? fr.duels.result.flurryAnnounce(current.steps.length)
          : current?.type === "banner"
            ? current.round === 1
              ? fr.duels.result.round1
              : fr.duels.result.round2
            : "";
  const mine = replayStats(duel.myRun);
  const theirs = replayStats(duel.theirRun);
  const tied = mine !== null && theirs !== null && mine.damage === theirs.damage && verdict !== "draw";
  const plan = useMemo(() => contactPlan(beats), [beats]);

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
      <div className="flex justify-center px-5 max-[359px]:-mb-11">
        {/* Scaled on a static wrapper: the stage's own transform belongs to its shake. */}
        <div className="w-80 shrink-0 origin-top max-[359px]:scale-[0.85]">
          <motion.div
            animate={stageCtl}
            role="group"
            aria-label={fr.duels.result.stage(myName, theirName)}
            className={`relative mt-1 h-[19rem] w-80 ${done ? "" : "will-change-transform"}`}
          >
            <HpPlate name={theirName} hp={shown.hpThem} absent={absentThem} className="left-0 top-6" />
            <HpPlate name={myName} hp={shown.hpMe} absent={absentMe} className="bottom-6 right-0" />
            {/* The stage veils itself for the finale: the plates go quiet, the fighters stay lit. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2 z-[5] rounded-lg bg-scrim"
              initial={false}
              animate={{ opacity: current?.type === "finale" ? 1 : 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
            />
            {(["them", "me"] as const).map((side) => (
              <Fighter
                key={side}
                side={side}
                look={side === "me" ? myLook : theirLook}
                frame={side === "me" ? (equipped?.frame ?? null) : theirFrame}
                absent={side === "me" ? absentMe : absentThem}
                controls={ctl(side)}
                expression={expressionOf(side)}
                pose={poseOf(side)}
                front={front === side}
                live={!done}
                label={nameOf(side)}
              />
            ))}
            {done ? null : fightFx(beats, beat, landed, plan)}
          </motion.div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {done ? (
        <motion.section
          aria-labelledby="duel-verdict"
          className="relative flex flex-col gap-6 px-5 pt-4"
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
                <span className="sr-only">{`${fr.duels.result.rewardLabel}\u202f: ${reward}`}</span>
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
  const myLook = useHeroLook();
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
