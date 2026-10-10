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

