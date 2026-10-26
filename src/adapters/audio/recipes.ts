import type { SoundCue } from "@/domain/sound";

/**
 * How each cue sounds, synthesized live with Web Audio (no files). The palette is stylized Vietnamese instruments:
 * the mõ wood block, plucked strings in the manner of the đàn tranh (Karplus–Strong strings, with its pitch bends),
 * small bells and gongs. A recipe schedules everything from `at` into `out` and returns when it ends.
 */
export type Voice = { stop(at: number): void; end: number };
export type Recipe = (ctx: AudioContext, out: AudioNode, at: number, strong: boolean) => Voice;

const SILENT = 0.0001; // exponential ramps cannot reach 0

// Pitches (Hz). Lesson cues use the anhemitonic pentatonic the Vietnamese ear knows (ngũ cung).
const N = {
  A3: 220, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
  D5: 587.33, E5: 659.26, Fs5: 739.99, G5: 783.99, A5: 880, D6: 1174.66,
} as const;

/** Collects the sources a recipe starts, so the whole cue can be stopped and its end known. */
class Score {
  private readonly sources: AudioScheduledSourceNode[] = [];
  end: number;
  constructor(readonly ctx: AudioContext, readonly out: AudioNode, readonly at: number) {
    this.end = at;
  }
  run(src: AudioScheduledSourceNode, start: number, stop: number): void {
    src.start(start);
    src.stop(stop);
    this.sources.push(src);
    this.end = Math.max(this.end, stop);
  }
  voice(): Voice {
    return {
      end: this.end,
      stop: (at) => {
        for (const s of this.sources) {
          try {
            s.stop(at);
          } catch {
            // Older Safari refuses a second stop(); the player has already faded this cue out.
          }
        }
      },
    };
  }
}

/** A gain with a percussive envelope: quick rise to `peak`, exponential fall until `end`. */
function envelope(s: Score, start: number, peak: number, attack: number, end: number, hold = 0): GainNode {
  const g = s.ctx.createGain();
  g.gain.setValueAtTime(SILENT, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, start + attack + hold);
  g.gain.exponentialRampToValueAtTime(SILENT, end);
  return g;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

// --- Buffers (cached per context) ---------------------------------------------------------------------------------

/** Deterministic pseudo-random numbers: every pluck of a note sounds the same, and tests are stable. */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const length = Math.ceil(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = lcg(7);
  for (let i = 0; i < length; i++) data[i] = rand() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

type StringTone = { buffer: AudioBuffer; rate: number };
const stringCache = new WeakMap<BaseAudioContext, Map<string, StringTone>>();

/**
 * A plucked string (Karplus–Strong), rendered once per note. The loop length is rounded to whole samples, so the
 * returned `rate` (playback rate) puts the note exactly back in tune. `ring` is the time to fade by 60 dB.
 */
function stringTone(ctx: AudioContext, freq: number, length: number, ring: number): StringTone {
  const key = `${freq}|${length}|${ring}`;
  let byKey = stringCache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    stringCache.set(ctx, byKey);
  }
  const cached = byKey.get(key);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const n = Math.max(period + 2, Math.ceil(length * sr));
  const buffer = ctx.createBuffer(1, n, sr);
  const d = buffer.getChannelData(0);
  // Excitation: softened noise (a fingertip pluck, not a pick), without DC.
  const rand = lcg(Math.round(freq * 10));
  let smooth = 0;
  let mean = 0;
  for (let i = 0; i < period; i++) {
    smooth += 0.55 * (rand() * 2 - 1 - smooth);
    d[i] = smooth;
    mean += smooth;
  }
  mean /= period;
  for (let i = 0; i < period; i++) d[i] = (d[i] ?? 0) - mean;
  const loss = Math.pow(0.001, period / (ring * sr));
  for (let i = period; i < n; i++) d[i] = loss * 0.5 * ((d[i - period] ?? 0) + (d[i - period - 1] ?? d[i - period] ?? 0));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i] ?? 0));
  if (peak > 0) for (let i = 0; i < n; i++) d[i] = (d[i] ?? 0) / peak;
  const tone = { buffer, rate: (freq * (period + 0.5)) / sr }; // the two-point average adds half a sample of delay
  byKey.set(key, tone);
  return tone;
}

// --- Instruments --------------------------------------------------------------------------------------------------

type PluckOptions = {
  length: number; // seconds until silent
  level: number;
  bright?: number; // low-pass cutoff as a multiple of the pitch
  ring?: number; // natural decay of the string, seconds
  bend?: { from: number; to: number; start: number; time: number }; // đàn tranh nhấn/luyến: ratios, offsets in s
};

/** A đàn tranh-like pluck. */
function pluck(s: Score, start: number, freq: number, o: PluckOptions): void {
  const { buffer, rate } = stringTone(s.ctx, freq, o.length, o.ring ?? 1.2);
  const src = s.ctx.createBufferSource();
  src.buffer = buffer;
  const bend = o.bend;
  src.playbackRate.setValueAtTime(rate * (bend ? bend.from : 1), start);
  if (bend) {
    src.playbackRate.setValueAtTime(rate * bend.from, start + bend.start);
    src.playbackRate.linearRampToValueAtTime(rate * bend.to, start + bend.start + bend.time);
  }
  const tone = filter(s.ctx, "lowpass", Math.min(12000, freq * (o.bright ?? 6)));
  const end = start + o.length;
  const g = envelope(s, start, o.level, 0.003, end, o.length * 0.35);
  src.connect(tone).connect(g).connect(s.out);
  s.run(src, start, end);
}

/** The mõ: a hollow wooden knock (a resonant band of noise and a short falling sine). */
function wood(s: Score, start: number, freq: number, level: number, length = 0.08, muted = false): void {
  const strike = s.ctx.createBufferSource();
  strike.buffer = noise(s.ctx);
  const body = filter(s.ctx, "bandpass", freq, muted ? 5 : 14);
  const g1 = envelope(s, start, level * 1.6, 0.001, start + length * 0.6);
  strike.connect(body).connect(g1).connect(s.out);
  s.run(strike, start, start + length * 0.6);

  const osc = s.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.08, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + 0.015);
  const g2 = envelope(s, start, level * (muted ? 0.45 : 0.6), 0.002, start + length);
  const out = muted ? filter(s.ctx, "lowpass", freq * 1.5) : null;
  if (out) osc.connect(g2).connect(out).connect(s.out);
  else osc.connect(g2).connect(s.out);
  s.run(osc, start, start + length);
}

/** A dry, low body blow: a falling sine and a short dull noise. */
function thud(s: Score, start: number, freq: number, level: number, length: number, attack = 0.003): void {
  const osc = s.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, start + length * 0.6);
  const g = envelope(s, start, level, attack, start + length);
  osc.connect(g).connect(s.out);
  s.run(osc, start, start + length);

  const hit = s.ctx.createBufferSource();
  hit.buffer = noise(s.ctx);
  const dull = filter(s.ctx, "lowpass", 1100);
  const gn = envelope(s, start, level * 0.7, 0.001, start + Math.min(0.07, length));
  hit.connect(dull).connect(gn).connect(s.out);
  s.run(hit, start, start + Math.min(0.07, length));
}

const BELL = [
  { ratio: 1, amp: 1, decay: 1 },
  { ratio: 2.76, amp: 0.45, decay: 0.55 },
  { ratio: 5.4, amp: 0.22, decay: 0.3 },
  { ratio: 8.93, amp: 0.1, decay: 0.18 },
];
/** A small bell (clochette), inharmonic partials. */
function bell(s: Score, start: number, freq: number, level: number, length: number): void {
  for (const p of BELL) {
    const osc = s.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * p.ratio;
    const end = start + length * p.decay;
    const g = envelope(s, start, level * p.amp, 0.002, end);
    osc.connect(g).connect(s.out);
    s.run(osc, start, end);
  }
}

const GONG = [
  { ratio: 1, amp: 1, decay: 1, bloom: 0.02 },
  { ratio: 1.52, amp: 0.55, decay: 0.8, bloom: 0.06 },
  { ratio: 2.03, amp: 0.5, decay: 0.65, bloom: 0.1 },
  { ratio: 2.63, amp: 0.32, decay: 0.5, bloom: 0.16 },
  { ratio: 3.31, amp: 0.22, decay: 0.4, bloom: 0.22 },
  { ratio: 4.12, amp: 0.14, decay: 0.3, bloom: 0.28 },
];
/** A gong: a soft mallet strike, partials that bloom one after another, a slight downward glide. */
function gong(s: Score, start: number, freq: number, level: number, length: number): void {
  for (const p of GONG) {
    const osc = s.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * p.ratio * 1.02, start);
    osc.frequency.exponentialRampToValueAtTime(freq * p.ratio, start + 0.5);
    const end = start + length * p.decay;
    const g = envelope(s, start, level * p.amp, p.bloom, end, 0.05);
    osc.connect(g).connect(s.out);
    s.run(osc, start, end);
  }
  const mallet = s.ctx.createBufferSource();
  mallet.buffer = noise(s.ctx);
  const soft = filter(s.ctx, "lowpass", freq * 6);
  const gm = envelope(s, start, level * 0.5, 0.002, start + 0.09);
  mallet.connect(soft).connect(gm).connect(s.out);
  s.run(mallet, start, start + 0.09);
}

/** Air moved: band-passed noise sweeping from one pitch to another. */
function whoosh(s: Score, start: number, length: number, from: number, to: number, level: number, attack = length * 0.4, q = 1.2): void {
  const src = s.ctx.createBufferSource();
  src.buffer = noise(s.ctx);
  const band = filter(s.ctx, "bandpass", from, q);
  band.frequency.setValueAtTime(from, start);
  band.frequency.exponentialRampToValueAtTime(to, start + length);
  const g = envelope(s, start, level, attack, start + length);
  src.connect(band).connect(g).connect(s.out);
  s.run(src, start, start + length);
}

// --- Recipes ------------------------------------------------------------------------------------------------------

function score(build: (s: Score, t: number, strong: boolean) => void): Recipe {
  return (ctx, out, at, strong) => {
    const s = new Score(ctx, out, at);
    build(s, at, strong);
    return s.voice();
  };
}

/** Bright knock then two quick plucks a fifth apart: short and light, it is heard hundreds of times. ≤ 250 ms. */
const answerCorrect = score((s, t) => {
  wood(s, t, 1046, 0.35, 0.06);
  pluck(s, t + 0.025, N.D5, { length: 0.14, level: 0.45, bright: 7 });
  pluck(s, t + 0.08, N.A5, { length: 0.165, level: 0.5, bright: 7 });
});

/** Two soft, muted knocks going down: “not quite”, never a buzzer. ≤ 200 ms. */
const answerWrong = score((s, t) => {
  wood(s, t, 330, 0.42, 0.1, true);
  wood(s, t + 0.075, 262, 0.34, 0.12, true);
});

/** The same family as a correct answer, opened up: a rising pentatonic run ending on a bent, ringing note. ≤ 1.6 s. */
const lessonWon = score((s, t) => {
  wood(s, t, 1046, 0.32, 0.07);
  const run = [N.D5, N.E5, N.G5, N.A5];
  run.forEach((f, i) => pluck(s, t + 0.04 + i * 0.1, f, { length: 0.5, level: 0.42, bright: 7 }));
  const last = t + 0.46;
  pluck(s, last, N.D6, { length: 1.12, level: 0.5, bright: 6, ring: 1.6, bend: { from: 0.944, to: 1, start: 0, time: 0.09 } });
  bell(s, last + 0.02, N.D6 * 2, 0.06, 1.0);
});

/** A dry blow and a short scuff. ≤ 300 ms. */
const heartLost = score((s, t) => {
  // Phone speakers barely reproduce the low body, so a muted knock carries the blow.
  thud(s, t, 170, 0.6, 0.26);
  wood(s, t, 420, 0.4, 0.12, true);
  whoosh(s, t, 0.08, 1800, 700, 0.18, 0.004, 0.8);
});

/** A slow, low descending phrase whose last note sags (luyến), soft-toned: a sigh, not a punishment. ≤ 1.5 s. */
const lessonLost = score((s, t) => {
  const steps = [N.A4, N.G4, N.E4];
  steps.forEach((f, i) => pluck(s, t + i * 0.22, f, { length: 0.6, level: 0.7, bright: 3.5 }));
  pluck(s, t + 0.68, N.D4, { length: 0.8, level: 0.8, bright: 3, ring: 1.4, bend: { from: 1, to: 0.95, start: 0.22, time: 0.4 } });
});

/** Shared shapes for the cues Tasks 4–6 refine (gacha, signature, fights, arena). */
const blade = (ring: number) =>
  score((s, t, strong) => {
    whoosh(s, t, 0.14, 1400, 4200, strong ? 0.6 : 0.42, strong ? 0.01 : 0.05, 1.5);
    bell(s, t + 0.11, ring, 0.12, 0.28);
  });

export const recipes: Record<SoundCue, Recipe> = {
  "answer.correct": answerCorrect,
  "answer.wrong": answerWrong,
  "lesson.won": lessonWon,
  "lesson.lost": lessonLost,
  "heart.lost": heartLost,

  "gacha.shake": score((s, t) => {
    [900, 760, 980].forEach((f, i) => wood(s, t + i * 0.05, f, 0.25, 0.05));
  }),
  "gacha.omen.common": score((s, t) => wood(s, t, 820, 0.4, 0.1)),
  "gacha.omen.rare": score((s, t) => {
    [1760, 2349, 2637].forEach((f, i) => bell(s, t + i * 0.09, f, 0.16, 1.2));
  }),
  "gacha.omen.epic": score((s, t) => gong(s, t, 220, 0.45, 2.2)),
  "gacha.omen.legendary": score((s, t) => {
    gong(s, t, 98, 0.55, 3.8);
    bell(s, t + 1.6, 1568, 0.08, 1.6);
  }),
  "gacha.flip.common": score((s, t) => wood(s, t, 950, 0.38, 0.08)),
  "gacha.flip.rare": score((s, t) => {
    bell(s, t, 1975, 0.16, 0.9);
    bell(s, t + 0.06, 2637, 0.12, 0.8);
  }),
  "gacha.flip.epic": score((s, t) => gong(s, t, 262, 0.42, 1.6)),
  "gacha.flip.legendary": score((s, t) => gong(s, t, 110, 0.5, 3.0)),

  "sig.wind": score((s, t) => whoosh(s, t, 2.0, 300, 1200, 0.3, 0.8, 0.9)),
  "sig.brush": score((s, t) => whoosh(s, t, 0.12, 2400, 900, 0.35, 0.01, 2)),
  "sig.gong": score((s, t) => gong(s, t, 82, 0.6, 3.5)),

  "blow.blade": blade(2400),
  "blow.staff": score((s, t, strong) => {
    whoosh(s, t, 0.16, 600, 1500, strong ? 0.5 : 0.36, strong ? 0.01 : 0.06);
    wood(s, t + 0.12, 500, 0.4, 0.09);
  }),
  "blow.fan": score((s, t, strong) => whoosh(s, t, 0.22, 800, 2500, strong ? 0.42 : 0.3, strong ? 0.02 : 0.09, 0.9)),
  "blow.fist": score((s, t, strong) => {
    whoosh(s, t, 0.08, 700, 1600, 0.25, 0.03);
    thud(s, t + 0.06, 150, strong ? 0.9 : 0.7, 0.18, strong ? 0.001 : 0.004);
  }),
  "blow.acc_thuan_thien": score((s, t, strong) => {
    whoosh(s, t, 0.14, 1400, 4200, strong ? 0.6 : 0.42, strong ? 0.01 : 0.05, 1.5);
    bell(s, t + 0.11, 1568, 0.14, 0.5);
    gong(s, t + 0.11, 523, 0.12, 0.6);
  }),
  "blow.char_phap_su": score((s, t) => {
    whoosh(s, t, 0.06, 2600, 1200, 0.3, 0.005, 2);
    whoosh(s, t + 0.09, 0.06, 2600, 1200, 0.3, 0.005, 2);
    bell(s, t + 0.14, 2093, 0.1, 0.4);
  }),
  "blow.char_kiem_khach": blade(3136),

  "fight.hurt": score((s, t) => thud(s, t, 100, 0.8, 0.24)),
  "fight.miss": score((s, t) => whoosh(s, t, 0.2, 400, 900, 0.22, 0.08)),
  "arena.start": score((s, t) => gong(s, t, 196, 0.5, 2.0)),
  "arena.victory": score((s, t) => {
    [N.D5, N.Fs5, N.A5].forEach((f, i) => pluck(s, t + i * 0.09, f, { length: 0.45, level: 0.42, bright: 7 }));
    pluck(s, t + 0.27, N.D6, { length: 1.0, level: 0.5, bright: 6, ring: 1.5 });
    bell(s, t + 0.27, N.D6 * 2, 0.07, 0.9);
  }),
  "arena.defeat": score((s, t) => {
    pluck(s, t, N.D4, { length: 0.6, level: 0.36, bright: 3 });
    pluck(s, t + 0.24, N.A3, { length: 0.9, level: 0.38, bright: 3, bend: { from: 1, to: 0.95, start: 0.2, time: 0.4 } });
  }),
  "arena.coins": score((s, t) => {
    [2637, 3136, 2637].forEach((f, i) => bell(s, t + i * 0.07, f, 0.1, 0.35));
  }),
};

