import { useState } from "react";
import { useRefreshProgress } from "@/app/appState";
import { SOUND_CUES } from "@/domain/sound";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, Card, useToast } from "@/ui";

const UNLOCK_LESSONS = ["l01", "l02", "l03"] as const;
const UNLOCK_DIALOGUE = "d01";

// Hierarchy: a quiet test-tools card for the demo build only; four equal secondary actions, no primary.
export function DemoPanel() {
  const { env, demo, activity, content, sound } = useServices();
  const refresh = useRefreshProgress();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!env.VITE_DEMO || !demo) return null;
  const t = fr.demo.toast;

  async function run(action: () => Promise<string>): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      toast.show({ title: await action() });
      await refresh();
    } catch {
      toast.show({ title: t.error });
    } finally {
      setBusy(false);
    }
  }

  async function grant(coins: number, kimBai: number, message: string): Promise<string> {
    await activity.demoGrant(coins, kimBai);
    return message;
  }

  async function challenge(): Promise<string> {
    return (await demo?.receiveChallenge()) ? t.challenge : t.noChallenge;
  }

  // Same events as really finishing the lessons and the dialogue (first time only).
  async function unlockDuels(): Promise<string> {
    const snap = await activity.getSnapshot();
    let changed = false;
    for (const id of UNLOCK_LESSONS) {
      if (snap.lessonsDone.includes(id)) continue;
      const lesson = await content.getLesson(id).catch(() => null);
      const vocabIds = lesson ? lesson.vocab.filter((v) => !v.deprecated).map((v) => v.id) : [];
      await activity.completeLesson({ lessonId: id, mistakes: 0, durationMs: 60_000, vocabIds });
      changed = true;
    }
    if (!snap.dialoguesDone.includes(UNLOCK_DIALOGUE)) {
      await activity.completeDialogue({ dialogueId: UNLOCK_DIALOGUE, durationMs: 60_000 });
      changed = true;
    }
    return changed ? t.unlocked : t.alreadyUnlocked;
  }

  return (
    <section aria-labelledby="me-demo" className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 id="me-demo" className="text-heading text-ink">
            {fr.demo.title}
          </h2>
          <p className="text-caption text-ink-muted">{fr.demo.hint}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => grant(500, 0, t.coins))}>
            {fr.demo.coins}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => grant(0, 20, t.kimBai))}>
            {fr.demo.kimBai}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void run(unlockDuels)}>
            {fr.demo.unlock}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void run(challenge)}>
            {fr.demo.challenge}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <h3 id="me-demo-sounds" className="text-body-strong text-ink">
            {fr.demo.sounds}
          </h3>
          <div role="group" aria-labelledby="me-demo-sounds" className="grid grid-cols-2 gap-2">
            {SOUND_CUES.map((cue) => (
              <Button
                key={cue}
                variant="secondary"
                onClick={() => {
                  sound.unlock(); // this tap is the gesture that wakes the audio on iOS
                  sound.play(cue);
                }}
              >
                {cue}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
