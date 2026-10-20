import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Navigate, useNavigate } from "react-router-dom";
import { useEntryState } from "@/app/useEntryState";
import { useAppState, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { lookOf } from "@/services/look";
import {
  BadgeMedal,
  rewardProp,
  Button,
  Certificate,
  Confetti,
  downloadCertificate,
  duration,
  ease,
  Hearts,
  Icon,
  Motif,
  SpeakerButton,
  tap,
  XpCounter,
} from "@/ui";
import { FighterSprite } from "@/ui/fight";
import { BossSprite } from "@/features/exam/BossPortrait";
import {
  describeQuestion,
  isResultState,
  type ResultState,
} from "@/features/exam/examState";

function Corrections({ state }: { state: ResultState }) {
  const { tts } = useServices();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const canSpeak = (settings.capabilities?.tts ?? tts.isAvailable()) === true;

  return (
    <section aria-label={fr.exam.result.correctionLabel} className="flex flex-col gap-2">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? fr.exam.result.hideCorrection : fr.exam.result.showCorrection}
      </Button>
      {open ? (
        <ol className="divide-y divide-line">
          {state.questions.map((q, i) => {
            const r = state.results[i];
            if (!r) return null;
            const d = describeQuestion(q.exercise);
            const status = r.skipped ? fr.exam.result.skipped : r.correct ? fr.exam.result.right : fr.exam.result.wrong;
            return (
              <li key={q.id} className="flex items-start gap-3 py-3">
                <span
                  role="img"
                  aria-label={status}
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    r.skipped ? "bg-surface-2 text-ink-muted" : r.correct ? "bg-success-soft text-success" : "bg-error-soft text-error"
                  }`}
                >
                  <Icon name={r.correct ? "check" : "cross"} size={18} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-caption text-ink-muted">{d.prompt}</p>
                  {d.subject ? (
                    <p className="text-body-strong text-ink" {...(d.subjectLang ? { lang: d.subjectLang } : {})}>
                      {d.subject}
                    </p>
                  ) : null}
                  <p className="text-body text-ink">
                    <span className="text-caption text-ink-muted">{fr.exam.result.expected}{"\u202f: "}</span>
                    <span lang="vi">{r.expected}</span>
                  </p>
                </div>
                {canSpeak && r.expected ? (
                  <SpeakerButton
                    onSpeak={() => {
                      tts.speak(r.expected, { rate: voiceRateOf(settings) }).catch(() => undefined);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

/** Coins and new badges in one folded line (audit §B6): the XP counter stays the only counter of the screen. */
function Loot({ coins, badges }: { coins: number; badges: ResultState["newBadges"] }) {
  const [open, setOpen] = useState(false);
  if (coins <= 0 && badges.length === 0) return null;
  return (
    <section aria-label={fr.exam.result.loot} className="w-full rounded-md border border-line bg-surface px-4 py-1 text-left shadow-card">
      <p className="pt-1 text-caption uppercase tracking-[0.08em] text-gold-ink">{fr.exam.result.loot}</p>
      <div className="flex min-h-11 items-center gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 whitespace-nowrap text-body-strong text-gold-ink tabular">
          {coins > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="coin" size={18} />
              {fr.shop.gained(coins)}
            </span>
          ) : null}
          {badges.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">{badges[0]?.icon}</span>
              {fr.exam.result.lootBadges(badges.length)}
            </span>
          ) : null}
        </p>
        {badges.length > 0 ? (
          <motion.button
            type="button"
            whileTap={tap}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="min-h-11 shrink-0 px-1 text-caption text-ink-muted underline underline-offset-4"
          >
            {open ? fr.exam.result.lootHide : fr.exam.result.lootShow}
          </motion.button>
        ) : null}
      </div>
      {open ? (
        <ul className="flex flex-wrap justify-center gap-5 pb-3 pt-2">
          {badges.map((b) => (
            <li key={b.id}>
              <BadgeMedal icon={b.icon} title={b.title} unlocked {...rewardProp(b)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Entrance delays of the victory sequence (s): the bow first, then the title, the counter, the certificate. */
const STEP = [0, duration.slow, duration.slow + duration.base, duration.slow + duration.base * 2] as const;

// Hero: the player's hero facing Thủy Tinh. Victory is staged: the boss bows from its feet with its salute art, then
// the title, one counter (XP), then the certificate; coins and badges wait in the « Butin » line. Nothing blocks:
// every button is live while it fades in. Defeat shows the damage dealt, then retry or review.
function ResultContent({ state }: { state: ResultState }) {
  const navigate = useNavigate();
  const profile = useAppState((s) => s.profile);
  const xpTotal = useAppState((s) => s.snapshot?.xpTotal);
  const equipped = useAppState((s) => s.wallet?.equipped);
  const look = useMemo(() => lookOf(equipped ?? {}), [equipped]);
  const reduced = useReducedMotion() === true;
  const [downloadFailed, setDownloadFailed] = useState(false);
  const { boss } = state;
  const won = boss.won;
  // The boss bows once the screen is in; under reduced motion the final pose shows at once.
  const [bowed, setBowed] = useState(reduced);
  useEffect(() => {
    if (!won || reduced) return;
    const t = window.setTimeout(() => setBowed(true), duration.base * 1000);
    return () => window.clearTimeout(t);
  }, [won, reduced]);
  const pseudo = profile?.pseudo ?? "";
  const mention = state.mention === "presque" ? null : state.mention;
  const certificate = won && mention !== null && pseudo !== "" ? { pseudo, score: state.score, mention, dateIso: state.dateIso, noSpeaking: state.noSpeaking } : null;
  const enter = (step: 1 | 2 | 3) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: duration.fast } }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: duration.base, ease: ease.out, delay: STEP[step] } };

  const download = async () => {
    if (!certificate) return;
    setDownloadFailed(false);
    const ok = await downloadCertificate(certificate).catch(() => false);
    if (!ok) setDownloadFailed(true);
  };

  return (
    <div className="relative flex flex-col gap-8 px-5 pb-10 pt-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 text-gold [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="scales" />
      </div>
      <Confetti fire={won} />

      <header className="relative flex flex-col items-center gap-3 text-center">
        <div className="relative flex h-36 items-end justify-center gap-6">
          <div role="img" aria-label={fr.exam.run.hero} data-fighter="hero" className="relative pb-2">
            {/* Paper medallions as on the stage: the ink outlines stay readable on the dark lacquer. */}
            <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-[5.5rem] w-[5.5rem] -translate-x-1/2 rounded-full border-2 border-line bg-paper" />
            <FighterSprite look={look} facing={1} expression="idle" size={72} />
          </div>
          <div role="img" aria-label={fr.exam.boss.aria(boss.name, boss.title, won)} className="relative pb-1.5">
            <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full border-2 border-line bg-paper" />
            <BossSprite illustration={boss.illustration} size={128} facing={-1} expression={won ? "ko" : "idle"} pose={won && bowed ? "bow" : "stand"} />
          </div>
        </div>
        <motion.div className="flex flex-col items-center gap-2" {...enter(1)}>
          <h1 className="text-title text-ink">{won ? fr.exam.result.won(boss.name) : fr.exam.result.lost(boss.name)}</h1>
          {won ? (
            <>
              {mention !== null ? <p className="text-heading text-gold-ink">{fr.exam.result.mention[mention]}</p> : null}
              <div className="flex flex-col items-center gap-1">
                <Hearts count={boss.livesLeft} max={boss.playerLives} />
                <p className="text-caption text-ink-muted">{fr.exam.result.livesLeft(boss.livesLeft, boss.playerLives)}</p>
              </div>
            </>
          ) : (
            <p className="text-body text-ink-muted">{fr.exam.result.damage(boss.hp - boss.bossHpLeft, boss.hp)}</p>
          )}
        </motion.div>
        <motion.div className="flex w-full flex-col items-center gap-3" {...enter(2)}>
          {state.xpGained > 0 ? <XpCounter value={xpTotal ?? state.xpGained} delta={state.xpGained} /> : null}
          <Loot coins={state.coinsGained ?? 0} badges={state.newBadges} />
        </motion.div>
      </header>

      <motion.div {...enter(3)}>
        {certificate ? (
          <section aria-label={fr.exam.result.certificate} className="flex flex-col gap-4">
            <Certificate {...certificate} />
            <div className="flex flex-col gap-2">
              <Button size="lg" fullWidth onClick={() => void download()}>
                <Icon name="download" size={20} />
                {fr.exam.result.download}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => window.print()}>
                {fr.exam.result.print}
              </Button>
              {downloadFailed ? (
                <p role="alert" className="text-caption text-error">
                  {fr.exam.result.downloadError}
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth disabled={state.remainingToday <= 0} onClick={() => navigate("/exam", { replace: true })}>
              {state.remainingToday > 0 ? fr.exam.result.retry(state.remainingToday) : fr.exam.result.noMoreTries}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => navigate("/review", { replace: true })}>
              {fr.exam.result.review}
            </Button>
          </div>
        )}
      </motion.div>

      <Corrections state={state} />

      <Button variant="ghost" fullWidth onClick={() => navigate("/", { replace: true })}>
        {fr.exam.result.home}
      </Button>
    </div>
  );
}

export function ExamResultScreen() {
  const state = useEntryState();
  if (!isResultState(state)) return <Navigate to="/exam" replace />;
  return <ResultContent state={state} />;
}
