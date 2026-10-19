import type { Env, Flags } from "@/domain/config";
import type { Capabilities, VoiceId } from "@/domain/types";
import type {
  AuthService, ContentReporter, ContentSource, ConversationEngine, EventSink, DuelGateway, ExamGateway, LeaderboardRepository,
  Outbox, ProgressRepository, SpeechRecognizer, SpeechSynthesizer, VoiceRecorder,
} from "@/ports";
import type { ActivityService } from "@/services/activity";
import type { SyncService } from "@/services/sync";

export type Services = {
  env: Env;
  flags: Flags;
  clock: () => string; // ISO "now"
  content: ContentSource;
  progress: ProgressRepository;
  outbox: Outbox;
  sink: EventSink;
  leaderboard: LeaderboardRepository;
  auth: AuthService;
  exam: ExamGateway;
  duels: DuelGateway;
  tts: SpeechSynthesizer;
  stt: SpeechRecognizer;
  recorder: VoiceRecorder;
  detectCapabilities: () => Promise<Capabilities>; // real implementation in T12 (waits for TTS voices)
  prefetchVoice: (voice: VoiceId) => Promise<{ done: number; total: number }>; // downloads a voice pack in the background
  conversation: ConversationEngine;
  reporter: ContentReporter;
  activity: ActivityService; // real implementation in T07
  sync: SyncService; // real implementation in T10
};
