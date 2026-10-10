import type { Session as SbSession } from "@supabase/supabase-js";
import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import { NotAuthenticatedError, OfflineError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import type { AuthService } from "@/ports";

function toSession(s: SbSession | null): Session | null {
  return s ? { userId: s.user.id, email: s.user.email ?? "" } : null;
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly db: Db) {}

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.db.auth.getSession();
    if (error) throw mapError(error);
    return toSession(data.session);
  }

  onChange(cb: (s: Session | null) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((_event, s) => cb(toSession(s)));
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
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.db.rpc("delete_my_account");
    if (error) throw mapError(error);
    await this.db.auth.signOut();
  }
}
