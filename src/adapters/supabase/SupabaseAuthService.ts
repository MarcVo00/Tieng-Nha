import type { Session as SbSession } from "@supabase/supabase-js";
import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import { NotAuthenticatedError, OfflineError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import type { AuthEvent, AuthService } from "@/ports";
import { clearCachedSession, readCachedSession, writeCachedSession } from "@/domain/sessionCache";

function toSession(s: SbSession | null): Session | null {
  return s ? { userId: s.user.id, email: s.user.email ?? "" } : null;
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly db: Db) {}

  async getSession(): Promise<Session | null> {
    let result: Awaited<ReturnType<Db["auth"]["getSession"]>>;
    try {
      result = await this.db.auth.getSession();
    } catch (e) {
      result = { data: { session: null }, error: e as never };
    }
    const { data, error } = result;
    if (error) {
      const mapped = mapError(error);
      // An expired token that cannot refresh (offline or server outage) is not a sign-out: keep the last known identity.
      if (mapped instanceof OfflineError || error.name === "AuthRetryableFetchError") {
        const cached = readCachedSession();
        if (cached) return cached;
      }
      throw mapped;
    }
    const session = toSession(data.session);
    if (session) writeCachedSession(session);
    else clearCachedSession(); // A definitive "no session" (no error): never resurrect it offline later.
    return session;
  }

  onChange(cb: (s: Session | null, event?: AuthEvent) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((event, s) => {
      const session = toSession(s);
      if (session) writeCachedSession(session);
      else if (event === "SIGNED_OUT") clearCachedSession();
      cb(session, event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "USER_UPDATED" ? event : undefined);
    });
    return () => data.subscription.unsubscribe();
  }

  async requestOtp(email: string): Promise<void> {
    const { error } = await this.db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw mapError(error);
  }

  async verifyOtp(email: string, token: string): Promise<Session> {
    const { data, error } = await this.db.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      const mapped = mapError(error);
      if (mapped instanceof OfflineError) throw mapped;
      throw new Error("invalid_otp");
    }
    const session = toSession(data.session);
    if (!session) throw new Error("invalid_otp");
    writeCachedSession(session);
    return session;
  }

  private async uid(): Promise<string> {
    const { data, error } = await this.db.auth.getUser();
    if (error) throw mapError(error);
    if (!data.user) throw new NotAuthenticatedError();
    return data.user.id;
  }

  async hasProfile(): Promise<boolean> {
    const uid = await this.uid();
    const { data, error } = await this.db.from("profiles").select("id").eq("id", uid).maybeSingle();
    if (error) throw mapError(error);
    return data !== null;
  }

  async joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void> {
    const { error } = await this.db.rpc("join_group", { p_invite_code: inviteCode, p_pseudo: pseudo, p_avatar: avatarEmoji });
    if (error) throw mapError(error);
  }

  async getMyProfile(): Promise<{ pseudo: string; avatarEmoji: string } | null> {
    const uid = await this.uid();
    const { data, error } = await this.db.from("profiles").select("pseudo, avatar_emoji").eq("id", uid).maybeSingle();
    if (error) throw mapError(error);
    return data ? { pseudo: data.pseudo, avatarEmoji: data.avatar_emoji } : null;
  }

  async updateProfile(p: { pseudo: string; avatarEmoji: string }): Promise<void> {
    const uid = await this.uid();
    const { error } = await this.db.from("profiles").update({ pseudo: p.pseudo, avatar_emoji: p.avatarEmoji }).eq("id", uid);
    if (error) throw mapError(error);
  }

  async signOut(): Promise<void> {
    const { error } = await this.db.auth.signOut();
    if (error) throw mapError(error);
    clearCachedSession();
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.db.rpc("delete_my_account");
    if (error) throw mapError(error);
    await this.db.auth.signOut();
    clearCachedSession();
  }
}
