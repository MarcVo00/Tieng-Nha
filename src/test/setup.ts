import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { createRequire } from "node:module";

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


// Testing Library's default normaliser collapses every `\s`, including the thin no-break space French typography puts
// before ? ! : ; and inside the guillemets, so `getByText(fr.…)` could never match the real copy. Collapse ASCII
// whitespace only (DTL has no config hook for this: patch the shared factory the queries call).
const require = createRequire(import.meta.url);
const matchesModule = require("@testing-library/dom/dist/matches.js") as {
  makeNormalizer: (opts: { trim?: boolean; collapseWhitespace?: boolean; normalizer?: (text: string) => string }) => (text: string) => string;
};
const makeNormalizer = matchesModule.makeNormalizer;
matchesModule.makeNormalizer = (opts = {}) => {
  if (opts.normalizer) return makeNormalizer(opts);
  const { trim = true, collapseWhitespace = true } = opts;
  const ascii = /[ \t\r\n\f\v]+/g;
  return (text) => {
    const trimmed = trim ? text.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "") : text;
    return collapseWhitespace ? trimmed.replace(ascii, " ") : trimmed;
  };
};
