import { z } from "zod";
import type { Env } from "@/domain/config";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
const EnvSchema = z
  .object({
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(10).optional(),
    VITE_WELCOME_MESSAGE: z.string().default(""),
    VITE_USE_FAKES: bool,
    VITE_FAKE_SPEECH: bool,
  })
  .superRefine((e, ctx) => {
    if (!e.VITE_USE_FAKES && (!e.VITE_SUPABASE_URL || !e.VITE_SUPABASE_ANON_KEY))
      ctx.addIssue({ code: "custom", message: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required unless VITE_USE_FAKES=true" });
  });

export function parseEnv(raw: Record<string, unknown>): Env {
  return EnvSchema.parse(raw);
}
