import { readFileSync } from "node:fs";
import { BUDGET, peakConcurrency, STAGE } from "@/features/shop/gachaReveal";
import { hasSignature, SIGNATURES } from "@/features/shop/signatures";
import { DragonSword } from "@/features/shop/signatures/DragonSword";
import { animatedSpans, AXIS, BLADE, BODY_TURNS, BOX, dragonCues, dragonPath, FX, MOUNTED, occluderPath, poseAt, SEGMENTS, SIG, SLICE_H, VEIN_BANDS } from "@/features/shop/signatures/dragonSchedule";

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

test("the dragon rises out of the altar, coils round the blade (big in front, smaller behind, solid ink), and dives into it", () => {
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
    // The coil: it rises, hugging the sword, and depth reads in its size.
    expect(Math.max(...p.y) - Math.min(...p.y)).toBeGreaterThanOrEqual(150);
    expect(Math.max(...p.scale)).toBeGreaterThanOrEqual(1.05);
    const solid = p.scale.filter((_, i) => (p.opacity[i] ?? 0) === 1);
    expect(Math.max(...solid) / Math.min(...solid)).toBeGreaterThanOrEqual(1.35);
    for (const x of p.x) expect(Math.abs(x - AXIS)).toBeLessThanOrEqual(55);
    // Into the blade: narrowed to it, it ends on the blade's axis, swallowed (invisible), never left lying around.
    expect(Math.min(...p.scaleY.map(Math.abs))).toBeLessThanOrEqual(0.45);
    expect(p.x[n - 1]).toBeCloseTo(AXIS, 0);
    expect(p.opacity[n - 1]).toBe(0);
    for (const y of p.y) expect(y).toBeGreaterThanOrEqual(0);
    for (const y of p.y) expect(y).toBeLessThanOrEqual(BOX.h);
  }
});

test("it truly coils: the body wraps three quarters of a turn at once, solid ink all round", () => {
  expect(BODY_TURNS).toBeGreaterThanOrEqual(0.75);
  // At the end of the head's coil, the body is still wrapped round the sword: in front of it and behind it at once.
  const at = SIG.rise + SIG.coil - 0.01;
  const pieces = Array.from({ length: SEGMENTS }, (_, k) => poseAt(k, at));
  expect(pieces.some((p) => p.depth > 0.5)).toBe(true);
  expect(pieces.some((p) => p.depth < -0.5)).toBe(true);
  expect(pieces.some((p) => p.x < AXIS - 20)).toBe(true);
  expect(pieces.some((p) => p.x > AXIS + 20)).toBe(true);
  // Never ghosted: once risen and until it plunges, every piece is fully opaque.
  for (let k = 0; k < SEGMENTS; k++) {
    for (let at = SIG.rise + k * SIG.lag + 0.2; at < SIG.headTip + k * SIG.lag; at += 0.02) expect(poseAt(k, at).opacity, `${k}@${at}`).toBe(1);
  }
});

test("behind the sword, a slice of the blade hides it; in front, nothing does", () => {
  const o = occluderPath();
  expect(o.y).toHaveLength(o.times.length);
  expect(o.opacity).toHaveLength(o.times.length);
  let hidden = 0;
  o.times.forEach((t, i) => {
    const at = FX.occluder.delay + t * FX.occluder.length;
    const pieces = Array.from({ length: SEGMENTS }, (_, k) => poseAt(k, at)).filter((p) => p.opacity > 0.05);
    const top = o.y[i] ?? 0;
    // A piece right behind the blade: the slice is on it.
    for (const p of pieces.filter((q) => q.depth < -0.2 && Math.abs(q.x - AXIS) <= BLADE.half)) {
      expect(o.opacity[i], `t=${at}`).toBe(1);
      expect(p.y).toBeGreaterThanOrEqual(top);
      expect(p.y).toBeLessThanOrEqual(top + SLICE_H);
      hidden++;
    }
    // While shown, no piece in front crosses it.
    if (o.opacity[i] === 1) {
      for (const p of pieces.filter((q) => q.depth > 0.2 && Math.abs(q.x - AXIS) <= BLADE.half)) {
        expect(p.y < top - 10 || p.y > top + SLICE_H + 10, `front at ${at}`).toBe(true);
      }
    }
  });
  expect(hidden).toBeGreaterThan(0);
  // Every pass behind is over before the veins light (the slice is of the unlit blade).
  for (let k = 0; k < SEGMENTS; k++) {
    for (let at = FX.occluder.delay + FX.occluder.length; at < SIG.ring; at += 0.02) {
      const p = poseAt(k, at);
      if (p.opacity > 0.05 && Math.abs(p.x - AXIS) <= BLADE.half + 13) expect(p.depth, `${k}@${at}`).toBeGreaterThanOrEqual(0);
    }
  }
});

test("the veins light down the blade as it dives, the last as it rings; no empty beat before the piece", () => {
  expect(VEIN_BANDS).toHaveLength(3);
  for (let i = 1; i < VEIN_BANDS.length; i++) expect(FX.vein(i).delay).toBeGreaterThan(FX.vein(i - 1).delay);
  expect(FX.vein(0).delay).toBe(SIG.headTip);
  expect(FX.vein(VEIN_BANDS.length - 1).delay + FX.vein(VEIN_BANDS.length - 1).length).toBeLessThanOrEqual(SIG.ring + 1e-9);
  // Bands tile the blade from its tip to its guard.
  expect(VEIN_BANDS[0]?.top).toBe(0);
  for (let i = 1; i < VEIN_BANDS.length; i++) expect(VEIN_BANDS[i]?.top).toBe((VEIN_BANDS[i - 1]?.top ?? 0) + (VEIN_BANDS[i - 1]?.h ?? 0));
  // The climax holds: the dark stays until the glow peaks, the lit sword stays whole until the dark has lifted, then
  // it gives way to the scroll at once (no empty beat).
  expect(FX.lift.delay).toBe(SIG.blazed);
  expect(SIG.blazed - SIG.ring).toBeGreaterThanOrEqual(0.2);
  expect(FX.lift.delay + FX.lift.length).toBe(SIG.lifted);
  expect(SIG.end - SIG.lifted).toBeLessThanOrEqual(0.15 + 1e-9);
  expect(SIG.end - SIG.ring).toBeLessThanOrEqual(0.75);
  expect(FX.fade.delay + FX.fade.length).toBeLessThanOrEqual(SIG.end + 1e-9);
});

test("its art: Đông Hồ SVGs under 6 KB, no filter, gradient or embedded image", () => {
  for (const file of ["ink-dragon-head.svg", "ink-dragon-body.svg", "ink-dragon-tail.svg", "ink-dragon-blade.svg", "ink-dragon-veins.svg"]) {
    const svg = readFileSync(`src/assets/gacha/${file}`, "utf8");
    expect(svg.length, file).toBeLessThan(6 * 1024);
    expect(svg, file).not.toMatch(/filter|Gradient|<image/);
  }
});
