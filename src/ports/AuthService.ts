import type { Session } from "@/domain/types";
export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "INITIAL_SESSION" | "USER_UPDATED";

export interface AuthService {
  getSession(): Promise<Session | null>;
  onChange(cb: (s: Session | null, event?: AuthEvent) => void): () => void; // returns unsubscribe
  /** `createUser: false` (password recovery) never creates an account and never reveals whether the e-mail exists. */
  requestOtp(email: string, opts?: { createUser?: boolean }): Promise<void>;
  verifyOtp(email: string, token: string): Promise<Session>; // throws Error("invalid_otp")
  signInWithPassword(email: string, password: string): Promise<Session>; // InvalidCredentialsError | OfflineError
  setPassword(password: string): Promise<void>; // WeakPasswordError | SamePasswordError | OfflineError | NotAuthenticatedError
  hasPassword(): Promise<boolean>; // true once setPassword succeeded (flag kept in user metadata)
  hasProfile(): Promise<boolean>;
  joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void>; // InvalidInviteError | PseudoTakenError
  getMyProfile(): Promise<{ pseudo: string; avatarEmoji: string } | null>;
  updateProfile(p: { pseudo: string; avatarEmoji: string }): Promise<void>; // PseudoTakenError
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}
