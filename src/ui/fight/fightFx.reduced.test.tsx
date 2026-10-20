import { render, renderHook } from "@testing-library/react";
import type { AnimationControls } from "motion/react";
import { expect, test, vi } from "vitest";
import { FighterSprite, useFightBeat, type FighterControls } from "@/ui/fight";

// Own file: motion caches the reduced-motion preference on first use, so the media query must be set before any render.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const MOVES = ["x", "y", "rotate", "scale", "scaleX", "scaleY"];

function fakeControls() {
  return { start: vi.fn(() => Promise.resolve()), stop: vi.fn(), set: vi.fn(), mount: vi.fn(() => () => undefined) } as unknown as AnimationControls & {
    start: ReturnType<typeof vi.fn>;
  };
}
const fighter = (): FighterControls & { body: ReturnType<typeof fakeControls>; flash: ReturnType<typeof fakeControls> } => ({ body: fakeControls(), flash: fakeControls() });

test("under reduced motion a fight beat moves nothing: no x, y, rotate or scale, only the paper flash", () => {
  const { result } = renderHook(() => useFightBeat());
  expect(result.current.reduced).toBe(true);
  const attacker = fighter();
  const defender = fighter();
  const stage = fakeControls();
  const timing = result.current.blow({ kind: "crit", ko: true, attacker, defender, stage, reach: { x: 160, y: -144 } });
  expect(timing.impact).toBeGreaterThan(0);
  result.current.miss({ attackers: [{ controls: attacker, reach: { x: 1, y: 0 } }], dodgers: [{ controls: defender, reach: { x: 1, y: 0 } }] });
  const calls = [attacker.body, attacker.flash, defender.body, defender.flash, stage].flatMap((c) => c.start.mock.calls.map((args: unknown[]) => args[0] as Record<string, unknown>));
  expect(calls.length).toBeGreaterThan(0);
  for (const target of calls) for (const m of MOVES) expect(target).not.toHaveProperty(m);
  expect(attacker.body.start).not.toHaveBeenCalled();
  expect(stage.start).not.toHaveBeenCalled();
});

test("under reduced motion the defeated fighter's hat lies beside, unrotated", () => {
  const { container } = render(<FighterSprite look={{}} facing={1} expression="ko" size={100} pose="bow" />);
  const hat = container.querySelector<HTMLElement>("[data-hat='fallen']");
  expect(hat).not.toBeNull();
  expect(hat?.style.opacity).toBe("1");
  expect(hat?.style.transform).toContain("translateX(-40px)");
  expect(hat?.style.transform).not.toContain("rotate");
});
