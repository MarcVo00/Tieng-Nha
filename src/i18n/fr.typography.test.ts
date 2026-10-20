import type { fr as FrType } from "@/i18n/fr";

// The real copy: unit tests otherwise get it with plain spaces (src/test/frPlainSpaces.ts).
const { fr } = await vi.importActual<{ fr: typeof FrType }>("@/i18n/fr");

// French typography: a thin no-break space (U+202F) before ? ! : ; and inside the guillemets, never a plain space.
const SPACES = "\\u0020\\u00A0"; // what must not precede ? ! : ;
const GOOD = "\\u00A0\\u202F"; // accepted inside the guillemets
const LEFT = String.fromCharCode(0xab);
const RIGHT = String.fromCharCode(0xbb);

function collect(node: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof node === "string") out.push({ path, text: node });
  else if (typeof node === "function") {
    for (const args of [["Abc", 2, 3, 4, 5], [2, 3, 4, 5, "Abc"]]) {
      try {
        collect((node as (...a: unknown[]) => unknown)(...args), path + "()", out);
      } catch {
        // wrong argument shape: the other attempt covers it
      }
    }
  } else if (Array.isArray(node)) node.forEach((v, i) => collect(v, `${path}[${i}]`, out));
  else if (typeof node === "object" && node !== null) for (const [k, v] of Object.entries(node)) collect(v, `${path}.${k}`, out);
}

const strings: { path: string; text: string }[] = [];
collect(fr, "fr", strings);

test("the scan reaches the copy", () => {
  expect(strings.length).toBeGreaterThan(300);
  expect(strings.some((s) => s.text.includes(LEFT))).toBe(true);
});

test("no plain or no-break space before ? ! : ; (thin no-break space only)", () => {
  const re = new RegExp(`[${SPACES}][?!:;]`);
  expect(strings.filter((s) => re.test(s.text)).map((s) => s.path + ": " + s.text)).toEqual([]);
});

test("the guillemets carry a thin no-break space inside", () => {
  const re = new RegExp(`${LEFT}(?![${GOOD}])|(?<![${GOOD}])${RIGHT}`);
  expect(strings.filter((s) => re.test(s.text)).map((s) => s.path + ": " + s.text)).toEqual([]);
});
