import { readFileSync } from "node:fs";
import { BUDGET, peakConcurrency, STAGE } from "@/features/shop/gachaReveal";
import { hasSignature, SIGNATURES } from "@/features/shop/signatures";
import { NineTailFox } from "@/features/shop/signatures/NineTailFox";
import {
  animatedSpans,
  BOX,
  DARK,
  darkKeys,
  FOX,
  foxCues,
  FX,
  LANTERN_COUNT,
  lanternOutAt,
  lightKeys,
  MOUNTED,
  outAt,
  ROOT,
  SIG,
  TAIL,
  TAILS,
} from "@/features/shop/signatures/foxSchedule";

/** The value of keyframes `values` at offset `t` (0..1), linear between them. */
function valueAt(values: readonly number[], times: readonly number[], t: number): number {
  for (let i = 1; i < times.length; i++) {
    const a = times[i - 1] ?? 0;
    const b = times[i] ?? 1;
    if (t <= b) return (values[i - 1] ?? 0) + ((values[i] ?? 0) - (values[i - 1] ?? 0)) * (b > a ? (t - a) / (b - a) : 1);
  }
  return values.at(-1) ?? 0;
}

test("the registry: the nine-tailed fox has her signature, next to the sword's and the guardian's", () => {
  expect(hasSignature("char_ho_ly")).toBe(true);
  expect(SIGNATURES.char_ho_ly).toBe(NineTailFox);
  expect(hasSignature("acc_kiem_rong")).toBe(true);
  expect(hasSignature("char_phap_su")).toBe(true);
});

test("her scene lasts 3 to 4 s and fills the reveal stage", () => {
  expect(SIG.end).toBeGreaterThanOrEqual(3);
  expect(SIG.end).toBeLessThanOrEqual(4);
  expect(BOX).toEqual(STAGE);
});

test("its sounds: a breath per lantern, more than 50 ms apart, the cold crackle as the tails fan out, then the bells", () => {
  const cues = foxCues();
  expect(cues.map((c) => c.cue)).toEqual([...Array<string>(LANTERN_COUNT).fill("sig.lantern"), "sig.foxfire", "sig.bells"]);
  const breaths = cues.filter((c) => c.cue === "sig.lantern").map((c) => c.at);
  breaths.forEach((at, i) => expect(at).toBe(outAt(i)));
  for (let i = 1; i < breaths.length; i++) expect((breaths[i] ?? 0) - (breaths[i - 1] ?? 0)).toBeGreaterThan(0.05);
  expect(cues.find((c) => c.cue === "sig.foxfire")?.at).toBe(SIG.fan);
  expect(cues.at(-1)?.at).toBe(SIG.bells);
  // The lanterns are all out before the fire; the tails have all fanned out before the bells.
  expect(SIG.fan).toBeGreaterThan(outAt(LANTERN_COUNT - 1));
  for (let j = 0; j < TAILS.length; j++) expect(FX.tail(j).delay + FX.tail(j).length).toBeLessThanOrEqual(SIG.bells + 1e-9);
});

test("budget (signature exception): ≤ 16 animated at once, nine tails, ≤ 12 sparks, nothing left mounted after the end", () => {
  expect(peakConcurrency(animatedSpans())).toBeLessThanOrEqual(BUDGET.animated * 2);
  expect(TAILS).toHaveLength(9);
  const sparks = readFileSync("src/assets/gacha/foxfire-sparks.svg", "utf8").match(/<path /g) ?? [];
  expect(sparks.length).toBeLessThanOrEqual(BUDGET.particles);
  for (const span of Object.values(MOUNTED)) expect(span.to).toBeLessThanOrEqual(SIG.end + 1e-9);
});

test("the lanterns go out one by one, and each one out deepens the dark, until the fire", () => {
  const dark = darkKeys();
  expect(dark.opacity).toHaveLength(dark.times.length);
  const at = (s: number) => valueAt(dark.opacity, dark.times, s / FX.darken.length);
  for (let i = 1; i < dark.opacity.length; i++) expect(dark.opacity[i]).toBeGreaterThanOrEqual(dark.opacity[i - 1] ?? 0);
  for (let i = 0; i < LANTERN_COUNT; i++) {
    // Darker after it is out than before.
    expect(at(outAt(i) + SIG.out) - at(outAt(i))).toBeGreaterThanOrEqual(0.1);
    // Its light holds lit until its own breath, then dies within it.
    const light = lightKeys(i);
    expect(FX.light(i).delay + FX.light(i).length).toBeCloseTo(lanternOutAt(i) + SIG.out, 9);
    const lit = (s: number) => valueAt(light.opacity, light.times, (s - FX.light(i).delay) / FX.light(i).length);
    expect(lit(SIG.dusk)).toBeGreaterThanOrEqual(0.7);
    expect(lit(lanternOutAt(i) - 0.01)).toBeGreaterThanOrEqual(0.7);
    expect(light.opacity.at(-1)).toBe(0);
    if (i > 0) expect(outAt(i)).toBeGreaterThan(outAt(i - 1));
  }
  // Each lantern goes out once.
  expect(new Set(Array.from({ length: LANTERN_COUNT }, (_, i) => lanternOutAt(i))).size).toBe(LANTERN_COUNT);
  expect(dark.opacity.at(-1)).toBe(DARK);
  expect(DARK).toBeGreaterThanOrEqual(0.8);
  expect(FX.darken.delay + FX.darken.length).toBeLessThanOrEqual(SIG.fan);
  // No dead pause in the dark: the fire catches right after the last lantern dies.
  expect(SIG.fan - (outAt(LANTERN_COUNT - 1) + SIG.out)).toBeLessThanOrEqual(0.1);
});

test("nine tails of fire fan out from behind her, from the middle outward, wide and on the stage", () => {
  const angles = TAILS.map((t) => t.angle);
  expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThanOrEqual(180);
  for (const t of TAILS) expect(TAILS.some((u) => Math.abs(u.angle + t.angle) < 1e-9)).toBe(true); // symmetric
  // The root is behind her, low on her back.
  expect(ROOT.x).toBeGreaterThan(FOX.x);
  expect(ROOT.x).toBeLessThan(FOX.x + FOX.w);
  expect(ROOT.y).toBeGreaterThan(FOX.y + FOX.h * 0.4);
  expect(ROOT.y).toBeLessThan(FOX.y + FOX.h);
  TAILS.forEach((t, j) => {
    // From the middle outward: the centre one first.
    expect(FX.tail(j).delay).toBeGreaterThanOrEqual(SIG.fan);
    if (Math.abs(t.angle) > 0) expect(FX.tail(j).delay).toBeGreaterThan(FX.tail(TAILS.findIndex((u) => u.angle === 0)).delay);
    // Its tip stays on the stage.
    const r = (t.angle * Math.PI) / 180;
    const tip = { x: ROOT.x + Math.sin(r) * TAIL.h * t.scale, y: ROOT.y - Math.cos(r) * TAIL.h * t.scale };
    expect(tip.x).toBeGreaterThanOrEqual(0);
    expect(tip.x).toBeLessThanOrEqual(BOX.w);
    expect(tip.y).toBeGreaterThanOrEqual(0);
    expect(tip.y).toBeLessThanOrEqual(BOX.h);
  });
  // Above her ears: the middle tails rise over her head.
  expect(ROOT.y - TAIL.h).toBeLessThan(FOX.y + FOX.h * 0.2);
});

test("the climax holds: the bells, the fire at its peak on the dark, then the dark lifts round her, and the scroll at once", () => {
  expect(FX.lift.delay).toBe(SIG.blazed);
  expect(SIG.blazed - SIG.bells).toBeGreaterThanOrEqual(0.2);
  expect(FX.lift.delay + FX.lift.length).toBe(SIG.lifted);
  expect(SIG.end - SIG.lifted).toBeLessThanOrEqual(0.15 + 1e-9);
  expect(FX.handOver.delay).toBe(SIG.lifted);
  expect(FX.handOver.delay + FX.handOver.length).toBeLessThanOrEqual(SIG.end + 1e-9);
  // Her eyes open with the bells.
  expect(FX.eyes.delay).toBe(SIG.bells);
});

test("its art: Đông Hồ SVGs under 6 KB, no filter, gradient or embedded image", () => {
  for (const file of ["foxfire-tail.svg", "ink-fox-silhouette.svg", "ink-fox-eyes.svg", "foxfire-sparks.svg", "lantern-smoke.svg"]) {
    const svg = readFileSync(`src/assets/gacha/${file}`, "utf8");
    expect(svg.length, file).toBeLessThan(6 * 1024);
    expect(svg, file).not.toMatch(/filter|Gradient|<image/);
  }
});
