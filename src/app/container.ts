import type { Env } from "@/domain/config";
import type { VoiceId } from "@/domain/types";
import type { DemoTools, Services } from "@/app/services";
import { flags } from "@/app/flags";
import { useAppState } from "@/app/appState";
import { createFakeServices, FakeAuthService, type FakeAuthOptions, FakeDuelGateway, FakeSoundPlayer, FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { TiengNhaDb, DexieProgressRepository, DexieOutbox, DexieReportQueue } from "@/adapters/dexie";
import { AudioPackSynthesizer, WebSpeechSynthesizer, WebSpeechRecognizer, MediaRecorderVoiceRecorder, createDetectCapabilities } from "@/adapters/speech";
import { WebAudioSoundPlayer } from "@/adapters/audio";
import { createStaticContentSource } from "@/adapters/content";
import { ScriptedConversationEngine } from "@/adapters/conversation";
import {
  createSupabase, SupabaseAuthService, SupabaseEventSink, SupabaseLeaderboardRepository, SupabaseExamGateway, SupabaseDuelGateway, SupabaseGachaGateway, SupabaseContentReporter,
} from "@/adapters/supabase";
import { createActivityService } from "@/services/activity";
import { createSyncService } from "@/services/sync";
import { createDemoTools } from "@/app/demoTools";
import { trackSpeaking } from "@/app/speakingTracker";
import type { SoundPlayer } from "@/ports";

type Remote = Pick<Services, "sink" | "auth" | "leaderboard" | "exam" | "duels" | "gacha" | "reporter">;

/** Site data may be blocked: reading `localStorage` can throw, so the demo falls back to in-memory duels. */
function demoStorage(): { duelStorage?: Storage; gachaStorage?: Storage } {
  try {
    return { duelStorage: window.localStorage, gachaStorage: window.localStorage };
  } catch {
    return {};
  }
}

/** Demo accounts live in localStorage (they survive a closed PWA) and accept any invite code. */
function demoAuthOptions(demo: boolean): FakeAuthOptions {
  if (!demo) return { persist: true };
  try {
    return { persist: true, storage: window.localStorage, anyInvite: true };
  } catch {
    return { persist: true, anyInvite: true };
  }
}

/** Fake speech (e2e) records sounds instead of playing them, and exposes them as `window.__sounds` for Playwright. */
function createSoundPlayer(env: Env, isVoiceBusy: () => boolean): SoundPlayer {
  if (!env.VITE_FAKE_SPEECH) return new WebAudioSoundPlayer({ isVoiceBusy });
  const fake = new FakeSoundPlayer(isVoiceBusy);
  if (env.VITE_USE_FAKES) Object.assign(window, { __sounds: fake });
  return fake;
}

/** Composition root: the only place that picks concrete adapters. */
export function createServices(env: Env): Services {
  const clock = () => new Date().toISOString();
  const db = new TiengNhaDb();
  const progress = new DexieProgressRepository(db);
  const outbox = new DexieOutbox(db);
  const content = createStaticContentSource();

  // Speech
  const voice = env.VITE_FAKE_SPEECH
    ? new FakeSpeechSynthesizer()
    : new AudioPackSynthesizer(new WebSpeechSynthesizer(), { getVoice: () => useAppState.getState().settings.voice });
  const stt = env.VITE_FAKE_SPEECH ? new FakeSpeechRecognizer() : new WebSpeechRecognizer();
  const recorder = env.VITE_FAKE_SPEECH ? new FakeVoiceRecorder() : new MediaRecorderVoiceRecorder();
  const detectCapabilities =
    voice instanceof AudioPackSynthesizer
      ? createDetectCapabilities(voice, stt, recorder)
      : async () => ({ tts: true, stt: true, recorder: true });
  const prefetchVoice = async (id: VoiceId) => (voice instanceof AudioPackSynthesizer ? voice.prefetchVoice(id) : { done: 0, total: 0 });
  // Everything speaks through the tracked voice, so sound effects know when to stay under it.
  // A cue already sounding when the voice starts ducks under it (and swells back after): the player is built after the tracker.
  let onVoiceChange: (speaking: boolean) => void = () => undefined;
  const tts = trackSpeaking(voice, (speaking) => onVoiceChange(speaking));
  const sound = createSoundPlayer(env, tts.isSpeaking);
  // e2e only: lets a spec keep the fake voice "speaking" (`__voice.delayMs`, then `__tts.speak(...)`).
  if (env.VITE_FAKE_SPEECH && env.VITE_USE_FAKES) Object.assign(window, { __voice: voice, __tts: tts });
  if (sound instanceof WebAudioSoundPlayer) onVoiceChange = (speaking) => sound.setVoiceBusy(speaking);

  // Remote (fake or Supabase)
  let remote: Remote;
  if (env.VITE_USE_FAKES) {
    const f = createFakeServices({ clock, progress, auth: new FakeAuthService(demoAuthOptions(env.VITE_DEMO)) }, env.VITE_DEMO ? demoStorage() : {});
    remote = { sink: f.sink, auth: f.auth, leaderboard: f.leaderboard, exam: f.exam, duels: f.duels, gacha: f.gacha, reporter: f.reporter };
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
      gacha: new SupabaseGachaGateway(sb),
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
    env, flags, clock, content, progress, outbox, ...remote, tts, sound, stt, recorder, detectCapabilities, prefetchVoice,
    conversation: new ScriptedConversationEngine(content), activity, sync, ...(demo ? { demo } : {}),
  };
}
