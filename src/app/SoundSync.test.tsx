import { act, render } from "@testing-library/react";
import { ServicesProvider } from "@/app/ServicesProvider";
import { SoundSync } from "@/app/SoundSync";
import { useAppState } from "@/app/appState";
import { createFakeServices, FakeSoundPlayer } from "@/adapters/fakes";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";

function setup() {
  const sound = new FakeSoundPlayer();
  render(
    <ServicesProvider services={createFakeServices({ sound })}>
      <SoundSync />
    </ServicesProvider>,
  );
  return sound;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS } });
});

afterEach(() => {
  setVisibility("visible");
});

test("follows the « Sons » setting", () => {
  const sound = setup();
  expect(sound.enabledCalls).toEqual([true]);
  act(() => useAppState.setState({ settings: { ...DEFAULT_SETTINGS, sound: false } }));
  expect(sound.enabledCalls).toEqual([true, false]);
  expect(sound.enabled).toBe(false);
});

test("once audio really runs, a completed gesture stops the listening", () => {
  const sound = setup();
  expect(sound.unlocks).toBe(0);
  window.dispatchEvent(new Event("pointerdown"));
  expect(sound.unlocks).toBe(1);
  expect(sound.isRunning()).toBe(true);
  window.dispatchEvent(new Event("pointerup"));
  window.dispatchEvent(new Event("click"));
  window.dispatchEvent(new KeyboardEvent("keydown"));
  expect(sound.unlocks).toBe(1);
});

test("keeps listening while a gesture left the audio suspended, and a later gesture unlocks it", () => {
  const sound = setup();
  sound.unlockWorks = false; // iOS refused the pointerup as a media gesture
  window.dispatchEvent(new Event("pointerup"));
  window.dispatchEvent(new Event("touchend"));
  window.dispatchEvent(new Event("click"));
  expect(sound.unlocks).toBe(3);
  sound.unlockWorks = true;
  window.dispatchEvent(new Event("click"));
  expect(sound.unlocks).toBe(4);
  expect(sound.isRunning()).toBe(true);
  window.dispatchEvent(new Event("click"));
  expect(sound.unlocks).toBe(4);
});

test("an interruption while the app stays visible (a call, Siri) re-arms the listeners", () => {
  const sound = setup();
  window.dispatchEvent(new Event("click"));
  expect(sound.unlocks).toBe(1);
  act(() => sound.setRunning(false)); // iOS "interrupted"
  window.dispatchEvent(new Event("click"));
  expect(sound.unlocks).toBe(2);
  expect(sound.isRunning()).toBe(true);
});

test("listens again when the app comes back from the background (iOS suspends audio)", () => {
  const sound = setup();
  window.dispatchEvent(new KeyboardEvent("keydown"));
  expect(sound.unlocks).toBe(1);
  setVisibility("hidden");
  act(() => sound.setRunning(false));
  setVisibility("visible");
  window.dispatchEvent(new Event("touchend"));
  expect(sound.unlocks).toBe(2);
});

test("going to the background stops every sound and mutes cues until the app is visible again", () => {
  const sound = setup();
  expect(sound.stopped).toBe(0);
  setVisibility("hidden");
  expect(sound.stopped).toBe(1);
  // A cue scheduled earlier (a signature's gong) fires behind the app: it is not played.
  sound.play("sig.gong");
  expect(sound.played).toEqual([]);
  setVisibility("visible");
  expect(sound.stopped).toBe(1);
  sound.play("sig.gong");
  expect(sound.played.map((p) => p.cue)).toEqual(["sig.gong"]);
});

test("coming back from the background keeps « Sons » off when it was off", () => {
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS, sound: false } });
  const sound = setup();
  setVisibility("hidden");
  setVisibility("visible");
  expect(sound.enabled).toBe(false);
});
