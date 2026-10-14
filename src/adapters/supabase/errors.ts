import { ExamLimitError, InvalidCredentialsError, InvalidInviteError, InvalidProfileError, WeakPasswordError, NotAuthenticatedError, OfflineError, PseudoTakenError } from "@/domain/errors";

/** Maps Supabase/PostgREST/network errors to domain errors. */
export function mapError(
  err: { name?: string | undefined; message?: string | undefined; code?: string | undefined; status?: number | undefined } | null | undefined,
): Error {
  const msg = err?.message ?? "";
  if (typeof navigator !== "undefined" && !navigator.onLine) return new OfflineError();
  // auth-js also flags HTTP 5xx as "retryable": only status 0 is a real network failure.
  if (err?.name === "AuthRetryableFetchError") return (err.status ?? 0) === 0 ? new OfflineError() : new Error("server_error");
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return new OfflineError();
  if (err?.name === "AuthSessionMissingError" || /auth session missing/i.test(msg)) return new NotAuthenticatedError();
  if (err?.code === "invalid_credentials" || /Invalid login credentials/i.test(msg)) return new InvalidCredentialsError();
  if (err?.code === "weak_password" || /Password should be/i.test(msg)) return new WeakPasswordError();
  if (msg.includes("invalid_profile")) return new InvalidProfileError();
  if (msg.includes("invalid_invite")) return new InvalidInviteError();
  if (msg.includes("pseudo_taken") || err?.code === "23505") return new PseudoTakenError();
  if (msg.includes("exam_limit")) return new ExamLimitError();
  if (msg.includes("not_authenticated") || err?.code === "PGRST301") return new NotAuthenticatedError();
  return new Error(msg || "unknown_error");
}
