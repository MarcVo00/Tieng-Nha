import { useState } from "react";
import { detectPlatform } from "@/domain/platform";
import { useDeviceTest } from "@/app/appState";
import { fr } from "@/i18n/fr";
import { Button, DeviceCheck } from "@/ui";

export function DeviceStep({ onNext }: { onNext(): void }) {
  const { result, busy, listening, testVoice, testMic, refresh } = useDeviceTest();
  const t = fr.onboarding.device;
  const [continuing, setContinuing] = useState(false);

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
        platform={detectPlatform(navigator.userAgent, navigator.maxTouchPoints)}
        onTestVoice={testVoice}
        onTestMic={testMic}
        busy={busy}
        listening={listening}
      />
      <Button size="lg" fullWidth loading={continuing} disabled={busy} onClick={() => void next()}>
        {t.next}
      </Button>
    </section>
  );
}
