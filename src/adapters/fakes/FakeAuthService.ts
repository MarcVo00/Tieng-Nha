import { InvalidInviteError, NotAuthenticatedError, PseudoTakenError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import type { AuthService } from "@/ports";

type Profile = { pseudo: string; avatarEmoji: string };

export class FakeAuthService implements AuthService {
  otpRequests: string[] = [];
  private session: Session | null = null;
  private profile: Profile | null = null;
  private listeners = new Set<(s: Session | null) => void>();

  private setSession(s: Session | null): void {
    this.session = s;
    for (const cb of this.listeners) cb(s);
  }

  private requireSession(): Session {
    if (!this.session) throw new NotAuthenticatedError();
    return this.session;
  }

  async getSession(): Promise<Session | null> {
    return this.session;
  }

  onChange(cb: (s: Session | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async requestOtp(email: string): Promise<void> {
    this.otpRequests.push(email);
  }

  async verifyOtp(email: string, token: string): Promise<Session> {
    if (token !== "123456") throw new Error("invalid_otp");
    const s: Session = { userId: "me", email };
    this.setSession(s);
    return s;
  }

  async hasProfile(): Promise<boolean> {
    return this.profile !== null;
  }

  async joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void> {
    this.requireSession();
    if (inviteCode !== "TEST-CODE") throw new InvalidInviteError();
    if (pseudo === "Taken") throw new PseudoTakenError();
    this.profile = { pseudo, avatarEmoji };
  }

  async getMyProfile(): Promise<Profile | null> {
    return this.profile;
  }

  async updateProfile(p: Profile): Promise<void> {
    this.requireSession();
    if (p.pseudo === "Taken") throw new PseudoTakenError();
    this.profile = { ...p };
  }

  async signOut(): Promise<void> {
    this.setSession(null);
  }

  async deleteAccount(): Promise<void> {
    this.profile = null;
    this.setSession(null);
  }
}
