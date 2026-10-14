import { useState } from "react";
import { motion } from "motion/react";
import { VOICE_IDS, type Settings, type VoiceId } from "@/domain/types";
import { detectPlatform } from "@/domain/platform";
import { useDeviceTest, useSettings } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { ChangePasswordSheet } from "@/features/profile/ChangePasswordSheet";
import { Button, DeviceCheck, Icon, Sheet, tap, useToast } from "@/ui";

type SegmentedProps<T extends string> = { label: string; value: T; options: readonly { id: T; label: string }[]; onChange(v: T): void };

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-strong text-ink">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-md bg-surface-2 p-1">
        {options.map((o) => (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            whileTap={tap}
            onClick={() => onChange(o.id)}
            className={`min-h-11 flex-1 rounded-sm px-2 text-body-strong ${o.id === value ? "bg-surface text-ink shadow-card" : "text-ink-muted"}`}
          >
            {o.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

const PREVIEW_TEXT = "Xin chào bạn!"; // also listed in scripts/tts/extract_texts.mjs so every voice pack has it

function voiceLabel(id: VoiceId): string {
  const o = fr.profile.settings.voicePack.options[id];
  return `${o.prefix}${o.name}${o.suffix}`;
}

/** One radio per voice, each with its own preview button (previews never change the saved voice). */
function VoicePicker({ value, onChange }: { value: VoiceId; onChange(v: VoiceId): void }) {
  const { tts } = useServices();
  const toast = useToast();
  const t = fr.profile.settings.voicePack;

  function preview(id: VoiceId): void {
    // Straight from the click: iOS only starts audio inside a user gesture.
    tts.speak(PREVIEW_TEXT, { rate: 1, voice: id }).catch(() => toast.show({ title: t.previewError }));
  }

  return (
    <div className="flex flex-col gap-2">
      <p id="voice-pack-label" className="text-body-strong text-ink">
        {t.label}
      </p>
      <div role="radiogroup" aria-labelledby="voice-pack-label" className="flex flex-col gap-2">
        {VOICE_IDS.map((id) => {
          const o = t.options[id];
          const selected = id === value;
          return (
            <div key={id} className="flex items-stretch gap-2">
              <motion.button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-labelledby={`voice-opt-${id}`}
                whileTap={tap}
                onClick={() => onChange(id)}
                className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md border-2 px-3 text-left ${
                  selected ? "border-primary bg-surface shadow-card" : "border-line bg-surface-2"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-line"}`}
                >
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </span>
                <span id={`voice-opt-${id}`} className={`text-body-strong ${selected ? "text-ink" : "text-ink-muted"}`}>
                  {o.prefix}
                  {o.name ? <span lang="vi">{o.name}</span> : null}
                  {o.suffix}
                </span>
              </motion.button>
              <motion.button
                type="button"
                aria-label={t.preview(voiceLabel(id))}
                whileTap={tap}
                onClick={() => preview(id)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-line bg-surface text-ink"
              >
                <Icon name="play" size={20} />
              </motion.button>
            </div>
          );
        })}
      </div>
      <p className="text-caption text-ink-muted">{t.hint}</p>
    </div>
  );
}

function DeviceSheetBody() {
  const { result, busy, listening, testVoice, testMic } = useDeviceTest();
  return (
    <div className="max-h-[75dvh] overflow-y-auto">
      <h2 className="mb-3 text-heading text-ink">{fr.profile.settings.device.title}</h2>
      <DeviceCheck result={result} platform={detectPlatform(navigator.userAgent, navigator.maxTouchPoints)} onTestVoice={testVoice} onTestMic={testMic} busy={busy} listening={listening} />
    </div>
  );
}

export function SettingsSection({ onReport }: { onReport(): void }) {
  const { settings, updateSettings } = useSettings();
  const toast = useToast();
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const t = fr.profile.settings;

  function change(patch: Partial<Settings>): void {
    updateSettings(patch).catch(() => toast.show({ title: t.saveError }));
  }

  return (
    <section aria-labelledby="me-settings" className="flex flex-col gap-5">
      <h2 id="me-settings" className="text-heading text-ink">
        {t.title}
      </h2>
      <Segmented
        label={t.theme.label}
        value={settings.theme}
        onChange={(theme) => change({ theme })}
        options={[
          { id: "system", label: t.theme.system },
          { id: "light", label: t.theme.light },
          { id: "dark", label: t.theme.dark },
        ]}
      />
      <VoicePicker value={settings.voice} onChange={(voice) => change({ voice })} />
      <Segmented
        label={t.voice.label}
        value={settings.voiceRate}
        onChange={(voiceRate) => change({ voiceRate })}
        options={[
          { id: "normal", label: t.voice.normal },
          { id: "slow", label: t.voice.slow },
        ]}
      />
      <div className="flex flex-col gap-2">
        <Button variant="secondary" fullWidth onClick={() => setDeviceOpen(true)}>
          {t.device.open}
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setPasswordOpen(true)}>
          {t.password.open}
        </Button>
        <Button variant="secondary" fullWidth onClick={onReport}>
          {t.report}
        </Button>
      </div>
      <ChangePasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <Sheet open={deviceOpen} onClose={() => setDeviceOpen(false)} label={t.device.title}>
        {deviceOpen ? <DeviceSheetBody /> : null}
      </Sheet>
    </section>
  );
}
