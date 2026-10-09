import { parseEnv } from "@/app/env";
test("fakes mode needs no supabase keys", () => expect(parseEnv({ VITE_USE_FAKES: "true" }).VITE_USE_FAKES).toBe(true));
test("real mode requires supabase keys", () => expect(() => parseEnv({ VITE_USE_FAKES: "false" })).toThrow(/required/));
