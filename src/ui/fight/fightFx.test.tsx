import { render, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { duration } from "@/ui/motion";
import { characterLayers } from "@/ui/characterLayers";
import {
  blowTiming,
  DamageNumber,
  dodgeKeyframes,
  droplets,
  FIGHT,
  FighterSprite,
  flashKeyframes,
  InkImpact,
  missKeyframes,
  missTiming,
  recoilKeyframes,
  shakeKeyframes,
  strikeKeyframes,
  useFightBeat,
  useFighterControls,
  type Keyframes,
} from "@/ui/fight";

const REACH = { x: 160, y: -144 };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const timesOf = (k: Keyframes): number[] => (k.transition as { times: number[] }).times;
const durationOf = (k: Keyframes): number => (k.transition as { duration: number }).duration;

describe("FIGHT tokens", () => {
  test("are composed from the motion tokens", () => {
    expect(FIGHT).toEqual({
      anticipation: duration.fast,
      strike: duration.instant,
      hitStop: duration.instant,
      critHitStop: duration.instant * 2,
      koHitStop: duration.instant * 3,
      recoil: duration.base,
      settle: duration.slow,
      number: duration.celebrate,
    });
  });

  test("a blow lands at 230 ms and hands over at 530 ms; a critical winds up longer and holds twice as long", () => {
    const hit = blowTiming("hit");
    expect(close(hit.impact, 0.23)).toBe(true);
    expect(close(hit.length, 0.53)).toBe(true);
    expect(close(hit.attackerLength - hit.length, FIGHT.settle - FIGHT.recoil)).toBe(true);
    const crit = blowTiming("crit");
    expect(close(crit.impact, duration.slow + FIGHT.strike)).toBe(true);
    expect(close(crit.hitStop, FIGHT.critHitStop)).toBe(true);
    expect(close(blowTiming("hit", { ko: true }).hitStop, FIGHT.koHitStop)).toBe(true);
    expect(close(blowTiming("crit", { tempo: 2 }).length, crit.length / 2)).toBe(true);
    expect(close(missTiming().length, duration.slow)).toBe(true);
  });
});

describe("beat keyframes", () => {
  const props = (k: Keyframes) => Object.keys(k).filter((p) => p !== "transition");

  test("the strike holds its contact frame through the hit-stop, then settles back", () => {
    for (const kind of ["hit", "crit"] as const) {
      const k = strikeKeyframes(kind, REACH);
      const t = blowTiming(kind);
      expect(k.x?.[2]).toBe(k.x?.[3]);
      expect(k.y?.[2]).toBe(k.y?.[3]);
      expect(k.x?.[1]).toBeLessThan(0); // wind-up backwards
      expect(k.x?.at(-1)).toBe(0);
      expect(close(durationOf(k), t.attackerLength)).toBe(true);
      expect(close((timesOf(k)[3] ?? 0) - (timesOf(k)[2] ?? 0), t.hitStop / t.attackerLength)).toBe(true);
    }
    // A critical rushes further.
    expect(strikeKeyframes("crit", REACH).x?.[2]).toBeGreaterThan(strikeKeyframes("hit", REACH).x?.[2] ?? 0);
  });

  test("the defender does not move before the contact, holds the jolt, is thrown back, then returns", () => {
    const k = recoilKeyframes("hit", REACH);
    expect(k.x?.slice(0, 2)).toEqual([0, 0]);
    expect(k.x?.[2]).toBe(k.x?.[3]);
    expect(Math.abs(k.x?.[4] ?? 0)).toBeGreaterThan(Math.abs(k.x?.[3] ?? 0));
    expect(k.x?.at(-1)).toBe(0);
    expect(Math.abs(recoilKeyframes("crit", REACH).x?.[4] ?? 0)).toBeGreaterThan(Math.abs(k.x?.[4] ?? 0));
    expect(close(timesOf(k)[1] ?? 0, blowTiming("hit").impact / blowTiming("hit").length)).toBe(true);
  });

  test("times are increasing and only transform/opacity are animated", () => {
    const all = [
      strikeKeyframes("hit", REACH),
      strikeKeyframes("crit", REACH, { ko: true, tempo: 2 }),
      recoilKeyframes("crit", REACH, { ko: true }),
      flashKeyframes("hit"),
      shakeKeyframes("crit"),
      shakeKeyframes("hit"),
      missKeyframes(REACH),
      dodgeKeyframes(REACH),
    ];
    for (const k of all) {
      const times = timesOf(k);
      expect(times[0]).toBe(0);
      expect(times.at(-1)).toBe(1);
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1] ?? 0);
      for (const p of props(k)) {
        expect(["x", "y", "rotate", "scaleX", "scaleY", "opacity"]).toContain(p);
        expect(k[p as "x"]).toHaveLength(times.length);
      }
    }
  });

  test("the stage shakes ±4 px once, ±8 px twice for a critical, only during the hit-stop", () => {
    expect(shakeKeyframes("hit").x).toEqual([0, 0, 4, -4, 0]);
    expect(shakeKeyframes("crit").x).toEqual([0, 0, 8, -8, 8, -8, 0]);
    const k = shakeKeyframes("hit");
    expect(close(durationOf(k), blowTiming("hit").impact + FIGHT.hitStop)).toBe(true);
  });

  test("the blows from the right mirror the ones from the left", () => {
    const back = { x: -REACH.x, y: -REACH.y };
    expect(strikeKeyframes("hit", back).x).toEqual(strikeKeyframes("hit", REACH).x?.map((v) => -v || 0));
    expect(strikeKeyframes("hit", back).rotate?.[2]).toBe(-(strikeKeyframes("hit", REACH).rotate?.[2] ?? 0));
  });
});

describe("InkImpact", () => {
  test("one svg, two slash paths, the droplet budget: 6 hit, 10 crit, 12 K.-O., none on a miss", () => {
    for (const [kind, n] of [["hit", 6], ["crit", 10], ["ko", 12], ["miss", 0]] as const) {
      const { container, unmount } = render(<InkImpact kind={kind} x={100} y={80} dir={REACH} />);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
      expect(container.querySelectorAll("path")).toHaveLength(2);
      expect(container.querySelectorAll("circle")).toHaveLength(n);
      expect(container.querySelectorAll("*").length).toBeLessThanOrEqual(16);
      unmount();
    }
  });

  test("droplets fly 12 to 28 px out, in a fan along the blow", () => {
    const ds = droplets("ko", { x: 1, y: 0 });
    for (const d of ds) {
      const dist = Math.hypot(d.dx, d.dy);
      expect(dist).toBeGreaterThanOrEqual(11);
      expect(dist).toBeLessThanOrEqual(29);
      expect(d.dx).toBeGreaterThan(0);
    }
    expect(droplets("crit", { x: 1, y: 0 }).some((d) => d.fill.includes("gold"))).toBe(true);
  });
});

describe("DamageNumber", () => {
  test("a minus sign and the value; a critical is bigger and gold", () => {
    const { container, rerender } = render(<DamageNumber value={10} critical={false} />);
    const el = container.querySelector("[data-fx='damage']");
    expect(el).toHaveTextContent("−10");
    expect(el?.className).toContain("text-heading");
    expect(el).toHaveAttribute("aria-hidden", "true");
    rerender(<DamageNumber value={15} critical />);
    expect(container.querySelector("[data-fx='damage']")?.className).toContain("text-title");
  });
});

describe("FighterSprite", () => {
  test("only the face of the current expression is visible; all three are mounted", () => {
    const { container, rerender } = render(<FighterSprite look={{}} facing={1} expression="idle" size={100} />);
    const visible = () => [...container.querySelectorAll("[data-face]")].filter((f) => !f.className.includes("invisible")).map((f) => f.getAttribute("data-face"));
    expect(container.querySelectorAll("[data-face]")).toHaveLength(3);
    expect(visible()).toEqual(["idle"]);
    rerender(<FighterSprite look={{}} facing={1} expression="hurt" size={100} />);
    expect(visible()).toEqual(["hurt"]);
    const hurt = container.querySelector("[data-face='hurt']");
    expect(hurt?.getAttribute("src")).toBe(characterLayers({}, "hurt").find((l) => l.slot === "face")?.src);
  });

  test("the hat is its own layer and falls on a bow, stays on for a salute", () => {
    const { container, rerender } = render(<FighterSprite look={{}} facing={-1} expression="ko" size={100} pose="bow" />);
    expect(container.querySelector("[data-hat='fallen'] [data-layer='hat']")).not.toBeNull();
    expect(container.querySelector("[data-pose='bow']")).not.toBeNull();
    rerender(<FighterSprite look={{}} facing={-1} expression="ko" size={100} pose="salute" />);
    expect(container.querySelector("[data-hat='on']")).not.toBeNull();
  });

  test("a character without a hat has nothing to drop", () => {
    const { container } = render(<FighterSprite look={{ character: "char_kiem_khach" }} facing={1} expression="idle" size={100} pose="bow" />);
    expect(container.querySelector("[data-hat]")).toBeNull();
  });
});

describe("fight hooks", () => {
  test("keep their identity across renders, so a beat effect never restarts its animations", () => {
    const { result, rerender } = renderHook(() => ({ fighter: useFighterControls(), beat: useFightBeat() }));
    const first = result.current;
    rerender();
    expect(result.current.fighter).toBe(first.fighter);
    expect(result.current.beat).toBe(first.beat);
  });
});
