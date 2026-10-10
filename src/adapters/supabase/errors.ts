import { ExamLimitError, InvalidInviteError, NotAuthenticatedError, OfflineError, PseudoTakenError } from "@/domain/errors";

/** Maps Supabase/PostgREST/network errors to domain errors. */
export function mapError(err: { message?: string | undefined; code?: string | undefined } | null | undefined): Error {
  const msg = err?.message ?? "";
  if (typeof navigator !== "undefined" && !navigator.onLine) return new OfflineError();
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return new OfflineError();
  if (msg.includes("invalid_invite")) return new InvalidInviteError();
  if (msg.includes("pseudo_taken") || err?.code === "23505") return new PseudoTakenError();
  if (msg.includes("exam_limit")) return new ExamLimitError();
  if (msg.includes("not_authenticated") || err?.code === "PGRST301") return new NotAuthenticatedError();
  return new Error(msg || "unknown_error");
}
