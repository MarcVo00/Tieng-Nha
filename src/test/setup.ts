import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// jsdom does not implement matchMedia; light scheme, no reduced-motion preference.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}


// Unit tests read the copy with plain spaces (see frPlainSpaces.ts); `vi.importActual("@/i18n/fr")` gives the real one.
vi.mock("@/i18n/fr", async (importActual) => {
  const actual = await importActual<{ fr: Record<string, unknown> }>();
  const { plainSpaces } = await import("@/test/frPlainSpaces");
  return { ...actual, fr: plainSpaces(actual.fr) };
});
