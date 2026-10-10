import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/adapters/supabase/types.gen";

export type Db = SupabaseClient<Database>;
export function createSupabase(url: string, anonKey: string): Db {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
}
