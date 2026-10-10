import { useState } from "react";
import { motion } from "motion/react";
import type { Capabilities, Settings } from "@/domain/types";
import { useSettings } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, DeviceCheck, Sheet, tap, useToast } from "@/ui";

function platformOf(userAgent: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1) return "ios";
  return "other";
}

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

// Same wiring as the onboarding device step: detection and persistence are best-effort.
function DeviceSheetBody() {
  const { tts, stt, detectCapabilities } = useServices();
  const { settings, updateSettings } = useSettings();
  const [result, setResult] = useState<Capabilities | null>(settings.capabilities);
  const [busy, setBusy] = useState<"voice" | "mic" | null>(null);

  async function refresh(): Promise<void> {
    try {
      const caps = await detectCapabilities();
      setResult(caps);
      await updateSettings({ capabilities: caps });
    } catch {
      // Keep whatever result is already shown.
    }
  }

  // Called straight from the click handler: iOS only starts speech synthesis inside a user gesture.
  async function testVoice(): Promise<void> {
    setBusy("voice");
    try {
      await tts.speak("Xin chào!", { rate: 1 });
    } catch {
      // Reported by the detection below.
    }
    await refresh();
    setBusy(null);
  }

  async function testMic(): Promise<void> {
    setBusy("mic");
    try {
      await stt.listen({ lang: "vi-VN", timeoutMs: 6000 });
    } catch {
      // Denied, silent or unsupported: the detection below shows what works.
    }
    await refresh();
    setBusy(null);
  }

  return (
    <div className="max-h-[75dvh] overflow-y-auto">
      <h2 className="mb-3 text-heading text-ink">{fr.profile.settings.device.title}</h2>
      <DeviceCheck result={result} platform={platformOf(navigator.userAgent)} onTestVoice={testVoice} onTestMic={testMic} busy={busy !== null} listening={busy === "mic"} />
    </div>
  );
}

export function SettingsSection({ onReport }: { onReport(): void }) {
  const { settings, updateSettings } = useSettings();
  const toast = useToast();
  const [deviceOpen, setDeviceOpen] = useState(false);
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
        <Button variant="secondary" fullWidth onClick={onReport}>
          {t.report}
        </Button>
      </div>
      <Sheet open={deviceOpen} onClose={() => setDeviceOpen(false)} label={t.device.title}>
        {deviceOpen ? <DeviceSheetBody /> : null}
      </Sheet>
    </section>
  );
}
