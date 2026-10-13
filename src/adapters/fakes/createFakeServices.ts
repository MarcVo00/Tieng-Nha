import type { Services } from "@/app/services";
import badgesFile from "@/content/badges.json";
import { BadgesFileSchema } from "@/content/schema";
import { lessonFixture } from "@/adapters/fakes/seed/lesson";
import { dialogueFixture } from "@/adapters/fakes/seed/dialogue";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { InMemoryContentSource } from "@/adapters/fakes/InMemoryContentSource";
import { InMemoryProgressRepository } from "@/adapters/fakes/InMemoryProgressRepository";
import { InMemoryOutbox } from "@/adapters/fakes/InMemoryOutbox";
import { FakeEventSink } from "@/adapters/fakes/FakeEventSink";
import { FakeAuthService } from "@/adapters/fakes/FakeAuthService";
import { FakeLeaderboardRepository } from "@/adapters/fakes/FakeLeaderboardRepository";
import { FakeExamGateway } from "@/adapters/fakes/FakeExamGateway";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes/FakeSpeech";
import { FakeContentReporter } from "@/adapters/fakes/FakeContentReporter";
import { ScriptedConversationEngine } from "@/adapters/conversation";
import { createActivityService } from "@/services/activity";
import { createSyncService } from "@/services/sync";

export function createFakeServices(overrides: Partial<Services> = {}): Services {
  // Dependent fakes are built from the overridden instances so callers can inject e.g. a Dexie-backed progress repo.
  const clock = overrides.clock ?? (() => new Date().toISOString());
  const progress = overrides.progress ?? new InMemoryProgressRepository();
  const outbox = overrides.outbox ?? new InMemoryOutbox();
  const sink = overrides.sink ?? new FakeEventSink();
  const content =
    overrides.content ??
    new InMemoryContentSource([lessonFixture], [dialogueFixture], examPoolFixture, BadgesFileSchema.parse(badgesFile).badges);
  const sync = createSyncService({ outbox, sink });
  const auth = overrides.auth ?? new FakeAuthService();
  // The player's own row follows the profile chosen during onboarding (falls back to a fixed persona before it exists).
  const me = async () => {
    const profile = await auth.getMyProfile();
    return { userId: "me", pseudo: profile?.pseudo ?? "Moi", avatarEmoji: profile?.avatarEmoji ?? "🐉" };
  };
  const base: Services = {
    env: { VITE_WELCOME_MESSAGE: "", VITE_USE_FAKES: true, VITE_FAKE_SPEECH: true },
    flags: { aiConversation: false, streakFreeze: false, humanAudio: false },
    clock,
    content,
    progress,
    outbox,
    sink,
    leaderboard: new FakeLeaderboardRepository(() => progress.listEvents(), me, clock),
    auth,
    exam: new FakeExamGateway(clock),
    tts: new FakeSpeechSynthesizer(),
    stt: new FakeSpeechRecognizer(),
    recorder: new FakeVoiceRecorder(),
    detectCapabilities: async () => ({ tts: true, stt: true, recorder: true }),
    prefetchVoice: async () => ({ done: 0, total: 0 }),
    conversation: new ScriptedConversationEngine(content),
    reporter: new FakeContentReporter(),
    activity: createActivityService({ progress, outbox, content, clock, onEventAppended: () => sync.notifyEnqueued() }),
    sync,
  };
  return { ...base, ...overrides };
}
