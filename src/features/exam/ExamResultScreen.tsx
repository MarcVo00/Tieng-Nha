import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useAppState, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { EXAM_PASS } from "@/services/exam";
import {
  BadgeMedal,
  Button,
  Certificate,
  Confetti,
  downloadCertificate,
  Icon,
  Motif,
  ProgressBar,
  SpeakerButton,
  XpCounter,
} from "@/ui";
import {
  describeQuestion,
  isResultState,
  sectionsOf,
  type ResultState,
} from "@/features/exam/examState";

const COUNT_UP_SECONDS = 1;

function CountUp({ score }: { score: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? score : 0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    if (reduced) {
      mv.set(score);
      return;
    }
    const controls = animate(mv, score, { duration: COUNT_UP_SECONDS, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, score, reduced]);
  return (
    <p className="flex items-baseline gap-2">
      <span className="sr-only">{fr.exam.result.scoreLabel(score)}</span>
      <motion.span aria-hidden="true" className="text-display text-ink tabular">
        {rounded}
      </motion.span>
      <span aria-hidden="true" className="text-heading text-ink-muted">
        {fr.exam.result.outOf}
      </span>
    </p>
  );
}

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
                    <span className="text-caption text-ink-muted">{fr.exam.result.expected} : </span>
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

// Hero: the score counting up. Passed: the certificate and its download; failed: try again or review.
function ResultContent({ state }: { state: ResultState }) {
  const navigate = useNavigate();
  const profile = useAppState((s) => s.profile);
  const xpTotal = useAppState((s) => s.snapshot?.xpTotal);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const passed = state.score >= EXAM_PASS;
  const pseudo = profile?.pseudo ?? "";
  const mention = state.mention === "presque" ? null : state.mention;
  const sections = sectionsOf(state.questions).map((s) => {
    const idx = state.questions.flatMap((q, i) => (q.section === s ? [i] : []));
    const sum = idx.reduce((acc, i) => acc + (state.results[i]?.skipped ? 0 : (state.results[i]?.score ?? 0)), 0);
    return { section: s, pct: idx.length === 0 ? 0 : Math.round((100 * sum) / idx.length) };
  });
  const certificate = passed && mention !== null && pseudo !== "" ? { pseudo, score: state.score, mention, dateIso: state.dateIso, noSpeaking: state.noSpeaking } : null;

  const download = async () => {
    if (!certificate) return;
    setDownloadFailed(false);
    const ok = await downloadCertificate(certificate).catch(() => false);
    if (!ok) setDownloadFailed(true);
  };

  return (
    <div className="relative flex flex-col gap-8 px-5 pb-10 pt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 text-gold [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="scales" />
      </div>
      <Confetti fire={passed} />

      <header className="relative flex flex-col gap-1">
        <p className="text-caption text-ink-muted">{passed ? fr.exam.result.passed : fr.exam.result.failed}</p>
        <CountUp score={state.score} />
        <h1 className="text-title text-ink">{fr.exam.result.mention[state.mention]}</h1>
        {state.xpGained > 0 ? (
          <div className="pt-2">
            <XpCounter value={xpTotal ?? state.xpGained} delta={state.xpGained} />
          </div>
        ) : null}
        {state.newBadges.length > 0 ? (
          <ul className="flex flex-wrap gap-5 pt-4">
            {state.newBadges.map((b) => (
              <li key={b.id}>
                <BadgeMedal icon={b.icon} title={b.title} unlocked />
              </li>
            ))}
          </ul>
        ) : null}
      </header>

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

      <section aria-label={fr.exam.result.sectionsLabel} className="flex flex-col gap-4">
        <h2 className="text-heading text-ink">{fr.exam.result.sectionsLabel}</h2>
        {sections.map(({ section, pct }) => (
          <div key={section} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-body-strong text-ink">{fr.exam.sections[section].fr}</span>
              <span className="text-caption text-ink-muted tabular">{pct} %</span>
            </div>
            <ProgressBar value={pct / 100} label={fr.exam.result.sectionAccuracy(fr.exam.sections[section].fr, pct)} />
          </div>
        ))}
      </section>

      <Corrections state={state} />

      <Button variant="ghost" fullWidth onClick={() => navigate("/", { replace: true })}>
        {fr.exam.result.home}
      </Button>
    </div>
  );
}

export function ExamResultScreen() {
  const { state } = useLocation() as { state: unknown };
  if (!isResultState(state)) return <Navigate to="/exam" replace />;
  return <ResultContent state={state} />;
}
