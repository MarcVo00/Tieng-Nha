import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createFakeServices } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useCountdown, useResumeAtZero } from "@/app/useCountdown";

const START = Date.parse("2026-10-21T10:00:00.000Z");
const TARGET = new Date(START + 10_000).toISOString();

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function wrapper({ children }: { children: ReactNode }) {
  const services = createFakeServices({ clock: () => new Date(Date.now()).toISOString() });
  return <ServicesProvider services={services}>{children}</ServicesProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  setVisibility("visible");
});
afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

test("counts down once a second from the injected clock", () => {
  const { result } = renderHook(() => useCountdown(TARGET), { wrapper });
  expect(result.current).toBe(10_000);
  act(() => void vi.advanceTimersByTime(3000));
  expect(result.current).toBe(7000);
});

test("returns null and sets no interval without a target", () => {
  const spy = vi.spyOn(globalThis, "setInterval");
  const { result } = renderHook(() => useCountdown(null), { wrapper });
  expect(result.current).toBeNull();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("pauses while hidden and resyncs when visible again", () => {
  const { result } = renderHook(() => useCountdown(TARGET), { wrapper });
  act(() => setVisibility("hidden"));
  expect(vi.getTimerCount()).toBe(0);
  act(() => void vi.advanceTimersByTime(5000));
  expect(result.current).toBe(10_000); // no re-render while hidden
  act(() => setVisibility("visible"));
  expect(result.current).toBe(5000);
  expect(vi.getTimerCount()).toBe(1);
});

test("clears its interval on unmount", () => {
  const { unmount } = renderHook(() => useCountdown(TARGET), { wrapper });
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("stops its interval once the target is reached", () => {
  const { result } = renderHook(() => useCountdown(TARGET), { wrapper });
  act(() => void vi.advanceTimersByTime(10_000));
  expect(result.current).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test("useResumeAtZero resumes exactly once when the countdown ends, then stays quiet", async () => {
  const resume = vi.fn();
  const { result } = renderHook(() => useResumeAtZero(TARGET, resume), { wrapper });
  act(() => void vi.advanceTimersByTime(9000));
  expect(resume).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(result.current).toBe(0);
  expect(resume).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(resume).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test("useResumeAtZero does nothing without a target", async () => {
  const resume = vi.fn();
  renderHook(() => useResumeAtZero(null, resume), { wrapper });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(resume).not.toHaveBeenCalled();
});
