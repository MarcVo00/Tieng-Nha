import { SESSION_KEY } from "@/domain/storageKeys";
import type { Session } from "@/domain/types";

/**
 * Last known signed-in identity, so an offline cold start with an expired access token still opens the app.
 * Written whenever a real session is obtained, cleared only on explicit sign-out or account deletion.
 * Everything here is best-effort: without storage the app just falls back to asking to sign in.
 */
export function readCachedSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { userId, email } = v as { userId?: unknown; email?: unknown };
    return typeof userId === "string" && userId !== "" && typeof email === "string" ? { userId, email } : null;
  } catch {
    return null;
  }
}

export function writeCachedSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: session.userId, email: session.email }));
  } catch {
    // Best-effort.
  }
}

export function clearCachedSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Best-effort.
  }
}
