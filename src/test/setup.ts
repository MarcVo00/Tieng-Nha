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

// jsdom's AbortSignal is not an instance of undici's, so react-router's `new Request(url, { signal })`
// throws on every navigation. Drop the signal (tests never abort navigations).
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: null } : init);
  }
};
