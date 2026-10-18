import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppState, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Boss } from "@/domain/types";
import { fr } from "@/i18n/fr";
import {
  BadgeMedal,
  rewardProp,
  Button,
  Certificate,
  Confetti,
  downloadCertificate,
  Hearts,
  Icon,
  Motif,
  SpeakerButton,
  XpCounter,
} from "@/ui";
import { BossPortrait } from "@/features/exam/BossPortrait";
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

// Hero: the boss portrait and the won/lost headline. Victory is the earned-gold moment (mention, confetti, certificate);
// defeat shows the damage dealt, then retry or review.
function ResultContent({ state }: { state: ResultState }) {
  const navigate = useNavigate();
  const profile = useAppState((s) => s.profile);
  const xpTotal = useAppState((s) => s.snapshot?.xpTotal);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const { boss } = state;
  const won = boss.won;
  const pseudo = profile?.pseudo ?? "";
  const mention = state.mention === "presque" ? null : state.mention;
  const certificate = won && mention !== null && pseudo !== "" ? { pseudo, score: state.score, mention, dateIso: state.dateIso, noSpeaking: state.noSpeaking } : null;
  // The result state carries no legend/pool: the portrait only needs the identity and the art.
  const portraitBoss: Boss = { id: boss.id, name: boss.name, title: boss.title, legend: "", illustration: boss.illustration, hp: boss.hp, playerLives: boss.playerLives, pool: "exam" };

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
      <Confetti fire={won} />

      <header className="relative flex flex-col items-center gap-4 text-center">
        <BossPortrait boss={portraitBoss} size={160} hits={0} defeated={won} />
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
        {state.xpGained > 0 ? <XpCounter value={xpTotal ?? state.xpGained} delta={state.xpGained} /> : null}
        {(state.coinsGained ?? 0) > 0 ? (
          <p className="flex items-center gap-1 text-body-strong text-gold-ink tabular">
            <Icon name="coin" size={20} />
            {fr.shop.gained(state.coinsGained ?? 0)}
          </p>
        ) : null}
        {state.newBadges.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-5 pt-2">
            {state.newBadges.map((b) => (
              <li key={b.id}>
                <BadgeMedal icon={b.icon} title={b.title} unlocked {...rewardProp(b)} />
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
