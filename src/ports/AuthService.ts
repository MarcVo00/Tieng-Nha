import type { Session } from "@/domain/types";
export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "INITIAL_SESSION" | "USER_UPDATED";

export interface AuthService {
  getSession(): Promise<Session | null>;
  onChange(cb: (s: Session | null, event?: AuthEvent) => void): () => void; // returns unsubscribe
  requestOtp(email: string): Promise<void>;
  verifyOtp(email: string, token: string): Promise<Session>; // throws Error("invalid_otp")
  hasProfile(): Promise<boolean>;
  joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void>; // InvalidInviteError | PseudoTakenError
  getMyProfile(): Promise<{ pseudo: string; avatarEmoji: string } | null>;
  updateProfile(p: { pseudo: string; avatarEmoji: string }): Promise<void>; // PseudoTakenError
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}
