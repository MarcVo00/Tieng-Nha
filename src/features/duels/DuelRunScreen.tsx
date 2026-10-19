import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { OfflineError } from "@/domain/errors";
import type { Capabilities, Exercise, VocabId, VocabItem } from "@/domain/types";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import type { GradeResult } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { Button, ConfirmDialog, duration, EmptyState, ease, FocusHeader, ProgressBar, Skeleton } from "@/ui";
import {
  clearPending,
  clearRun,
  missRemainingOral,
  newRecord,
  positionOf,
  readPending,
  readRun,
  recordAnswer,
  recordMiss,
  resume,
  saveRun,
  savePending,
  verdictOf,
  type PendingRun,
  type RunRecord,
  type Verdict,
} from "@/features/duels/duelRunState";

const FLASH_MS = 700;
const TICK_MS = 200;
const DUELS_HOME = "/duels";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "notFound" }
  | { status: "noMic" }
  | { status: "ready"; exercises: (Exercise | null)[]; vocabIndex: ReadonlyMap<VocabId, VocabItem>; seed: number };

type Phase = { kind: "running" } | { kind: "sending" } | { kind: "offline" } | { kind: "failed" } | { kind: "rejected" };

const VERDICT_STYLE: Record<Verdict, string> = {
  critical: "text-gold-ink",
  hit: "text-success",
  miss: "text-ink-muted",
};

/**
 * Hierarchy: the current question is the hero, the time bar is the pressure, the « 3/8 » counter is quiet.
 * No HP bars here: the replay on the result screen is the payoff.
 */
export function DuelRunScreen({ now = Date.now }: { now?: () => number }) {
  const { id = "" } = useParams();
  const { content, duels, tts, stt, recorder, clock } = useServices();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();

  const hasStt = useRef(settings.capabilities?.stt ?? false); // fixed for the run
  // The recorder would let the learner grade themselves: duels are recognition-only.
  const capabilities: Capabilities = { tts: settings.capabilities?.tts ?? tts.isAvailable(), stt: true, recorder: false };

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "running" });
  const [rec, setRec] = useState<RunRecord | null>(null);
  const [flash, setFlash] = useState<Verdict | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [left, setLeft] = useState(1);
  const [quitting, setQuitting] = useState(false);

  const recRef = useRef<RunRecord | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  const pendingRun = useRef<PendingRun | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const commit = useCallback(
    (next: RunRecord) => {
      recRef.current = next;
      saveRun(id, next);
      setRec(next);
    },
    [id],
  );

  const send = useCallback(
    async (run: PendingRun) => {
      if (submitting.current) return;
      submitting.current = true;
      setPhase({ kind: "sending" });
      try {
        const res = await duels.submitRun(id, run.round1, run.round2);
        if (!mounted.current) return;
        if (res.ok || res.error === "already_submitted" || res.error === "not_open") {
          clearPending(id);
          clearRun(id);
          navigate(`/duel/${id}`, { replace: true });
        } else {
          clearPending(id);
          clearRun(id);
          setPhase({ kind: "rejected" });
        }
      } catch (e) {
        // The finished run stays on the phone either way; only a network failure is « offline ».
        if (mounted.current) setPhase({ kind: e instanceof OfflineError ? "offline" : "failed" });
      } finally {
        submitting.current = false;
      }
    },
    [duels, id, navigate],
  );

  // Load: a finished unsent run goes straight to the network; otherwise resume or start the run.
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    setPhase({ kind: "running" });
    submitting.current = false;

    const pending = readPending(id);
    if (pending) {
      pendingRun.current = pending;
      setLoad({ status: "ready", exercises: [], vocabIndex: new Map(), seed: 0 });
      void send(pending);
      return;
    }
    if (!hasStt.current) {
      setLoad({ status: "noMic" });
      return;
    }

    const start = async (): Promise<RunRecord | "gone" | "notFound"> => {
      const stored = readRun(id);
      if (stored) return resume(stored);
      const duel = (await duels.list()).find((d) => d.id === id);
      if (!duel) return "notFound";
      if (duel.myRun || duel.status !== "open" || Date.parse(duel.expiresAt) <= Date.parse(clock())) return "gone";
      return newRecord(duel.questions, duel.seed);
    };

    (async () => {
      const first = await start();
      if (cancelled) return;
      if (first === "notFound") return setLoad({ status: "notFound" });
      if (first === "gone") return navigate(`/duel/${id}`, { replace: true });
      const lessonIds = [...new Set([...first.questions.round1, ...first.questions.round2].map((q) => q.lessonId))];
      const [lessons, vocabIndex] = await Promise.all([
        Promise.all(lessonIds.map((l) => content.getLesson(l).catch(() => null))),
        content.getVocabIndex(),
      ]);
      if (cancelled) return;
      const byLesson = new Map(lessonIds.map((l, i) => [l, lessons[i] ?? null]));
      // An exercise that cannot be found counts as missed for this player.
      const exercises = [...first.questions.round1, ...first.questions.round2].map(
        (q) => byLesson.get(q.lessonId)?.exercises.find((x) => x.id === q.exerciseId) ?? null,
      );
      recRef.current = first;
      saveRun(id, first);
      setRec(first);
      setIntroDone(first.round2.length > 0);
      setLoad({ status: "ready", exercises, vocabIndex, seed: first.seed });
    })().catch(() => {
      if (!cancelled) setLoad({ status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [content, duels, clock, id, navigate, send, loadAttempt]);

  const afterAnswer = useCallback(
    (next: RunRecord, round: 1 | 2) => {
      commit(next);
      setLeft(1); // the next question starts with a full bar: no stale frame
      const last = round === 1 ? next.round1[next.round1.length - 1] : next.round2[next.round2.length - 1];
      setFlash(verdictOf(round, last));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        flashTimer.current = null;
        if (mounted.current) setFlash(null);
      }, FLASH_MS);
    },
    [commit],
  );

  const position = rec ? positionOf(rec) : null;
  const exerciseIndex = rec && position && position.round !== "done" ? (position.round === 1 ? position.index : rec.questions.round1.length + position.index) : -1;
  const exercise = load.status === "ready" && exerciseIndex >= 0 ? (load.exercises[exerciseIndex] ?? null) : null;
  const waitingIntro = position?.round === 2 && !introDone && !flash;
  const live = phase.kind === "running" && rec !== null && position !== null && position.round !== "done" && !flash && !waitingIntro;

  // A question that cannot be shown counts as missed.
  useEffect(() => {
    const cur = recRef.current;
    if (live && load.status === "ready" && exerciseIndex >= 0 && exercise === null && cur) afterAnswer(recordMiss(cur), position?.round === 2 ? 2 : 1);
  }, [live, load.status, exercise, exerciseIndex, position?.round, afterAnswer]);

  // The question is displayed: start its clock.
  useEffect(() => {
    const cur = recRef.current;
    if (live && exercise && cur && cur.shownAt === null) commit({ ...cur, shownAt: now() });
  }, [live, exercise, rec?.shownAt, commit, now]);

  // Time bar + time-out; the clock keeps running while the app is in the background.
  const shownAt = rec?.shownAt ?? null;
  const cap = position && position.round !== "done" ? position.cap : 0;
  const round = position?.round;
  useEffect(() => {
    if (!live || shownAt === null || cap === 0) return;
    const tick = () => {
      const cur = recRef.current;
      if (!cur || cur.shownAt === null) return;
      const elapsed = now() - cur.shownAt;
      setLeft(Math.max(0, 1 - elapsed / cap));
      if (elapsed >= cap) {
        if (round === 2) stt.abort();
        afterAnswer(recordMiss(cur), round === 2 ? 2 : 1);
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [live, shownAt, cap, round, now, stt, afterAnswer]);

  // Everything answered: keep the run on the phone, then send it.
  useEffect(() => {
    if (phase.kind !== "running" || !rec || flash || positionOf(rec).round !== "done") return;
    const run: PendingRun = { round1: rec.round1, round2: rec.round2 };
    pendingRun.current = run;
    savePending(id, run);
    clearRun(id);
    void send(run);
  }, [phase.kind, rec, flash, id, send]);

  // Back online: retry the unsent run.
  useEffect(() => {
    if (phase.kind !== "offline") return;
    const retry = () => {
      if (pendingRun.current) void send(pendingRun.current);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase.kind, send]);

  const onResult = (r: GradeResult) => {
    const cur = recRef.current;
    if (!cur || cur.shownAt === null || flash) return;
    const pos = positionOf(cur);
    if (pos.round === "done") return;
    afterAnswer(recordAnswer(cur, r.correct && !r.skipped, now() - cur.shownAt), pos.round);
  };

  const onCapabilityLost = (c: "stt" | "recorder") => {
    if (c !== "stt") return;
    void updateSettings({ capabilities: { ...capabilities, stt: false } });
    const cur = recRef.current;
    if (cur) commit(missRemainingOral(cur));
  };

  const leave = () => navigate(DUELS_HOME, { replace: true });

  if (load.status === "error") {
    return (
      <EmptyState
        title={fr.duels.run.loadError.title}
        body={fr.duels.run.loadError.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={() => setLoadAttempt((n) => n + 1)}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={leave}>
              {fr.duels.run.noMic.back}
            </Button>
          </div>
        }
      />
    );
  }
  if (load.status === "notFound") {
    return (
      <EmptyState
        title={fr.duels.run.notFound.title}
        body={fr.duels.run.notFound.body}
        illustration="lantern"
        action={<Button onClick={leave}>{fr.duels.run.noMic.back}</Button>}
      />
    );
  }
  if (load.status === "noMic") {
    return (
      <EmptyState
        title={fr.duels.run.noMic.title}
        body={fr.duels.run.noMic.body}
        illustration="lantern"
        action={<Button onClick={leave}>{fr.duels.run.noMic.back}</Button>}
      />
    );
  }
  if (phase.kind === "offline") {
    return (
      <EmptyState
        title={fr.duels.run.pendingOffline.title}
        body={fr.duels.run.pendingOffline.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={() => pendingRun.current && void send(pendingRun.current)}>{fr.duels.run.pendingOffline.retry}</Button>
            <Button variant="secondary" onClick={leave}>
              {fr.duels.run.pendingOffline.later}
            </Button>
          </div>
        }
      />
    );
  }
  if (phase.kind === "failed") {
    return (
      <EmptyState
        title={fr.duels.run.sendError.title}
        body={fr.duels.run.sendError.body}
        illustration="lantern"
        action={
          <div className="flex gap-2">
            <Button onClick={() => pendingRun.current && void send(pendingRun.current)}>{fr.duels.run.pendingOffline.retry}</Button>
            <Button variant="secondary" onClick={leave}>
              {fr.duels.run.pendingOffline.later}
            </Button>
          </div>
        }
      />
    );
  }
  if (phase.kind === "rejected") {
    return (
      <EmptyState
        title={fr.duels.run.rejected.title}
        body={fr.duels.run.rejected.body}
        illustration="lantern"
        action={<Button onClick={() => navigate(`/duel/${id}`, { replace: true })}>{fr.duels.run.noMic.back}</Button>}
      />
    );
  }
  if (phase.kind === "sending") {
    return (
      <div className="px-5 pt-10" role="status" aria-label={fr.duels.run.sending}>
        <p className="pb-4 text-center text-body-strong text-ink-muted">{fr.duels.run.sending}</p>
        <Skeleton lines={3} />
      </div>
    );
  }
  if (load.status === "loading" || !rec || !position) {
    return (
      <div className="px-5 pt-6" role="status" aria-label={fr.duels.run.loading}>
        <Skeleton lines={4} />
      </div>
    );
  }

  // While the last round-1 verdict is flashing, the header still belongs to round 1.
  const shownRound = position.round === "done" ? (rec.round2.length > 0 ? 2 : 1) : position.round === 2 && flash && rec.round2.length === 0 ? 1 : position.round;
  const total = shownRound === 1 ? rec.questions.round1.length : rec.questions.round2.length;
  const answered = shownRound === 1 ? rec.round1.length : rec.round2.length;
  const current = Math.min(total, answered + (position.round === "done" ? 0 : 1));
  const seconds = Math.ceil((left * cap) / 1000);

  return (
    <div className="pb-8">
      <FocusHeader onClose={() => setQuitting(true)} closeLabel={fr.duels.run.quit.aria} />

      {waitingIntro ? (
        <motion.div
          className="px-5 pt-10 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
        >
          <p className="text-caption text-ink-muted">{fr.duels.run.round2}</p>
          <h1 className="pt-2 text-title text-ink">{fr.duels.run.round2Intro.title}</h1>
          <p className="mx-auto max-w-xs pt-3 text-body text-ink-muted">{fr.duels.run.round2Intro.body}</p>
          <div className="pt-8">
            <Button onClick={() => setIntroDone(true)}>{fr.duels.run.round2Intro.start}</Button>
          </div>
        </motion.div>
      ) : (
        <div className="px-5 pt-2">
          <div className="flex items-baseline justify-between">
            <p className="text-caption text-ink-muted">{shownRound === 1 ? fr.duels.run.round1 : fr.duels.run.round2}</p>
            <p className="text-heading tabular-nums text-ink" aria-label={fr.duels.run.progressAria(current, total)}>
              {fr.duels.run.progress(current, total)}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1">
              <ProgressBar value={left} label={fr.duels.run.timeBar} />
            </div>
            <p className="w-10 text-right text-caption tabular-nums text-ink-muted">{fr.duels.run.timeLeft(seconds)}</p>
          </div>

          <div className="pt-4">
            {flash ? (
              <motion.p
                role="status"
                className={`flex h-48 items-center justify-center text-display ${VERDICT_STYLE[flash]}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: duration.fast, ease: ease.out } }}
              >
                {flash === "critical" ? fr.duels.run.critical : flash === "hit" ? fr.duels.run.hit : fr.duels.run.miss}
              </motion.p>
            ) : exercise && load.status === "ready" ? (
              <ExerciseHost
                exercise={exercise}
                attempt={exerciseIndex}
                mode="exam"
                seedSalt={String(load.seed)}
                vocabIndex={load.vocabIndex}
                capabilities={capabilities}
                voiceRate={voiceRateOf(settings)}
                services={{ tts, stt, recorder }}
                onResult={onResult}
                onCapabilityLost={onCapabilityLost}
              />
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={quitting}
        title={fr.duels.run.quit.title}
        body={fr.duels.run.quit.body}
        confirmLabel={fr.duels.run.quit.confirm}
        cancelLabel={fr.duels.run.quit.cancel}
        danger
        onConfirm={leave}
        onCancel={() => setQuitting(false)}
      />
    </div>
  );
}
