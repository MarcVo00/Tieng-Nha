// Import from tests that render a data router (createMemoryRouter).
// jsdom's AbortSignal is not an instance of undici's, so react-router's `new Request(url, { signal })`
// throws on every navigation. Drop the signal (tests never abort navigations).
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: null } : init);
  }
};
