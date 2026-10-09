export type Env = {
  VITE_SUPABASE_URL?: string | undefined;
  VITE_SUPABASE_ANON_KEY?: string | undefined;
  VITE_WELCOME_MESSAGE: string;
  VITE_USE_FAKES: boolean;
  VITE_FAKE_SPEECH: boolean;
};
export type Flags = { aiConversation: boolean; streakFreeze: boolean; humanAudio: boolean };
