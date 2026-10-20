import { parseEnv, shouldRefuseFakes } from "@/app/env";
test("fakes mode needs no supabase keys", () =>
  expect(parseEnv({ VITE_USE_FAKES: "true" }).VITE_USE_FAKES).toBe(true));
test("real mode requires supabase keys", () =>
  expect(() => parseEnv({ VITE_USE_FAKES: "false" })).toThrow(/required/));
describe("shouldRefuseFakes", () => {
  const base = { prod: true, useFakes: true, hostname: "tieng-nha.netlify.app" };
  test("refuses fakes in production on a public host", () => expect(shouldRefuseFakes(base)).toBe(true));
  test.each(["localhost", "127.0.0.1", "[::1]"])("allows fakes in production on %s", (hostname) =>
    expect(shouldRefuseFakes({ ...base, hostname })).toBe(false),
  );
  test("allows fakes in development", () => expect(shouldRefuseFakes({ ...base, prod: false })).toBe(false));
  test("allows real mode in production", () =>
    expect(shouldRefuseFakes({ ...base, useFakes: false })).toBe(false));
});

describe("demo mode", () => {
  const base = { prod: true, useFakes: true, hostname: "deploy-preview-1--tieng-nha.netlify.app" };
  test("VITE_DEMO defaults to false and is read from the env", () => {
    expect(parseEnv({ VITE_USE_FAKES: "true" }).VITE_DEMO).toBe(false);
    expect(parseEnv({ VITE_USE_FAKES: "true", VITE_DEMO: "true" }).VITE_DEMO).toBe(true);
  });
  test("fakes are allowed on a public host only with the demo flag", () => {
    expect(shouldRefuseFakes({ ...base, demo: true })).toBe(false);
    expect(shouldRefuseFakes({ ...base, demo: false })).toBe(true);
    expect(shouldRefuseFakes(base)).toBe(true);
  });
});
