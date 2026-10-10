import { SupabaseAuthService } from "@/adapters/supabase/SupabaseAuthService";
import { mapError } from "@/adapters/supabase/errors";
import { SupabaseEventSink } from "@/adapters/supabase/SupabaseEventSink";
import { SupabaseExamGateway } from "@/adapters/supabase/SupabaseExamGateway";
import { ExamLimitError, InvalidInviteError, InvalidProfileError, NotAuthenticatedError, OfflineError } from "@/domain/errors";
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
    expect(localStorage.getItem("vl-session")).not.toBeNull();
  });

  test("throws OfflineError when offline and nothing is cached", async () => {
    await expect(make(async () => ({ data: { session: null }, error: retryable })).getSession()).rejects.toBeInstanceOf(OfflineError);
  });

  test("a definitive missing session clears the cache; explicit sign-out clears it too", async () => {
    localStorage.setItem("vl-session", JSON.stringify({ userId: "u1", email: "a@b.c" }));
    await expect(make(async () => ({ data: { session: null }, error: null })).getSession()).resolves.toBeNull();
    expect(localStorage.getItem("vl-session")).toBeNull();
    localStorage.setItem("vl-session", JSON.stringify({ userId: "u1", email: "a@b.c" }));
    await new SupabaseAuthService({ auth: { signOut: async () => ({ error: null }) } } as never).signOut();
    expect(localStorage.getItem("vl-session")).toBeNull();
  });
});

test("AuthRetryableFetchError maps to OfflineError", () => {
  expect(mapError({ name: "AuthRetryableFetchError", message: "x" })).toBeInstanceOf(OfflineError);
});
