import { useState } from "react";
import type { Capabilities } from "@/domain/types";
import { useServices } from "@/app/ServicesProvider";
import { useSettings } from "@/app/appState";
import { fr } from "@/i18n/fr";
import { Button, DeviceCheck } from "@/ui";

export function detectPlatform(userAgent: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

export function DeviceStep({ onNext }: { onNext(): void }) {
  const { tts, stt, detectCapabilities } = useServices();
  const { settings, updateSettings } = useSettings();
  const t = fr.onboarding.device;
  const [result, setResult] = useState<Capabilities | null>(settings.capabilities);
  const [busy, setBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);

  async function refresh(): Promise<void> {
    const caps = await detectCapabilities();
    setResult(caps);
    await updateSettings({ capabilities: caps });
  }

  // Called straight from the click handler: iOS only starts speech synthesis inside a user gesture.
  async function testVoice(): Promise<void> {
    setBusy(true);
    try {
      await tts.speak("Xin chào!", { rate: 1 });
    } catch {
      // A failed test voice is reported by the detection below.
    }
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function testMic(): Promise<void> {
    setBusy(true);
    try {
      await stt.listen({ lang: "vi-VN", timeoutMs: 6000 });
    } catch {
      // Denied, silent or unsupported: the detection below shows what works.
    }
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function next(): Promise<void> {
    setContinuing(true);
    try {
      if (!result) await refresh();
    } finally {
      setContinuing(false);
    }
    onNext();
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-title text-ink">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.lead}</p>
      <DeviceCheck
        result={result}
        platform={detectPlatform(navigator.userAgent)}
        onTestVoice={testVoice}
        onTestMic={testMic}
        busy={busy}
      />
      <Button size="lg" fullWidth loading={continuing} disabled={busy} onClick={() => void next()}>
        {t.next}
      </Button>
    </section>
  );
}
