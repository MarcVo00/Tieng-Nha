import { useState } from "react";
import type { Capabilities } from "@/domain/types";
import { useServices } from "@/app/ServicesProvider";
import { useSettings } from "@/app/appState";
import { fr } from "@/i18n/fr";
import { Button, DeviceCheck } from "@/ui";

export function detectPlatform(userAgent: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  // iPadOS 13+ reports itself as a Mac; only touch distinguishes it.
  if (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1) return "ios";
  return "other";
}

export function DeviceStep({ onNext }: { onNext(): void }) {
  const { tts, stt, detectCapabilities } = useServices();
  const { settings, updateSettings } = useSettings();
  const t = fr.onboarding.device;
  const [result, setResult] = useState<Capabilities | null>(settings.capabilities);
  const [busy, setBusy] = useState<"voice" | "mic" | null>(null);
  const [continuing, setContinuing] = useState(false);

  // Detection and persistence are best-effort: a failure here never blocks the user.
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
      // A failed test voice is reported by the detection below.
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

  async function next(): Promise<void> {
    setContinuing(true);
    if (!result) await refresh();
    setContinuing(false);
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
        busy={busy !== null}
        listening={busy === "mic"}
      />
      <Button size="lg" fullWidth loading={continuing} disabled={busy !== null} onClick={() => void next()}>
        {t.next}
      </Button>
    </section>
  );
}
