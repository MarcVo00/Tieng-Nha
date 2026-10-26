import { readFileSync } from "node:fs";
import { BUDGET, peakConcurrency, STAGE } from "@/features/shop/gachaReveal";
import { hasSignature, SIGNATURES } from "@/features/shop/signatures";
import { TalismanGuardian } from "@/features/shop/signatures/TalismanGuardian";
import { animatedSpans, BOX, MOUNTED, SIG, talismanCues, talismanPath, TALISMAN_COUNT } from "@/features/shop/signatures/talismanSchedule";

test("the registry: the guardian has her signature, other pieces do not", () => {
  expect(hasSignature("char_phap_su")).toBe(true);
  expect(SIGNATURES.char_phap_su).toBe(TalismanGuardian);
  expect(hasSignature("hat_thuy_tinh")).toBe(false);
  expect(hasSignature("toString")).toBe(false); // own entries only
});

test("the guardian's scene lasts 3 to 4 s and fills the reveal stage", () => {
  expect(SIG.end).toBeGreaterThanOrEqual(3);
  expect(SIG.end).toBeLessThanOrEqual(4);
  expect(BOX).toEqual(STAGE);
  expect(SIG.gong).toBeLessThan(SIG.end);
});

test("its sounds: the wind, twelve brush strokes, one per seal, more than 50 ms apart, then the gong", () => {
  const cues = talismanCues();
  expect(cues.map((c) => c.cue)).toEqual(["sig.wind", ...Array<string>(TALISMAN_COUNT).fill("sig.brush"), "sig.gong"]);
  const brushes = cues.filter((c) => c.cue === "sig.brush").map((c) => c.at);
  for (let i = 1; i < brushes.length; i++) expect((brushes[i] ?? 0) - (brushes[i - 1] ?? 0)).toBeGreaterThan(0.05);
  // Every seal is lit while the talismans still whirl, before they close in.
  expect(brushes.at(-1)).toBeLessThan(SIG.convergeAt);
  expect(cues.at(-1)?.at).toBe(SIG.gong);
});

test("budget (signature exception): ≤ 16 animated at once, 12 talismans, nothing left mounted after the end", () => {
  expect(peakConcurrency(animatedSpans())).toBeLessThanOrEqual(BUDGET.animated * 2);
  expect(TALISMAN_COUNT).toBeLessThanOrEqual(BUDGET.particles);
  for (const span of Object.values(MOUNTED)) expect(span.to).toBeLessThanOrEqual(SIG.end);
});

test("each talisman leaves the altar, whirls, and melts into the silhouette (keyframes in order, ending invisible)", () => {
  for (let i = 0; i < TALISMAN_COUNT; i++) {
    const p = talismanPath(i);
    const n = p.times.length;
    for (const k of [p.x, p.y, p.rotate, p.scale, p.opacity]) expect(k).toHaveLength(n);
    expect(p.times[0]).toBe(0);
    expect(p.times[n - 1]).toBe(1);
    for (let k = 1; k < n; k++) expect(p.times[k]).toBeGreaterThan(p.times[k - 1] ?? 0);
    expect(p.opacity[0]).toBe(0);
    expect(p.opacity[n - 1]).toBe(0);
    expect(Math.min(...p.x)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...p.x)).toBeLessThanOrEqual(BOX.w);
    expect(Math.min(...p.y)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...p.y)).toBeLessThanOrEqual(BOX.h);
  }
});

test("its art: Đông Hồ SVGs under 6 KB, no filter, gradient or embedded image", () => {
  for (const file of ["talisman.svg", "ink-silhouette.svg"]) {
    const svg = readFileSync(`src/assets/gacha/${file}`, "utf8");
    expect(svg.length, file).toBeLessThan(6 * 1024);
    expect(svg, file).not.toMatch(/filter|Gradient|<image/);
  }
});
