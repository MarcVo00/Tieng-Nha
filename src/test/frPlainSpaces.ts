/**
 * Testing Library collapses every `\s` (the thin no-break space French typography uses before ? ! : ; and inside the
 * guillemets included) to a plain space in the rendered text but not in the matcher string, so `getByText(fr.…)` could
 * never match. In unit tests the copy therefore reads with plain spaces, on both sides (components and assertions).
 * The real typography is checked on the source copy by `src/i18n/fr.typography.test.ts`.
 */
const THIN_SPACES = new RegExp(String.fromCharCode(91, 0xa0, 0x202f, 93), "g"); // [nbsp, narrow nbsp]

export function plainSpaces<T>(node: T): T {
  if (typeof node === "string") return node.replace(THIN_SPACES, " ") as T;
  if (typeof node === "function") {
    const fn = node as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => plainSpaces(fn(...args))) as T;
  }
  if (Array.isArray(node)) return node.map((v) => plainSpaces(v)) as T;
  if (typeof node === "object" && node !== null) {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, plainSpaces(v)])) as T;
  }
  return node;
}
