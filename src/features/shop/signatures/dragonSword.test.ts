import { readFileSync } from "node:fs";
import { BUDGET, peakConcurrency, STAGE } from "@/features/shop/gachaReveal";
import { hasSignature, SIGNATURES } from "@/features/shop/signatures";
import { DragonSword } from "@/features/shop/signatures/DragonSword";
import { animatedSpans, BLADE, BOX, dragonCues, dragonPath, FX, MOUNTED, SEGMENTS, SIG, VEIN_BANDS } from "@/features/shop/signatures/dragonSchedule";

test("the registry: the dragon sword has its signature, next to the guardian's", () => {
  expect(hasSignature("acc_kiem_rong")).toBe(true);
  expect(SIGNATURES.acc_kiem_rong).toBe(DragonSword);
  expect(hasSignature("char_phap_su")).toBe(true);
  expect(hasSignature("acc_thuan_thien")).toBe(false);
});

test("its scene lasts 3 to 4 s and fills the reveal stage", () => {
  expect(SIG.end).toBeGreaterThanOrEqual(3);
  expect(SIG.end).toBeLessThanOrEqual(4);
  expect(BOX).toEqual(STAGE);
  expect(SIG.ring).toBeLessThan(SIG.end);
});

test("its sounds: the roar as the dragon rises from the altar, the ring of the blade once all of it is inside", () => {
  const cues = dragonCues();
  expect(cues.map((c) => c.cue)).toEqual(["sig.roar", "sig.blade"]);
  expect(cues[0]?.at).toBe(SIG.rise);
  expect(cues[1]?.at).toBe(SIG.ring);
  // The roar (≈ 1.5 s) has died down before the ring.
  expect(SIG.ring - SIG.rise).toBeGreaterThan(1.5);
});

test("budget (signature exception): ≤ 16 animated at once, ≤ 12 pieces of dragon, nothing left mounted after the end", () => {
  expect(peakConcurrency(animatedSpans())).toBeLessThanOrEqual(BUDGET.animated * 2);
  expect(SEGMENTS).toBeLessThanOrEqual(BUDGET.particles);
  for (const span of Object.values(MOUNTED)) expect(span.to).toBeLessThanOrEqual(SIG.end);
  // The dragon is entirely inside the blade when it rings: its pieces are gone before the flare.
  expect(MOUNTED.dragon.to).toBe(SIG.ring);
});

test("the dragon rises out of the altar, coils round the blade (big in front, small and faint behind), and dives into it", () => {
  const axis = BLADE.x + BLADE.w / 2;
  for (let k = 0; k < SEGMENTS; k++) {
    const p = dragonPath(k);
    const n = p.times.length;
    for (const key of [p.x, p.y, p.rotate, p.scale, p.scaleY, p.opacity]) expect(key).toHaveLength(n);
    expect(p.times[0]).toBe(0);
    expect(p.times[n - 1]).toBe(1);
    for (let i = 1; i < n; i++) expect(p.times[i]).toBeGreaterThan(p.times[i - 1] ?? 0);
    // Out of the altar: it starts hidden in its ink, on the tray.
    expect(p.opacity[0]).toBe(0);
    expect(p.y[0]).toBeGreaterThan(BLADE.y + BLADE.h - 20);
    // The coil: it rises, and depth reads.
    expect(Math.max(...p.y) - Math.min(...p.y)).toBeGreaterThanOrEqual(150);
    expect(Math.max(...p.scale)).toBeGreaterThanOrEqual(1.05);
    const visible = p.opacity.map((o, i) => (o > 0.05 ? (p.scale[i] ?? 0) : Infinity));
    expect(Math.min(...visible)).toBeLessThanOrEqual(0.7);
    expect(Math.max(...p.x) - Math.min(...p.x)).toBeGreaterThanOrEqual(120);
    // Into the blade: it ends on the blade's axis, swallowed (invisible), never left lying around.
    expect(p.x[n - 1]).toBeCloseTo(axis, 0);
    expect(p.opacity[n - 1]).toBe(0);
    for (const x of p.x) expect(x).toBeGreaterThanOrEqual(0);
    for (const x of p.x) expect(x).toBeLessThanOrEqual(BOX.w);
    for (const y of p.y) expect(y).toBeGreaterThanOrEqual(0);
    for (const y of p.y) expect(y).toBeLessThanOrEqual(BOX.h);
  }
});

test("it passes behind the blade: where it crosses the blade at the back, it is hidden by it", () => {
  const half = BLADE.w / 2;
  const axis = BLADE.x + half;
  const head = dragonPath(0);
  let behind = 0;
  head.x.forEach((x, i) => {
    // Seconds since it rose: past its birth out of the pool (small, in front), before the dive.
    const t = (head.times[i] ?? 0) * FX.flight.length;
    const coiling = t > 0.2 && t < SIG.coil;
    const back = (head.scale[i] ?? 1) < 0.75;
    const crossing = Math.abs(x - axis) < half && (head.y[i] ?? 0) > BLADE.tipY;
    if (coiling && back && crossing) {
      behind++;
      expect(head.opacity[i]).toBeLessThanOrEqual(0.15);
    }
  });
  expect(behind).toBeGreaterThan(0);
});

test("the veins light down the blade as it dives, the last as it rings; no empty beat before the piece", () => {
  expect(VEIN_BANDS).toHaveLength(3);
  for (let i = 1; i < VEIN_BANDS.length; i++) expect(FX.vein(i).delay).toBeGreaterThan(FX.vein(i - 1).delay);
  expect(FX.vein(0).delay).toBeGreaterThanOrEqual(FX.dive.delay);
  expect(FX.vein(VEIN_BANDS.length - 1).delay + FX.vein(VEIN_BANDS.length - 1).length).toBeLessThanOrEqual(SIG.ring + 1e-9);
  // Bands tile the blade from its tip to its guard.
  expect(VEIN_BANDS[0]?.top).toBe(0);
  for (let i = 1; i < VEIN_BANDS.length; i++) expect(VEIN_BANDS[i]?.top).toBe((VEIN_BANDS[i - 1]?.top ?? 0) + (VEIN_BANDS[i - 1]?.h ?? 0));
  expect(SIG.end - SIG.ring).toBeLessThanOrEqual(0.6);
  expect(FX.lift.delay + FX.lift.length).toBeLessThanOrEqual(SIG.end + 1e-9);
  expect(FX.fade.delay + FX.fade.length).toBeLessThanOrEqual(SIG.end + 1e-9);
});

test("its art: Đông Hồ SVGs under 6 KB, no filter, gradient or embedded image", () => {
  for (const file of ["ink-dragon-head.svg", "ink-dragon-body.svg", "ink-dragon-tail.svg", "ink-dragon-blade.svg", "ink-dragon-veins.svg"]) {
    const svg = readFileSync(`src/assets/gacha/${file}`, "utf8");
    expect(svg.length, file).toBeLessThan(6 * 1024);
    expect(svg, file).not.toMatch(/filter|Gradient|<image/);
  }
});
