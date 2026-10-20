import type { Env } from "@/domain/config";
import type { VoiceId } from "@/domain/types";
import type { DemoTools, Services } from "@/app/services";
import { flags } from "@/app/flags";
import { useAppState } from "@/app/appState";
import { createFakeServices, FakeAuthService, FakeDuelGateway, FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { TiengNhaDb, DexieProgressRepository, DexieOutbox, DexieReportQueue } from "@/adapters/dexie";
import { AudioPackSynthesizer, WebSpeechSynthesizer, WebSpeechRecognizer, MediaRecorderVoiceRecorder, createDetectCapabilities } from "@/adapters/speech";
import { createStaticContentSource } from "@/adapters/content";
import { ScriptedConversationEngine } from "@/adapters/conversation";
import {
  createSupabase, SupabaseAuthService, SupabaseEventSink, SupabaseLeaderboardRepository, SupabaseExamGateway, SupabaseDuelGateway, SupabaseContentReporter,
} from "@/adapters/supabase";
import { createActivityService } from "@/services/activity";
import { createSyncService } from "@/services/sync";
import { createDemoTools } from "@/app/demoTools";

type Remote = Pick<Services, "sink" | "auth" | "leaderboard" | "exam" | "duels" | "reporter">;

/** Site data may be blocked: reading `localStorage` can throw, so the demo falls back to in-memory duels. */
function demoStorage(): { duelStorage?: Storage } {
  try {
    return { duelStorage: window.localStorage };
  } catch {
    return {};
  }
}

/** Composition root: the only place that picks concrete adapters. */
export function createServices(env: Env): Services {
  const clock = () => new Date().toISOString();
  const db = new TiengNhaDb();
  const progress = new DexieProgressRepository(db);
  const outbox = new DexieOutbox(db);
  const content = createStaticContentSource();

  // Speech
  const tts = env.VITE_FAKE_SPEECH
    ? new FakeSpeechSynthesizer()
    : new AudioPackSynthesizer(new WebSpeechSynthesizer(), { getVoice: () => useAppState.getState().settings.voice });
  const stt = env.VITE_FAKE_SPEECH ? new FakeSpeechRecognizer() : new WebSpeechRecognizer();
  const recorder = env.VITE_FAKE_SPEECH ? new FakeVoiceRecorder() : new MediaRecorderVoiceRecorder();
  const detectCapabilities =
    tts instanceof AudioPackSynthesizer
      ? createDetectCapabilities(tts, stt, recorder)
      : async () => ({ tts: true, stt: true, recorder: true });
  const prefetchVoice = async (voice: VoiceId) => (tts instanceof AudioPackSynthesizer ? tts.prefetchVoice(voice) : { done: 0, total: 0 });

  // Remote (fake or Supabase)
  let remote: Remote;
  if (env.VITE_USE_FAKES) {
    const f = createFakeServices({ clock, progress, auth: new FakeAuthService(true) }, env.VITE_DEMO ? demoStorage() : {});
    remote = { sink: f.sink, auth: f.auth, leaderboard: f.leaderboard, exam: f.exam, duels: f.duels, reporter: f.reporter };
  } else {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env missing");
    const sb = createSupabase(url, key);
    const reporter = new SupabaseContentReporter(sb, new DexieReportQueue(db));
    reporter.flushReports().catch((e: unknown) => {
      console.warn("Could not flush queued content reports", e);
    });
    remote = {
      sink: new SupabaseEventSink(sb),
      auth: new SupabaseAuthService(sb),
      leaderboard: new SupabaseLeaderboardRepository(sb),
      exam: new SupabaseExamGateway(sb),
      duels: new SupabaseDuelGateway(sb),
      reporter,
    };
  }

  const sync = createSyncService({ outbox, sink: remote.sink });
  const activity = createActivityService({ progress, outbox, content, clock, onEventAppended: () => sync.notifyEnqueued() });

  const demo: DemoTools | undefined =
    env.VITE_DEMO && env.VITE_USE_FAKES && remote.duels instanceof FakeDuelGateway
      ? createDemoTools({ duels: remote.duels, activity, content })
      : undefined;

  return {
    env, flags, clock, content, progress, outbox, ...remote, tts, stt, recorder, detectCapabilities, prefetchVoice,
    conversation: new ScriptedConversationEngine(content), activity, sync, ...(demo ? { demo } : {}),
  };
}
