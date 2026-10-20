import { z } from "zod";
import type { Env } from "@/domain/config";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
const EnvSchema = z
  .object({
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(10).optional(),
    VITE_WELCOME_MESSAGE: z.string().default(""),
    VITE_USE_FAKES: bool,
    VITE_FAKE_SPEECH: bool,
    VITE_DEMO: bool,
  })
  .superRefine((e, ctx) => {
    if (e.VITE_DEMO && !e.VITE_USE_FAKES)
      ctx.addIssue({ code: "custom", message: "VITE_DEMO=true requires VITE_USE_FAKES=true" });
    if (!e.VITE_USE_FAKES && (!e.VITE_SUPABASE_URL || !e.VITE_SUPABASE_ANON_KEY))
      ctx.addIssue({
        code: "custom",
        message: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required unless VITE_USE_FAKES=true",
      });
  });

export function parseEnv(raw: Record<string, unknown>): Env {
  return EnvSchema.parse(raw);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True when a production build would run on fakes outside a local host (E2E previews on localhost); the demo build is the one allowed exception. */
export function shouldRefuseFakes(input: { prod: boolean; useFakes: boolean; hostname: string; demo?: boolean }): boolean {
  return input.prod && input.useFakes && !input.demo && !LOCAL_HOSTS.has(input.hostname);
}
