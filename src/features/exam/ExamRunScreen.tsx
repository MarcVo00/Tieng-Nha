import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, type AnimationControls } from "motion/react";
import { Navigate, useNavigate } from "react-router-dom";
import { useEntryState } from "@/app/useEntryState";
import { useRefreshProgress, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Boss, Capabilities, ExamQuestion, Look, VocabId, VocabItem } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import type { GradeResult } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { answer, bossMention, buildDeck, fightScore, outOfQuestions, startFight, type Fight } from "@/services/bossFight";
import { FINAL_BOSS_ID } from "@/services/tree";
import { seedFromString } from "@/services/random";
import { useHeroLook } from "@/app/useHeroLook";
import { Button, ConfirmDialog, duration, ease, EmptyState, FocusHeader, Hearts, Motif, Skeleton, spring, tap, WaterDropHp } from "@/ui";
import {
  DamageNumber,
  FIGHT,
  FighterSprite,
  FightSeal,
  InkImpact,
  useFightBeat,
  useFighterControls,
  type FighterControls,
  type FighterPose,
  type Vec,
} from "@/ui/fight";
import type { Expression } from "@/ui/characterLayers";
import { BossSprite } from "@/features/exam/BossPortrait";
import {
  clearAttemptMark,
  INTERRUPTED_STATE,
  isRunState,
  markAttempt,
  readAttemptMark,
  type QuestionOutcome,
  type ResultState,
  type RunState,
} from "@/features/exam/examState";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; deck: ExamQuestion[]; boss: Boss; vocabIndex: ReadonlyMap<VocabId, VocabItem> };


// The stage is a fixed 320 px ring (centred): positions are constants, never measured during a beat (audit §C.3).
const HERO = 64; // px wide, 4:3
const BOSS = 96; // px, square art
/** From the hero's resting place to the boss's (centres, px): the hero rushes 30 % of it. */
const REACH: Vec = { x: 224, y: 0 };
/** The boss's wave rolls from its side to the hero's (px, negative: leftwards). */
const WAVE_TRAVEL = -112;
/** The wave starts just left of the boss (48 px wide, in the 320 px ring). */
const WAVE_LEFT = 320 - 4 - BOSS - 48;

/** Where the K.-O. ink lands, in the boss box (px): beside his feet, on the medallion edge. */
const KO_INK = { x: -28, y: BOSS - 18 } as const;

type Fx = { id: number; kind: "ink" | "ko" | "dmg" | "wave"; life: number };

type StageProps = {
  boss: Boss;
  defeated: boolean;
  look: Look;
  heroFace: Expression;
  bossFace: Expression;
  bossPose: FighterPose;
  veiled: boolean;
  fx: readonly Fx[];
  hero: FighterControls;
  bossCtl: FighterControls;
  stage: AnimationControls;
  reduced: boolean;
  live: boolean;
};

/**
 * The fight strip (audit §C.2): the player's hero on the left facing Thủy Tinh on the right, each on a paper mat, a
 * calm wave motif behind. FX are mounted for their beat and unmounted by the caller (≤ 30 nodes).
 */
function FightStage({ boss, defeated, look, heroFace, bossFace, bossPose, veiled, fx, hero, bossCtl, stage, reduced, live }: StageProps) {
  return (
    <div role="group" aria-label={fr.exam.run.stage(boss.name)} className="relative mx-5 h-28 max-[359px]:h-24">
      {/* Backdrop clipped to the strip; the fighters and their FX may spill over its edge. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-lg bg-surface-2">
        <div className="absolute inset-0 text-info">
          <Motif kind="waves" />
        </div>
        <motion.div data-veil={veiled ? "on" : "off"} className="absolute inset-0 bg-scrim" initial={false} animate={{ opacity: veiled ? 1 : 0 }} transition={{ duration: duration.base }} />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-80 origin-top -translate-x-1/2 max-[359px]:scale-[0.85]">
      <motion.div className={`relative h-full w-full ${live ? "will-change-transform" : ""}`} animate={stage}>
        {/* Paper medallions stay put like mats (giấy điệp): only the fighters move. */}
        <span aria-hidden="true" className="absolute bottom-2 left-1.5 h-[4.75rem] w-[4.75rem] rounded-full border-2 border-line bg-paper" />
        <span aria-hidden="true" className="absolute bottom-1 right-0.5 h-[6.25rem] w-[6.25rem] rounded-full border-2 border-line bg-paper" />
        <div role="img" aria-label={fr.exam.run.hero} data-fighter="hero" className="absolute bottom-2.5 left-3 z-10">
          <FighterSprite look={look} facing={1} expression={heroFace} size={HERO} controls={hero} live={live} />
        </div>
        <div role="img" aria-label={fr.exam.boss.aria(boss.name, boss.title, defeated)} className="absolute bottom-2 right-1 z-10">
          <BossSprite illustration={boss.illustration} size={BOSS} facing={-1} expression={bossFace} pose={bossPose} controls={bossCtl} live={live} />
        </div>
        {/* The player's win, stamped over the strip between the fighters, never on the bowing boss. */}
        {fx.map((f) =>
          f.kind === "ko" ? (
            <span key={f.id} aria-hidden="true" className="pointer-events-none absolute left-[10.25rem] top-1 z-30 -translate-x-1/2">
              <FightSeal big lang="vi" life={f.life} reduced={reduced}>
                {fr.exam.run.win}
              </FightSeal>
            </span>
          ) : null,
        )}
        {/* FX layer anchored on the boss box: impact, damage number. */}
        <div aria-hidden="true" data-fx-layer="boss" className="pointer-events-none absolute bottom-2 right-1 z-20 h-24 w-24">
          {fx.map((f) =>
            f.kind === "ink" ? (
              <InkImpact key={f.id} kind="hit" x={BOSS / 2} y={BOSS / 2 - 4} life={f.life} reduced={reduced} />
            ) : f.kind === "ko" ? (
              // The last blow splashes beside him, at the edge of his medallion: no slash across a legend's face.
              <InkImpact key={f.id} kind="ko" x={KO_INK.x} y={KO_INK.y} life={f.life} reduced={reduced} />
            ) : f.kind === "dmg" ? (
              <span key={f.id} className="absolute left-1/2 top-0 -translate-x-1/2">
                <DamageNumber value={1} critical={false} life={f.life} reduced={reduced} />
              </span>
            ) : null,
          )}
        </div>
        {fx.some((f) => f.kind === "wave") ? (
          <motion.svg
            key={fx.find((f) => f.kind === "wave")?.id}
            data-fx="wave"
            aria-hidden="true"
            viewBox="0 0 48 24"
            width={48}
            height={24}
            className="pointer-events-none absolute bottom-8 z-20 text-info"
            style={{ left: WAVE_LEFT }}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: WAVE_TRAVEL, opacity: [0, 1, 1, 0] }}
            transition={{ duration: duration.base, ease: ease.in, opacity: { duration: duration.base, times: [0, 0.2, 0.8, 1] } }}
          >
            <path d="M0 18c6-12 18-12 24 0s18 12 24 0M0 6c6-12 18-12 24 0s18 12 24 0" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </motion.svg>
        ) : null}
      </motion.div>
      </div>
    </div>
  );
}

// Hierarchy: the fight stage (hero vs boss, water-drop HP) is the hero, the current exercise is the one action, lives sit in the header.
function ExamRun({ run }: { run: RunState }) {
  const { content, exam, activity, clock, tts, stt, recorder } = useServices();
  const { settings } = useSettings();
  const refreshProgress = useRefreshProgress();
  const navigate = useNavigate();

  const capabilities: Capabilities = settings.capabilities ?? { tts: tts.isAvailable(), stt: false, recorder: false };
  const hasStt = useRef(settings.capabilities?.stt ?? false); // fixed for the run: the deck depends on it

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [fight, setFight] = useState<Fight | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [quitting, setQuitting] = useState(false);

  const look = useHeroLook();
  const beat = useFightBeat();
  const heroCtl = useFighterControls();
  const bossCtl = useFighterControls();
  const stageCtl = useAnimationControls();
  const [heroFace, setHeroFace] = useState<Expression>("idle");
  const [bossFace, setBossFace] = useState<Expression>("idle");
  const [bossPose, setBossPose] = useState<FighterPose>("stand");
  const [veiled, setVeiled] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [ending, setEnding] = useState(false);
  /** HP and lives as drawn: held at their old values until the blow (or the wave) lands, then released (null). */
  const [held, setHeld] = useState<{ hp: number; lives: number; seq: number } | null>(null);
  const heldSeq = useRef(0);
  /** Releases the hold taken for answer `seq` only: a later answer's hold stays until its own contact. */
  const release = useCallback((seq: number) => setHeld((h) => (h?.seq === seq ? null : h)), []);
  const fxSeq = useRef(0);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  // The ending is a celebration a keyboard or screen-reader user can skip too: focus « Passer » when it starts.
  useEffect(() => {
    if (ending) skipRef.current?.focus();
  }, [ending]);
  const timers = useRef(new Set<number>());
  /** The end of the fight: the K.-O. (or the boss's triumph) plays until this opens — by itself or on a tap. */
  const gate = useRef<{ done: Promise<void>; open: () => void } | null>(null);

  const outcomes = useRef<QuestionOutcome[]>([]);
  const handled = useRef<number>(-1); // one result per question
  const finishing = useRef(false); // finishExam runs at most once per run
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  /** Runs `fn` in `seconds` (beat schedule), unless the screen is gone. */
  const later = useCallback((fn: () => void, seconds: number) => {
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      if (mounted.current) fn();
    }, Math.round(seconds * 1000));
    timers.current.add(t);
  }, []);
  /** Mounts an FX for `life` seconds, then unmounts it (the budget: FX nodes go away with their beat). */
  const showFx = useCallback(
    (kind: Fx["kind"], life: number) => {
      const id = ++fxSeq.current;
      // At most one damage number at a time: a new one replaces the previous.
      setFx((all) => [...all.filter((f) => kind !== "dmg" || f.kind !== "dmg"), { id, kind, life }]);
      later(() => setFx((all) => all.filter((f) => f.id !== id)), life);
    },
    [later],
  );
  const closeGate = useCallback(
    (seconds: number) => {
      let open: () => void = () => undefined;
      const done = new Promise<void>((resolve) => {
        open = () => {
          resolve();
          if (mounted.current) setEnding(false);
        };
      });
      gate.current = { done, open };
      setEnding(true);
      later(open, seconds);
    },
    [later],
  );

  /** A right answer: the hero rushes at the boss (compact beat), ink on contact, a drop detaches; the K.-O. on the last one. */
  const playHit = useCallback(
    (ko: boolean, seq: number) => {
      const t = beat.blow({ kind: "hit", ko, compact: true, attacker: heroCtl, defender: bossCtl, stage: stageCtl, reach: REACH });
      const after = t.length - t.impact;
      later(() => {
        showFx(ko ? "ko" : "ink", after);
        showFx("dmg", FIGHT.number);
        setBossFace(ko && beat.reduced ? "ko" : "hurt");
        release(seq); // the drop detaches on contact
      }, t.impact);
      if (ko) {
        // Hit-stop held (reduced motion: no hold, a fade), then Thủy Tinh bows from its feet with its salute art; the stage veils.
        later(() => {
          setBossFace("ko");
          setBossPose("bow");
          setVeiled(true);
        }, beat.reduced ? t.impact : t.impact + t.hitStop);
        closeGate(t.impact + t.hitStop + duration.slow);
      } else {
        later(() => setBossFace((f) => (f === "hurt" ? "idle" : f)), t.length);
      }
    },
    [beat, heroCtl, bossCtl, stageCtl, later, showFx, closeGate, release],
  );

  /** A wrong answer: the boss throws a wave at the hero, who winces and steps back; a heart breaks (Hearts). */
  const playMiss = useCallback(
    (lost: boolean, seq: number) => {
      setHeroFace("hurt");
      if (beat.reduced) release(seq);
      else {
        later(() => release(seq), duration.base); // the heart breaks when the wave lands
        showFx("wave", duration.base);
        void heroCtl.body.start({ x: [null, 0, -8, 0], transition: { duration: duration.slow, times: [0, 0.55, 0.7, 1], ease: ease.out } });
      }
      if (lost) {
        later(() => {
          if (!beat.reduced) void bossCtl.body.start({ rotate: -10, transition: spring.bouncy });
          setVeiled(true);
        }, duration.base);
        closeGate(duration.celebrate);
      } else {
        later(() => setHeroFace((f) => (f === "hurt" ? "idle" : f)), duration.slow);
      }
    },
    [beat, heroCtl, bossCtl, later, showFx, closeGate, release],
  );

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([content.getExamPool(), content.getVocabIndex(), content.getBoss(FINAL_BOSS_ID)]).then(
      ([pool, vocabIndex, boss]) => {
        if (cancelled) return;
        try {
          const deck = buildDeck(pool, boss, seedFromString(run.attemptId), hasStt.current);
          outcomes.current = [];
          handled.current = -1;
          finishing.current = false;
          setFight(startFight(boss));
          setLoad({ status: "ready", deck, boss, vocabIndex });
        } catch {
          setLoad({ status: "error" });
        }
      },
      () => {
        if (!cancelled) setLoad({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, run.attemptId, loadAttempt]);

  const finish = useCallback(
    async (f: Fight, boss: Boss, deck: readonly ExamQuestion[]) => {
      if (finishing.current) return;
      finishing.current = true;
      setSaveError(false);
      setSaving(true);
      try {
        const score = fightScore(f, boss);
        const noSpeaking = !deck.some((q) => q.section === "speaking");
        const won = f.status === "won";
        // The server scores the attempt from the synced exam_finished event; a failed call here is not fatal.
        await exam.submitAttempt(run.attemptId, score).catch(() => undefined);
        const result = await activity.finishExam({
          attemptId: run.attemptId,
          score,
          noSpeaking,
          boss: { bossId: boss.id, won, livesLeft: f.lives, bossHpLeft: f.bossHp },
        });
        await refreshProgress().catch(() => undefined);
        if (!mounted.current) return;
        const state: ResultState = {
          score,
          mention: bossMention(score),
          results: outcomes.current,
          questions: deck.slice(0, f.answers.length),
          noSpeaking,
          xpGained: result.xpGained,
          coinsGained: result.coinsGained,
          newBadges: result.newBadges,
          remainingToday: run.remainingToday,
          dateIso: clock(),
          boss: {
            id: boss.id,
            name: boss.name,
            title: boss.title,
            illustration: boss.illustration,
            hp: boss.hp,
            playerLives: boss.playerLives,
            won,
            livesLeft: f.lives,
            bossHpLeft: f.bossHp,
          },
        };
        clearAttemptMark();
        await gate.current?.done; // the K.-O. plays out (or is skipped) before the result
        if (!mounted.current) return;
        navigate("/exam/result", { state, replace: true });
      } catch {
        finishing.current = false; // nothing was committed: the learner may retry
        if (mounted.current) setSaveError(true);
      }
    },
    [exam, activity, refreshProgress, navigate, clock, run.attemptId, run.remainingToday],
  );

  const onResult = useCallback(
    (r: GradeResult) => {
      if (load.status !== "ready" || !fight || fight.status !== "fighting") return;
      const { deck, boss } = load;
      const index = fight.answers.length;
      const question = deck[index];
      if (!question || handled.current >= index) return;
      handled.current = index;
      let next = answer(fight, question.id, r.correct && !r.skipped);
      outcomes.current = [
        ...outcomes.current,
        { score: r.skipped ? 0 : r.score, correct: r.correct, skipped: !!r.skipped, expected: r.expected },
      ];
      if (next.status === "fighting" && next.answers.length >= deck.length) next = outOfQuestions(next);
      const seq = ++heldSeq.current;
      setHeld({ hp: fight.bossHp, lives: fight.lives, seq });
      setFight(next);
      // The beat runs beside the next exercise, which never waits for it.
      if (r.correct && !r.skipped) playHit(next.status === "won", seq);
      else playMiss(next.status === "lost" && next.lives <= 0, seq);
      // Out of questions with lives left: no blow ends it, a short pause before the result.
      if (next.status !== "fighting" && !gate.current) closeGate(duration.slow);
      // Saving starts at once; the navigation waits for the end of the K.-O.
      if (next.status !== "fighting") void finish(next, boss, deck);
    },
    [load, fight, finish, playHit, playMiss, closeGate],
  );

  const goBack = () => {
    clearAttemptMark();
    navigate("/exam", { replace: true });
  };

  if (load.status === "error") {
    return (
      <EmptyState
        title={fr.exam.run.loadError.title}
        body={fr.exam.run.loadError.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={() => setLoadAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={goBack}>
              {fr.app.error.home}
            </Button>
          </div>
        }
      />
    );
  }
  if (load.status === "loading" || !fight) {
    return (
      <div className="px-5 pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  const { deck, boss } = load;
  const question = fight.status === "fighting" ? deck[fight.answers.length] : undefined;
  const last = fight.answers[fight.answers.length - 1];
  const hp = held?.hp ?? fight.bossHp;
  const lives = held?.lives ?? fight.lives;

  return (
    <div className="pb-8">
      {saving ? (
        // Same height as FocusHeader (44 px close button): the stage must not jump when saving starts.
        <div className="flex min-h-[4.25rem] items-center justify-end px-5 py-3">
          <Hearts count={lives} max={boss.playerLives} />
        </div>
      ) : (
        <FocusHeader
          onClose={() => setQuitting(true)}
          closeLabel={fr.exam.run.quit.aria}
          right={<Hearts count={lives} max={boss.playerLives} />}
        />
      )}

      <FightStage
        boss={boss}
        defeated={fight.status === "won"}
        look={look}
        heroFace={heroFace}
        bossFace={bossFace}
        bossPose={bossPose}
        veiled={veiled}
        fx={fx}
        hero={heroCtl}
        bossCtl={bossCtl}
        stage={stageCtl}
        reduced={beat.reduced}
        live={fight.status === "fighting" || ending}
      />
      <div className="flex items-center justify-between gap-3 px-5 pt-2">
        <p lang="vi" className="whitespace-nowrap text-body-strong text-ink">
          {boss.name}
        </p>
        <WaterDropHp value={hp} max={boss.hp} label={fr.exam.run.bossHp(boss.name, hp, boss.hp)} reduced={beat.reduced} />
      </div>
      <p aria-live="polite" className="sr-only">
        {last ? (last.correct ? fr.exam.run.hit(fight.bossHp) : fr.exam.run.miss(fight.lives)) : ""}
      </p>

      {ending ? (
        // The end of the fight is a celebration: never blocking, a tap anywhere skips to the result.
        <motion.button
          type="button"
          aria-label={fr.exam.run.skip}
          className="group fixed inset-0 z-40 flex items-end justify-center pb-10 focus-visible:outline-none"
          whileTap="pressed"
          ref={skipRef}
          onClick={() => gate.current?.open()}
        >
          <motion.span variants={{ pressed: tap }} className="rounded-md bg-surface px-5 py-3 text-body-strong text-ink shadow-raised group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-gold" aria-hidden="true">
            {fr.exam.run.skip}
          </motion.span>
        </motion.button>
      ) : null}

      {saving ? (
        saveError ? (
          <EmptyState
            title={fr.exam.run.saveError.title}
            body={fr.exam.run.saveError.body}
            illustration="boat"
            action={<Button onClick={() => void finish(fight, boss, deck)}>{fr.app.error.retry}</Button>}
          />
        ) : (
          <div className="px-5 pt-6" role="status" aria-label={fr.exam.run.saving}>
            <Skeleton lines={3} />
          </div>
        )
      ) : (
        <div className="px-5 pt-5">
          {question ? (
            <ExerciseHost
              exercise={question.exercise}
              attempt={fight.answers.length}
              mode="exam"
              vocabIndex={load.vocabIndex}
              capabilities={capabilities}
              voiceRate={voiceRateOf(settings)}
              services={{ tts, stt, recorder }}
              onResult={onResult}
            />
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={quitting}
        title={fr.exam.run.quit.title}
        body={fr.exam.run.quit.body}
        confirmLabel={fr.exam.run.quit.confirm}
        cancelLabel={fr.exam.run.quit.cancel}
        danger
        onConfirm={goBack}
        onCancel={() => setQuitting(false)}
      />
    </div>
  );
}

export function ExamRunScreen() {
  const state = useEntryState();
  // Decided once, on the first render (before the effect below marks the run as running).
  const [mark] = useState(() => (isRunState(state) ? readAttemptMark(state.attemptId) : "none"));
  const attemptId = isRunState(state) ? state.attemptId : null;
  useEffect(() => {
    if (attemptId && mark === "pending") markAttempt("running", attemptId);
  }, [attemptId, mark]);
  if (!isRunState(state)) return <Navigate to="/exam" replace />;
  if (mark === "running") return <Navigate to="/exam" replace state={INTERRUPTED_STATE} />;
  if (mark === "none") return <Navigate to="/exam" replace />;
  return <ExamRun run={state} />;
}
