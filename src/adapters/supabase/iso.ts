import { z } from "zod";

/** Postgres timestamps ("2026-10-10T08:00:00.123456+00:00", "2026-10-10 08:00:00+00") to ISO-Z; invalid ones are refused. */
export const IsoSchema = z.string().transform((v, ctx) => {
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
