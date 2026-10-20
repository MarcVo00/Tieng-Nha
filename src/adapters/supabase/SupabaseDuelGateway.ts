import { z } from "zod";
import type { Db } from "@/adapters/supabase/client";
import type { Json } from "@/adapters/supabase/types.gen";
import { mapError } from "@/adapters/supabase/errors";
import type { Duel, DuelQuestions, Round1Answer, Round2Answer } from "@/domain/types";
import { NotAuthenticatedError } from "@/domain/errors";
import { DUEL_ERRORS, type DuelError, type DuelGateway } from "@/ports";

const RunSchema = z.object({
  round1: z.array(z.object({ correct: z.boolean(), ms: z.number() })),
  round2: z.array(z.object({ correct: z.boolean() })),
  damage: z.number(),
  timeMs: z.number(),
  reward: z.number().nullable(),
  claimed: z.boolean(),
});
/** Postgres timestamps ("2026-10-10T08:00:00.123456+00:00", "2026-10-10 08:00:00+00") to ISO-Z; invalid ones are refused. */
const IsoSchema = z.string().transform((v, ctx) => {
  // Old iOS Safari rejects fractions longer than 3 digits: keep milliseconds only (padded when shorter).
  const normal = v
    .trim()
    .replace(" ", "T")
    .replace(/\.(\d+)/, (_, f: string) => `.${f.slice(0, 3).padEnd(3, "0")}`)
    .replace(/([+-]\d{2})$/, "$1:00");
  const ms = Date.parse(normal);
  if (Number.isNaN(ms)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid timestamp" });
    return z.NEVER;
  }
  return new Date(ms).toISOString();
});
const RefSchema = z.object({ lessonId: z.string(), exerciseId: z.string() });
const DuelSchema = z.object({
  id: z.string(),
  challenger: z.string(),
  opponent: z.string(),
  opponentPseudo: z.string(),
  opponentAvatar: z.string(),
  createdAt: IsoSchema,
  expiresAt: IsoSchema,
  status: z.enum(["open", "settled", "cancelled"]),
  winner: z.string().nullable(),
  seed: z.number(),
  questions: z.object({ round1: z.array(RefSchema), round2: z.array(RefSchema) }),
  myRun: RunSchema.nullable(),
  theirRun: RunSchema.nullable(),
});
const ResultSchema = z.object({ ok: z.boolean(), error: z.string().optional(), duelId: z.string().optional() });

function result(data: unknown): z.infer<typeof ResultSchema> {
  const parsed = ResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("invalid_duel_response");
  return parsed.data;
}

function refusal(error: string | undefined): { ok: false; error: DuelError } {
  const known = DUEL_ERRORS.find((c) => c === error);
  if (!known) throw new Error("invalid_duel_response");
  return { ok: false, error: known };
}

export class SupabaseDuelGateway implements DuelGateway {
  constructor(private readonly db: Db) {}

  async create(opponent: string, questions: DuelQuestions, seed: number): Promise<{ ok: true; duelId: string } | { ok: false; error: DuelError }> {
    const { data, error } = await this.db.rpc("create_duel", { p_opponent: opponent, p_questions: questions as unknown as Json, p_seed: seed });
    if (error) throw mapError(error);
    const r = result(data);
    if (!r.ok) return refusal(r.error);
    if (r.duelId === undefined) throw new Error("invalid_duel_response");
    return { ok: true, duelId: r.duelId };
  }

  async submitRun(duelId: string, round1: Round1Answer[], round2: Round2Answer[]): Promise<{ ok: true } | { ok: false; error: DuelError }> {
    const { data, error } = await this.db.rpc("submit_duel_run", {
      p_duel: duelId, p_round1: round1 as unknown as Json, p_round2: round2 as unknown as Json,
    });
    if (error) throw mapError(error);
    const r = result(data);
    return r.ok ? { ok: true } : refusal(r.error);
  }

  async list(): Promise<Duel[]> {
    const { data, error } = await this.db.rpc("list_duels");
    if (error) throw mapError(error);
    const parsed = z.array(DuelSchema).safeParse(data);
    if (!parsed.success) throw new Error("invalid_duel_response");
    return parsed.data;
  }

  async balance(): Promise<number> {
    const { data: auth, error: authError } = await this.db.auth.getUser();
    if (authError) throw mapError(authError);
    const uid = auth.user?.id;
    if (!uid) throw new NotAuthenticatedError();
    const { data, error } = await this.db.from("user_stats").select("kim_bai").eq("user_id", uid).maybeSingle();
    if (error) throw mapError(error);
    return data?.kim_bai ?? 0;
  }
}
