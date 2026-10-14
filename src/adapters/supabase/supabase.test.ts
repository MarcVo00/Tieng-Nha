import { SupabaseAuthService } from "@/adapters/supabase/SupabaseAuthService";
import { mapError } from "@/adapters/supabase/errors";
import { SupabaseEventSink } from "@/adapters/supabase/SupabaseEventSink";
import { SupabaseExamGateway } from "@/adapters/supabase/SupabaseExamGateway";
import { ExamLimitError, InvalidCredentialsError, InvalidInviteError, InvalidProfileError, NotAuthenticatedError, OfflineError, SamePasswordError, WeakPasswordError } from "@/domain/errors";
import type { AppEvent } from "@/domain/types";
import type { ExamGateway } from "@/ports";

test("error mapping", () => {
  expect(mapError({ message: "invalid_invite" })).toBeInstanceOf(InvalidInviteError);
  expect(mapError({ message: "exam_limit" })).toBeInstanceOf(ExamLimitError);
  expect(mapError({ message: "TypeError: Failed to fetch" })).toBeInstanceOf(OfflineError);
  expect(mapError({ message: "invalid_profile" })).toBeInstanceOf(InvalidProfileError);
});

test("signed-out auth error maps to NotAuthenticatedError", () => {
  expect(mapError({ name: "AuthSessionMissingError", message: "Auth session missing!" })).toBeInstanceOf(NotAuthenticatedError);
  expect(mapError({ message: "Auth session missing!" })).toBeInstanceOf(NotAuthenticatedError);
});

const user = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null }) } };
const ev = (clientId: string): AppEvent => ({
  clientId, schemaVersion: 1, type: "lesson_completed", refId: "l01", xp: 10, payload: { a: 1 }, createdAt: "2026-10-10T08:00:00.000Z",
});
const row = (clientId: string) => ({
  client_id: clientId, user_id: "u1", schema_version: 1, type: "lesson_completed", ref_id: "l01", xp: 10, payload: { a: 1 },
  client_created_at: "2026-10-10T08:00:00.000Z",
});
const OPTS = { onConflict: "client_id", ignoreDuplicates: true };

test("event sink upserts with ignoreDuplicates and maps columns", async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const db = { from: vi.fn(() => ({ upsert })), ...user };
  const sink = new SupabaseEventSink(db as never);
  await expect(sink.push([ev("c1")])).resolves.toEqual({ accepted: ["c1"] });
  expect(db.from).toHaveBeenCalledWith("events");
  expect(upsert).toHaveBeenCalledWith([row("c1")], OPTS);
});

test("event sink falls back to per-event inserts and drops a corrupt event with a warning", async () => {
  const upsert = vi.fn(async (rows: { client_id: string }[]) => {
    const bad = rows.some((r) => r.client_id === "bad");
    return { error: bad ? { code: "23514", message: "check violation" } : null };
  });
  const db = { from: vi.fn(() => ({ upsert })), ...user };
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const out = await new SupabaseEventSink(db as never).push([ev("c1"), ev("bad"), ev("c2")]);
  expect(out).toEqual({ accepted: ["c1", "bad", "c2"] });
  expect(upsert).toHaveBeenCalledTimes(4); // 1 batch + 3 singles
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test("event sink rethrows network errors during the per-event fallback", async () => {
  const upsert = vi
    .fn()
    .mockResolvedValueOnce({ error: { code: "22P02", message: "bad input" } })
    .mockResolvedValueOnce({ error: { message: "TypeError: Failed to fetch" } });
  const db = { from: vi.fn(() => ({ upsert })), ...user };
  await expect(new SupabaseEventSink(db as never).push([ev("c1")])).rejects.toBeInstanceOf(OfflineError);
});

test("event sink throws OfflineError on a batch network error", async () => {
  const upsert = vi.fn().mockResolvedValue({ error: { message: "Failed to fetch" } });
  const db = { from: vi.fn(() => ({ upsert })), ...user };
  await expect(new SupabaseEventSink(db as never).push([ev("c1")])).rejects.toBeInstanceOf(OfflineError);
});

test("exam gateway maps exam_limit", async () => {
  const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "exam_limit" } }) };
  await expect(new SupabaseExamGateway(db as never).startAttempt()).rejects.toBeInstanceOf(ExamLimitError);
});

test("exam gateway maps the start_exam_attempt payload and submitAttempt is a no-op", async () => {
  const db = { rpc: vi.fn().mockResolvedValue({ data: { attempt_id: "a1", remaining_today: 2 }, error: null }) };
  const gw: ExamGateway = new SupabaseExamGateway(db as never);
  await expect(gw.startAttempt()).resolves.toEqual({ attemptId: "a1", remainingToday: 2 });
  await expect(gw.submitAttempt("a1", 80)).resolves.toBeUndefined();
  expect(db.rpc).toHaveBeenCalledTimes(1);
});

test("event sink keeps events queued on an FK violation (no profile)", async () => {
  const upsert = vi.fn().mockResolvedValue({ error: { code: "23503", message: "fk violation" } });
  const db = { from: vi.fn(() => ({ upsert })), ...user };
  await expect(new SupabaseEventSink(db as never).push([ev("c1")])).rejects.toBeInstanceOf(NotAuthenticatedError);
  expect(upsert).toHaveBeenCalledTimes(1);
});

test("event sink throws NotAuthenticatedError without a session", async () => {
  const db = { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } };
  await expect(new SupabaseEventSink(db as never).push([ev("c1")])).rejects.toBeInstanceOf(NotAuthenticatedError);
});

describe("SupabaseAuthService offline session fallback", () => {
  const retryable = { name: "AuthRetryableFetchError", message: "fetch failed" };
  const make = (getSession: () => Promise<unknown>) =>
    new SupabaseAuthService({ auth: { getSession } } as never);
  beforeEach(() => localStorage.clear());

  test("returns the cached identity when the refresh fails offline", async () => {
    await make(async () => ({ data: { session: { user: { id: "u1", email: "a@b.c" } } }, error: null })).getSession();
    const offline = make(async () => ({ data: { session: null }, error: retryable }));
    await expect(offline.getSession()).resolves.toEqual({ userId: "u1", email: "a@b.c" });
    expect(localStorage.getItem("tn-session")).not.toBeNull();
  });

  test("a thrown fetch failure uses the same cached fallback", async () => {
    localStorage.setItem("tn-session", JSON.stringify({ userId: "u1", email: "a@b.c" }));
    const throwing = make(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(throwing.getSession()).resolves.toEqual({ userId: "u1", email: "a@b.c" });
    localStorage.clear();
    await expect(throwing.getSession()).rejects.toBeInstanceOf(OfflineError);
  });

  test("throws OfflineError when offline and nothing is cached", async () => {
    await expect(make(async () => ({ data: { session: null }, error: retryable })).getSession()).rejects.toBeInstanceOf(OfflineError);
  });

  test("a definitive missing session clears the cache; explicit sign-out clears it too", async () => {
    localStorage.setItem("tn-session", JSON.stringify({ userId: "u1", email: "a@b.c" }));
    await expect(make(async () => ({ data: { session: null }, error: null })).getSession()).resolves.toBeNull();
    expect(localStorage.getItem("tn-session")).toBeNull();
    localStorage.setItem("tn-session", JSON.stringify({ userId: "u1", email: "a@b.c" }));
    await new SupabaseAuthService({ auth: { signOut: async () => ({ error: null }) } } as never).signOut();
    expect(localStorage.getItem("tn-session")).toBeNull();
  });
});

test("AuthRetryableFetchError with HTTP 5xx is a server error, not offline", () => {
  const e = mapError({ name: "AuthRetryableFetchError", message: "Error sending magic link email", status: 500 });
  expect(e).not.toBeInstanceOf(OfflineError);
  expect(e.message).toBe("server_error");
});

test("AuthRetryableFetchError maps to OfflineError", () => {
  expect(mapError({ name: "AuthRetryableFetchError", message: "x" })).toBeInstanceOf(OfflineError);
});

describe("SupabaseAuthService password sign-in", () => {
  const sbSession = { user: { id: "u1", email: "m@x.fr" } };
  const svc = (auth: Record<string, unknown>) => new SupabaseAuthService({ auth } as never);

  test("maps invalid credentials by code or message", () => {
    expect(mapError({ code: "invalid_credentials", message: "x" })).toBeInstanceOf(InvalidCredentialsError);
    expect(mapError({ message: "Invalid login credentials" })).toBeInstanceOf(InvalidCredentialsError);
  });

  test("maps weak password by code or message", () => {
    expect(mapError({ code: "weak_password", message: "x" })).toBeInstanceOf(WeakPasswordError);
    expect(mapError({ message: "Password should be at least 8 characters." })).toBeInstanceOf(WeakPasswordError);
  });

  test("same password maps by code or message, and the weak regex is anchored", () => {
    expect(mapError({ code: "same_password", message: "x" })).toBeInstanceOf(SamePasswordError);
    expect(mapError({ message: "New password should be different from the old password." })).toBeInstanceOf(SamePasswordError);
    expect(mapError({ message: "Password should contain at least one character of each: abc" })).toBeInstanceOf(WeakPasswordError);
    expect(mapError({ message: "New password should be different from the old password." })).not.toBeInstanceOf(WeakPasswordError);
  });

  test("a code wins over a misleading message", () => {
    expect(mapError({ code: "weak_password", message: "Invalid login credentials" })).toBeInstanceOf(WeakPasswordError);
  });

  test("requestOtp passes shouldCreateUser and stays silent for an unknown e-mail on recovery", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    await svc({ signInWithOtp }).requestOtp("m@x.fr");
    expect(signInWithOtp).toHaveBeenLastCalledWith({ email: "m@x.fr", options: { shouldCreateUser: true } });
    await svc({ signInWithOtp }).requestOtp("m@x.fr", { createUser: false });
    expect(signInWithOtp).toHaveBeenLastCalledWith({ email: "m@x.fr", options: { shouldCreateUser: false } });
    const unknown = vi.fn().mockResolvedValue({ data: {}, error: { code: "otp_disabled", message: "Signups not allowed for otp" } });
    await expect(svc({ signInWithOtp: unknown }).requestOtp("ghost@x.fr", { createUser: false })).resolves.toBeUndefined();
    await expect(svc({ signInWithOtp: unknown }).requestOtp("ghost@x.fr")).rejects.toBeDefined();
  });

  test("signInWithPassword maps the session and rejects bad credentials", async () => {
    const ok = svc({ signInWithPassword: vi.fn().mockResolvedValue({ data: { session: sbSession }, error: null }) });
    await expect(ok.signInWithPassword("m@x.fr", "secret123")).resolves.toEqual({ userId: "u1", email: "m@x.fr" });
    const bad = svc({ signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials", message: "Invalid login credentials" } }) });
    await expect(bad.signInWithPassword("m@x.fr", "nope")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  test("setPassword stores the has_password flag and maps a weak password", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    await svc({ updateUser }).setPassword("secret123");
    expect(updateUser).toHaveBeenCalledWith({ password: "secret123", data: { has_password: true } });
    const weak = svc({ updateUser: vi.fn().mockResolvedValue({ data: {}, error: { code: "weak_password", message: "Password should be at least 8 characters" } }) });
    await expect(weak.setPassword("abc")).rejects.toBeInstanceOf(WeakPasswordError);
  });

  test("hasPassword reads the metadata flag", async () => {
    const withFlag = svc({ getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", user_metadata: { has_password: true } } }, error: null }) });
    await expect(withFlag.hasPassword()).resolves.toBe(true);
    const without = svc({ getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } }, error: null }) });
    await expect(without.hasPassword()).resolves.toBe(false);
    const signedOut = svc({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) });
    await expect(signedOut.hasPassword()).rejects.toBeInstanceOf(NotAuthenticatedError);
  });
});
