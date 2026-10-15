import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import type { Dialogue } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { waitParts } from "@/services/energy";
import { Bubble, MiniSpeaker, TypingIndicator } from "@/features/conversation/Bubble";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useDialogue, type DialogueNotice } from "@/features/conversation/useDialogue";
import { BadgeMedal, Button, Card, ConfirmDialog, Confetti, duration, EmptyState, FocusHeader, Icon, MicButton, Motif, NoEnergy, ReportSheet, Skeleton, spring, tap, XpCounter } from "@/ui";
import type { ActivityResult } from "@/services/activity";

const BADGE_STAGGER_MS = 280;

const NOTICE_TEXT: Record<Exclude<DialogueNotice, null>, string> = {
  misunderstood: fr.conversation.misunderstood,
  notHeard: fr.conversation.notHeard,
  micDenied: fr.conversation.micDenied,
  micUnsupported: fr.conversation.micUnsupported,
};

// Hero: the conversation itself. Secondary: the scene card. One action at a time:
// answer (voice or tap) while it is your turn, then "Retour à l'accueil" at the end.
function SceneCard({ dialogue }: { dialogue: Dialogue }) {
  return (
    <Card className="relative mx-5 overflow-hidden px-4 py-3">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-primary">
        <Motif kind="waves" />
      </div>
      <div className="relative">
        <h1 className="text-heading text-ink">{dialogue.title}</h1>
        <p lang="vi" className="text-caption text-ink-muted">
          {dialogue.scene}
        </p>
      </div>
    </Card>
  );
}

function ResultCard({ result, onHome, onReplay }: { result: ActivityResult; onHome: () => void; onReplay: () => void }) {
  const total = result.snapshot.xpTotal;
  const [counted, setCounted] = useState(false);
  const [shownBadges, setShownBadges] = useState(0);

  // Mount showing the XP before the dialogue, then count up to the new total.
  useEffect(() => {
    setCounted(true);
  }, []);

  useEffect(() => {
    if (shownBadges >= result.newBadges.length) return;
    const t = setTimeout(() => setShownBadges((n) => n + 1), shownBadges === 0 ? 0 : BADGE_STAGGER_MS);
    return () => clearTimeout(t);
  }, [shownBadges, result.newBadges.length]);

  return (
    <motion.section
      aria-label={fr.conversation.done.body}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="relative mt-4 flex flex-col gap-4 rounded-md bg-surface p-5 shadow-raised"
    >
      <Confetti fire />
      <div className="flex flex-col gap-1">
        <h2 lang="vi" className="text-title text-ink">
          {fr.conversation.done.title}
        </h2>
        <p className="text-body text-ink-muted">{fr.conversation.done.body}</p>
      </div>
      <div>
        <XpCounter value={counted ? total : total - result.xpGained} {...(counted ? { delta: result.xpGained } : {})} />
        {result.coinsGained > 0 ? (
            <p className="mt-3 flex items-center gap-1 text-body-strong text-gold-ink tabular">
              <Icon name="coin" size={20} />
              {fr.shop.gained(result.coinsGained)}
            </p>
          ) : null}
      </div>
      {result.newBadges.length > 0 ? (
        <section aria-label={fr.conversation.done.badges} className="flex flex-col gap-3">
          <h3 className="text-caption text-ink-muted">{fr.conversation.done.badges}</h3>
          <ul className="flex flex-wrap gap-5">
            {result.newBadges.slice(0, shownBadges).map((b) => (
              <li key={b.id}>
                <BadgeMedal icon={b.icon} title={b.title} unlocked size="lg" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="flex flex-col gap-3 pt-2">
        <Button size="lg" fullWidth onClick={onHome}>
          {fr.conversation.done.home}
        </Button>
        <Button variant="secondary" fullWidth onClick={onReplay}>
          {fr.conversation.done.replay}
        </Button>
      </div>
    </motion.section>
  );
}

export function DialogueScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reporter, clock } = useServices();
  const dueCount = useAppState((s) => s.dueCount);
  const reduced = useReducedMotion();
  const d = useDialogue(id);
  const [quitting, setQuitting] = useState(false);
  const [reportRef, setReportRef] = useState<string | null>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const goHome = () => navigate("/", { replace: true });

  const lineCount = d.lines.length;
  useEffect(() => {
    // jsdom has no scrollIntoView.
    endRef.current?.scrollIntoView?.({ block: "end", behavior: reduced ? "auto" : "smooth" });
  }, [lineCount, d.typing, d.phase, reduced]);

  if (d.phase === "error") {
    return (
      <EmptyState
        title={fr.conversation.loadError.title}
        body={fr.conversation.loadError.body}
        illustration="boat"
        action={
          <div className="flex gap-2">
            <Button onClick={d.reload}>{fr.app.error.retry}</Button>
            <Button variant="secondary" onClick={goHome}>
              {fr.app.error.home}
            </Button>
          </div>
        }
      />
    );
  }
  if (d.noEnergy) {
    return (
      <div className="flex min-h-dvh flex-col">
        <FocusHeader progress={0} onClose={goHome} closeLabel={fr.conversation.quit.aria} />
        <NoEnergy
          wait={d.noEnergy.nextAt ? waitParts(clock(), d.noEnergy.nextAt) : null}
          canReview={dueCount > 0}
          onReview={() => navigate("/review")}
          onBack={goHome}
        />
      </div>
    );
  }
  if (d.phase === "loading" || !d.dialogue) {
    return (
      <div className="px-5 pt-6">
        <Skeleton lines={4} />
      </div>
    );
  }

  const busy = d.phase !== "user" && d.phase !== "done";
  const yourTurn = d.phase === "user" || d.phase === "answering";
  const sttOn = d.capabilities.stt;
  const dialogueId = d.dialogue.id;
  const contentVersion = d.dialogue.contentVersion;

  return (
    <div className="flex min-h-dvh flex-col">
      <FocusHeader progress={d.phase === "done" ? 1 : d.progress} onClose={() => (d.phase === "done" ? goHome() : setQuitting(true))}
        closeLabel={fr.conversation.quit.aria} />
      <SceneCard dialogue={d.dialogue} />

      <ol role="log" aria-label={fr.conversation.log} aria-live="polite" className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-5">
        {d.lines.map((line) => (
          <Bubble
            key={line.key}
            speaker={line.speaker}
            vi={line.vi}
            fr={line.fr}
            onReplay={() => d.replay(line.vi)}
            replayDisabled={busy || !d.capabilities.tts}
            {...(line.speaker === "npc" ? { onReport: () => setReportRef(`${dialogueId}_${line.turnId}`) } : {})}
          />
        ))}
        <AnimatePresence>{d.typing ? <TypingIndicator key="typing" /> : null}</AnimatePresence>
        {d.phase === "saving" ? (
          d.saveError ? (
            <li>
              <EmptyState
                title={fr.conversation.saveError.title}
                body={fr.conversation.saveError.body}
                illustration="boat"
                action={<Button onClick={d.retrySave}>{fr.app.error.retry}</Button>}
              />
            </li>
          ) : (
            <li role="status" aria-label={fr.conversation.saving}>
              <Skeleton lines={3} />
            </li>
          )
        ) : null}
        {d.phase === "done" && d.result ? (
          <li className="list-none">
            <ResultCard result={d.result} onHome={goHome} onReplay={d.restart} />
          </li>
        ) : null}
        <li ref={endRef} aria-hidden="true" className="h-0" />
      </ol>

      <AnimatePresence>
        {yourTurn && d.options.length > 0 ? (
          <motion.section
            key="turn"
            aria-label={fr.conversation.yourTurn}
            initial={{ y: reduced ? 0 : "100%", opacity: reduced ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.fast } }}
            transition={spring.soft}
            className="sticky bottom-0 flex flex-col gap-3 rounded-t-lg bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-raised"
          >
            {sttOn ? (
              <div className="flex flex-col items-center gap-1">
                <MicButton
                  state={d.mic === "idle" && d.phase === "answering" ? "processing" : d.mic}
                  disabled={d.phase !== "user"}
                  onPress={() => void d.listen()}
                  label={d.mic === "listening" ? fr.exercises.speak.micStop : fr.conversation.speakHint}
                />
                <p className="text-caption text-ink-muted">{fr.conversation.orChoose}</p>
              </div>
            ) : (
              <h2 className="text-caption text-ink-muted">{fr.conversation.options}</h2>
            )}
            <p role="status" className={`min-h-[18px] text-caption ${d.notice ? "text-error" : "text-ink-muted"}`}>
              {d.notice ? NOTICE_TEXT[d.notice] : ""}
            </p>
            <ul aria-label={fr.conversation.options} className="flex flex-col gap-2">
              {d.options.map((o) => (
                <li key={o.id}>
                <motion.div
                  key={d.pulse}
                  initial={{ scale: 1 }}
                  animate={d.pulse > 0 ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                  transition={{ duration: duration.slow }}
                  className="flex items-center gap-1 rounded-md bg-bg shadow-card"
                >
                  <motion.button
                    type="button"
                    disabled={d.phase !== "user"}
                    onClick={() => d.choose(o.id)}
                    whileTap={tap}
                    transition={spring.snappy}
                    className="flex min-h-14 flex-1 flex-col items-start gap-0.5 px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span lang="vi" className="break-words text-body-strong text-ink">
                      {o.vi}
                    </span>
                    <span className="text-caption text-ink-muted">{o.fr}</span>
                  </motion.button>
                  <div className="pr-2">
                    <MiniSpeaker onSpeak={() => d.replay(o.vi)} disabled={d.phase !== "user" || !d.capabilities.tts} />
                  </div>
                </motion.div>
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={quitting}
        title={fr.conversation.quit.title}
        body={fr.conversation.quit.body}
        confirmLabel={fr.conversation.quit.confirm}
        cancelLabel={fr.conversation.quit.cancel}
        danger
        onConfirm={goHome}
        onCancel={() => setQuitting(false)}
      />
      <ReportSheet
        open={reportRef !== null}
        onClose={() => setReportRef(null)}
        onSubmit={(message) =>
          reportRef === null ? Promise.resolve() : reporter.report({ refId: reportRef, message, contentVersion })
        }
      />
    </div>
  );
}
