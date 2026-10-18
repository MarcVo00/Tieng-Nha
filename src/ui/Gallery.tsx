import { useState, type ReactNode } from "react";
import { MemoryRouter, useInRouterContext } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { TONES } from "@/domain/tones";
import type { Look, Tone } from "@/domain/types";

import {
  Avatar, BadgeMedal, Button, Card, Character, Confetti, ConfirmDialog, EmptyState, FeedbackSheet, FocusHeader, Hearts, Icon, MicButton, Motif,
  ProgressBar, ReportButton, Sheet, Skeleton, SpeakerButton, StreakFlame, TabBar, ToastViewport, ToneButton, ToneMark, useToast, XpCounter,
  type IconName,
} from "@/ui";

const g = fr.ui.gallery;
const FULL_LOOK: Look = { hat: "hat_thuy_tinh", outfit: "outfit_son_tinh", accessory: "acc_thuan_thien", aura: "aura_waves" };
const ICONS: IconName[] = [
  "home", "review", "trophy", "user", "close", "check", "cross", "speaker", "turtle", "mic", "stop", "flag",
  "chevron-right", "chevron-left", "lock", "star", "flame", "refresh", "settings", "share", "download", "chat", "play",
];
const TABS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/", label: "Học", icon: "home" },
  { to: "/on", label: "Ôn", icon: "review" },
  { to: "/hang", label: "Hạng", icon: "trophy" },
  { to: "/ban", label: "Bạn", icon: "user" },
];
const VI_SAMPLES = ["Cà phê sữa đá", "Bao nhiêu tiền?", g.longVi];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ dark }: { dark: boolean }) {
  const [sheet, setSheet] = useState(false);
  const [fb, setFb] = useState<"ok" | "ko" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [xp, setXp] = useState({ value: 120, delta: 0 });
  const [tone, setTone] = useState<Tone>("sac");
  const [mic, setMic] = useState<"idle" | "listening" | "processing">("idle");
  const { show } = useToast();
  const noop = () => undefined;

  return (
    <div className={`${dark ? "dark" : ""} relative flex-1 overflow-hidden`} style={{ minWidth: 340 }}>
      <div className="relative flex flex-col gap-8 bg-bg px-5 pb-32 pt-6 text-ink">
        <div className="absolute inset-0 text-gold">
          <Motif kind="waves" />
        </div>
        <h1 className="relative text-title">{dark ? g.dark : g.light}</h1>

        <Section title={g.buttons}>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{VI_SAMPLES[0]}</Button>
            <Button variant="secondary">{VI_SAMPLES[1]}</Button>
            <Button variant="ghost">{g.cancelLabel}</Button>
            <Button variant="danger">{g.confirmLabel}</Button>
            <Button loading>{g.confirmLabel}</Button>
            <Button disabled>{g.cancelLabel}</Button>
          </div>
          <Button size="lg" fullWidth>
            {VI_SAMPLES[0]}
          </Button>
          <div className="flex flex-wrap gap-3 text-ink">
            {ICONS.map((n) => (
              <span key={n} className={n === "flame" ? "text-streak" : ""}>
                <Icon name={n} />
              </span>
            ))}
          </div>
        </Section>

        <Section title={g.cards}>
          <Card className="p-4">
            <p lang="vi" className="text-display text-ink">
              {VI_SAMPLES[0]}
            </p>
            <p className="text-caption text-ink-muted">{g.sampleBody}</p>
          </Card>
          <Card raised className="p-4">
            <p lang="vi" className="text-heading text-ink">
              {VI_SAMPLES[2]}
            </p>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSheet(true)}>{g.openSheet}</Button>
            <Button variant="secondary" onClick={() => setFb("ok")}>{g.openFeedbackOk}</Button>
            <Button variant="secondary" onClick={() => setFb("ko")}>{g.openFeedbackKo}</Button>
            <Button variant="secondary" onClick={() => setConfirm(true)}>{g.openConfirm}</Button>
          </div>
        </Section>

        <Section title={g.progress}>
          <FocusHeader progress={0.6} onClose={noop} closeLabel={fr.ui.close} right={<Hearts count={2} max={3} />} />
          <ProgressBar value={0.35} label={fr.ui.progress.label} />
          <div className="flex flex-wrap items-center gap-5">
            <Hearts count={3} max={3} />
            <Hearts count={1} max={3} />
            <StreakFlame days={7} />
            <StreakFlame days={0} size="sm" />
            <Avatar emoji="🦊" ring="gold" />
            <Avatar emoji="🐼" size="sm" />
            <Avatar emoji="🐲" size="lg" ring="primary" />
          </div>
          <div className="flex flex-wrap items-center gap-10 py-6">
            <Avatar emoji="🦊" fx="fx_ink" />
            <Avatar emoji="🐼" fx="fx_lightning" frame="frame_son_mai" />
            <Avatar emoji="🐲" fx="fx_embers" frame="frame_jade" />
            <Avatar emoji="🦊" size="lg" fx="fx_ink" frame="frame_bronze" />
            <Avatar emoji="🐼" size="lg" fx="fx_lightning" />
            <Avatar emoji="🐲" size="lg" fx="fx_embers" frame="frame_son_mai" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <XpCounter value={xp.value} delta={xp.delta} />
            <Button variant="secondary" onClick={() => setXp((s) => ({ value: s.value + 15, delta: 15 }))}>{g.xpGain}</Button>
            <Button variant="secondary" onClick={() => { setConfetti(false); setTimeout(() => setConfetti(true), 0); }}>{g.confetti}</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <BadgeMedal icon="☕" title={g.badgeTitle} unlocked />
            <BadgeMedal icon="☕" title={g.badgeTitle} unlocked={false} />
            <BadgeMedal icon="☕" title={g.badgeTitle} unlocked size="lg" reward={g.badgeReward} />
          </div>
          <div className="relative h-24"><Confetti fire={confetti} /></div>
        </Section>

        <Section title={g.hero}>
          <div className="flex flex-wrap items-end gap-4">
            {([{}, { hat: "hat_thuy_tinh" }, { outfit: "outfit_son_tinh" }, { accessory: "acc_thuan_thien" }, { aura: "aura_waves" }, FULL_LOOK] as Look[]).map((look, i) => (
              <span key={i} className="rounded-card bg-paper p-2"><Character look={look} size={160} /></span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-10 py-6">
            <Avatar emoji="🦊" look={{}} size="sm" />
            <Avatar emoji="🦊" look={FULL_LOOK} frame="frame_jade" />
            <Avatar emoji="🦊" look={FULL_LOOK} size="lg" frame="frame_son_mai" fx="fx_embers" />
            <Avatar emoji="🦊" look={{ hat: "hat_thuy_tinh" }} size="lg" fx="fx_ink" />
          </div>
        </Section>

        <Section title={g.tones}>
          <div className="flex flex-wrap gap-3">
            {TONES.map((t) => (
              <ToneMark key={t} tone={t} showName />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TONES.map((t) => (
              <ToneButton key={t} tone={t} selected={tone === t} onClick={() => setTone(t)} state={t === "nga" && tone === "nga" ? "correct" : t === "nang" && tone === "nang" ? "wrong" : "idle"} />
            ))}
          </div>
        </Section>

        <Section title={g.audio}>
          <div className="flex flex-wrap items-end gap-6">
            <SpeakerButton onSpeak={noop} onSpeakSlow={noop} />
            <SpeakerButton onSpeak={noop} size="xl" playing />
            <SpeakerButton onSpeak={noop} disabled disabledReason={fr.ui.mic.processing} />
            <MicButton state={mic} onPress={() => setMic((m) => (m === "idle" ? "listening" : m === "listening" ? "processing" : "idle"))} label={fr.ui.mic.idle} />
            <ReportButton onClick={noop} />
          </div>
        </Section>

        <Section title={g.feedback}>
          <Button variant="secondary" onClick={() => show({ title: g.toastTitle, body: g.toastBody, icon: "☕" })}>{g.toast}</Button>
          <TabBarPreview />
        </Section>

        <Section title={g.misc}>
          <Skeleton lines={3} className="w-full" />
          <Card className="overflow-hidden">
            <EmptyState title={g.emptyTitle} body={g.emptyBody} illustration="bowl" action={<Button variant="secondary">{g.cancelLabel}</Button>} />
          </Card>
          <div className="flex gap-2">
            <Card className="flex-1"><EmptyState title={g.emptyTitle} illustration="lantern" /></Card>
            <Card className="flex-1"><EmptyState title={g.emptyTitle} illustration="boat" /></Card>
          </div>
        </Section>

        <Sheet open={sheet} onClose={() => setSheet(false)} label={g.sheetLabel}>
          <p className="text-body text-ink">{g.sampleBody}</p>
        </Sheet>
        <FeedbackSheet open={fb !== null} correct={fb === "ok"} expected={VI_SAMPLES[1] ?? ""} {...(fb === "ko" && VI_SAMPLES[0] ? { heard: VI_SAMPLES[0] } : {})} onSpeak={noop} onReport={noop} onContinue={() => setFb(null)} />
        <ConfirmDialog open={confirm} title={g.confirmTitle} body={g.confirmBody} confirmLabel={g.confirmLabel} cancelLabel={g.cancelLabel} requireText={g.confirmText} danger onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
      </div>
    </div>
  );
}

// TabBar is `fixed`; a transform on the wrapper makes it position relative to the preview box.
function TabBarPreview() {
  // Under the app router (route /__ui) a second Router would throw; reuse the existing context.
  const inRouter = useInRouterContext();
  const bar = <TabBar items={TABS} />;
  return (
    <div className="relative h-16 overflow-hidden rounded-md border border-line [transform:translateZ(0)]">
      {inRouter ? bar : <MemoryRouter>{bar}</MemoryRouter>}
    </div>
  );
}

export function Gallery() {
  return (
    <div className="flex flex-col">
      <header className="bg-bg px-5 py-4 text-title text-ink">{g.title}</header>
      <div className="flex flex-wrap">
        <Panel dark={false} />
        <Panel dark />
      </div>
      <ToastViewport />
    </div>
  );
}
