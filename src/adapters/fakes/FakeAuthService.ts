import { InvalidCredentialsError, InvalidInviteError, WeakPasswordError, NotAuthenticatedError, PseudoTakenError } from "@/domain/errors";
import type { Session } from "@/domain/types";
import type { AuthEvent, AuthService } from "@/ports";

type Profile = { pseudo: string; avatarEmoji: string };

const STORAGE_KEY = "tieng-nha.fake-auth";

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export class FakeAuthService implements AuthService {
  otpRequests: string[] = [];
  private session: Session | null = null;
  private profile: Profile | null = null;
  private passwords: Record<string, string> = {};
  private listeners = new Set<(s: Session | null, event?: AuthEvent) => void>();

  /** `persist` keeps session and profile in sessionStorage so a reload or deep link stays signed in (app runtime only). */
  constructor(private readonly persist = false) {
    const raw = persist ? storage()?.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { session: Session | null; profile: Profile | null; passwords?: Record<string, string> };
      this.session = saved.session;
      this.profile = saved.profile;
      this.passwords = saved.passwords ?? {};
    } catch {
      // Corrupt entry: start signed out.
    }
  }

  private save(): void {
    if (!this.persist) return;
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify({ session: this.session, profile: this.profile, passwords: this.passwords }));
    } catch {
      // Storage unavailable: the fake simply stays in-memory.
    }
  }

  private setSession(s: Session | null): void {
    this.session = s;
    this.save();
    for (const cb of this.listeners) cb(s, s ? "SIGNED_IN" : "SIGNED_OUT");
  }

  private requireSession(): Session {
    if (!this.session) throw new NotAuthenticatedError();
    return this.session;
  }

  async getSession(): Promise<Session | null> {
    return this.session;
  }

  onChange(cb: (s: Session | null, event?: AuthEvent) => void): () => void {
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

  async signInWithPassword(email: string, password: string): Promise<Session> {
    if (this.passwords[email] !== password) throw new InvalidCredentialsError();
    const s: Session = { userId: "me", email };
    this.setSession(s);
    return s;
  }

  async setPassword(password: string): Promise<void> {
    const s = this.requireSession();
    if (password.length < 8) throw new WeakPasswordError();
    this.passwords[s.email] = password;
    this.save();
  }

  async hasPassword(): Promise<boolean> {
    return this.passwords[this.requireSession().email] !== undefined;
  }

  async hasProfile(): Promise<boolean> {
    return this.profile !== null;
  }

  async joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void> {
    this.requireSession();
    if (inviteCode !== "TEST-CODE") throw new InvalidInviteError();
    if (pseudo === "Taken") throw new PseudoTakenError();
    this.profile = { pseudo, avatarEmoji };
    this.save();
  }

  async getMyProfile(): Promise<Profile | null> {
    return this.profile;
  }

  async updateProfile(p: Profile): Promise<void> {
    this.requireSession();
    if (p.pseudo === "Taken") throw new PseudoTakenError();
    this.profile = { ...p };
    this.save();
  }

  async signOut(): Promise<void> {
    this.setSession(null);
  }

  async deleteAccount(): Promise<void> {
    this.profile = null;
    this.setSession(null);
  }
}
