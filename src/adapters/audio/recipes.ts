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
  D4: 293.66, E4: 329.63, G4: 392, A4: 440,
  D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, D6: 1174.66,
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

/** One bamboo stick knocking on the tube: a very short noise burst through a narrow band. */
function rattle(s: Score, start: number, freq: number, level: number): void {
  const src = s.ctx.createBufferSource();
  src.buffer = noise(s.ctx);
  const band = filter(s.ctx, "bandpass", freq, 6);
  const end = start + 0.035;
  const g = envelope(s, start, level, 0.001, end);
  src.connect(band).connect(g).connect(s.out);
  s.run(src, start, end);
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

// The gacha (spec sound-and-reveal §4.4): the tube rattles, the omen grows with the best rarity of the pull (wood, jade
// bells, a gong, the great gong), and each card rings its own rarity as it turns, louder for a rarer piece.

/** The sticks rattle in the bamboo tube: uneven knocks, high and woody. One per shake of the tube (≈ 0.7 s). ≤ 450 ms. */
const gachaShake = score((s, t) => {
  const knocks = [
    { at: 0, f: 2300, l: 1.5 },
    { at: 0.055, f: 1750, l: 1.2 },
    { at: 0.1, f: 2650, l: 1.35 },
    { at: 0.19, f: 1950, l: 1.65 },
    { at: 0.235, f: 2450, l: 1.05 },
    { at: 0.33, f: 1850, l: 1.35 },
    { at: 0.37, f: 2550, l: 0.9 },
  ];
  for (const k of knocks) rattle(s, t + k.at, k.f, k.l);
  wood(s, t + 0.19, 640, 0.3, 0.06, true); // the tube itself, felt more than heard
});

/** Common: one dry clack of wood, and nothing more (a pull of commons stays brief). ≤ 200 ms. */
const omenCommon = score((s, t) => wood(s, t, 760, 1.3, 0.14));

/** Rare: three small jade bells, one after the other, with a breath of air around them. ≤ 1.6 s. */
const omenRare = score((s, t) => {
  [N.D6 * 2, N.E5 * 4, N.A5 * 3].forEach((f, i) => bell(s, t + i * 0.12, f, 0.16, 1.3));
  whoosh(s, t, 0.9, 3500, 7000, 0.035, 0.35, 0.7);
});

/** Epic: a gong of middle pitch, then the « whoosh » of the lanterns coming down (0.36 s in, with the picture). ≤ 2.2 s. */
const omenEpic = score((s, t) => {
  gong(s, t, 196, 0.19, 2.2);
  whoosh(s, t + 0.36, 0.42, 380, 1500, 0.16, 0.2, 1);
});

/**
 * Legendary: the great low gong, ~0.6 s of held breath where only it rings, then a shimmering rise of bells and air as
 * the gold floods the altar (0.94 s in, with the picture). ≤ 3 s.
 */
const omenLegendary = score((s, t) => {
  gong(s, t, 73.42, 0.6, 2.9); // D2
  gong(s, t, 146.83, 0.34, 2.4); // its octave carries the strike on a phone speaker
  wood(s, t, 300, 0.25, 0.12, true); // the mallet: phone speakers barely play the fundamental
  const rise = t + 0.94;
  whoosh(s, rise - 0.3, 1.2, 500, 6000, 0.12, 0.9, 0.8);
  [N.D5, N.E5, N.G5, N.A5, N.D6, N.D6 * 1.122, N.D6 * 1.335].forEach((f, i) => bell(s, rise + i * 0.085, f * 2, 0.05 + i * 0.015, 1.0 + i * 0.06));
});

/** The flips: the same instruments, short (≤ 600 ms) and louder for a rarer piece. */
const flipCommon = score((s, t) => wood(s, t, 880, 1.3, 0.09));
const flipRare = score((s, t) => {
  bell(s, t, N.E5 * 4, 0.22, 0.55);
  bell(s, t + 0.07, N.A5 * 3, 0.18, 0.5);
});
const flipEpic = score((s, t) => {
  wood(s, t, 520, 0.3, 0.08);
  gong(s, t, 233, 0.2, 0.6);
});
const flipLegendary = score((s, t) => {
  wood(s, t, 300, 0.38, 0.1, true);
  gong(s, t, 110, 0.6, 0.6);
  gong(s, t, 220, 0.2, 0.55);
  bell(s, t + 0.05, N.D6 * 2, 0.1, 0.5);
});

// The signature of La gardienne des talismans (spec sound-and-reveal §6.2): the gust, a brush stroke per seal, the gong.

/** A breath of wind: band-passed noise that swells, gusts twice and dies away, with a hiss of air above it. */
function gust(s: Score, start: number, length: number, level: number): void {
  const body = s.ctx.createBufferSource();
  body.buffer = noise(s.ctx);
  const band = filter(s.ctx, "bandpass", 260, 0.9);
  band.frequency.setValueAtTime(260, start);
  band.frequency.exponentialRampToValueAtTime(900, start + length * 0.4);
  band.frequency.exponentialRampToValueAtTime(520, start + length * 0.62);
  band.frequency.exponentialRampToValueAtTime(1100, start + length * 0.78);
  band.frequency.exponentialRampToValueAtTime(320, start + length);
  const g = s.ctx.createGain();
  g.gain.setValueAtTime(SILENT, start);
  g.gain.linearRampToValueAtTime(level, start + length * 0.38);
  g.gain.linearRampToValueAtTime(level * 0.55, start + length * 0.6);
  g.gain.linearRampToValueAtTime(level * 0.9, start + length * 0.76);
  g.gain.exponentialRampToValueAtTime(SILENT, start + length);
  body.connect(band).connect(g).connect(s.out);
  s.run(body, start, start + length);
  // The hiss of the air above it.
  const air = s.ctx.createBufferSource();
  air.buffer = noise(s.ctx);
  const hiss = filter(s.ctx, "highpass", 3200, 0.5);
  const ga = envelope(s, start, level * 0.22, length * 0.45, start + length);
  air.connect(hiss).connect(ga).connect(s.out);
  s.run(air, start, start + length);
}

/** The gust that tears the talismans off the altar. ≈ 2.2 s. */
const sigWind = score((s, t) => gust(s, t, 2.2, 0.55));

/** A brush slapping paper: a dry, bright scuff and the soft thump of the sheet. ≤ 150 ms. */
const sigBrush = score((s, t) => {
  whoosh(s, t, 0.09, 4200, 1800, 0.5, 0.004, 1.4);
  const paper = s.ctx.createBufferSource();
  paper.buffer = noise(s.ctx);
  const dry = filter(s.ctx, "highpass", 1500, 0.7);
  const g = envelope(s, t, 0.32, 0.002, t + 0.05);
  paper.connect(dry).connect(g).connect(s.out);
  s.run(paper, t, t + 0.05);
  wood(s, t + 0.01, 240, 0.22, 0.07, true);
});

/** The last gong: deep, struck hard, with a long tail; its octave and fifth carry it on a phone speaker. ≈ 4.5 s. */
const sigGong = score((s, t) => {
  gong(s, t, 55, 0.65, 4.5); // A1
  gong(s, t, 110, 0.42, 4);
  gong(s, t, 164.81, 0.14, 3.2);
  thud(s, t, 120, 0.6, 0.4);
  wood(s, t, 260, 0.3, 0.12, true); // the mallet
});

// The signature of L'épée du dragon (spec more-banners §4.4): the roar of the ink dragon, the ring of the blade.

/**
 * The ink dragon rising: a deep growl and a rumble, ≈ 1.5 s. Low detuned saws through a lowpass that opens like a jaw
 * then closes, roughened by a fast flutter (the throat); a rumble of low noise under it; a band of growling noise in
 * the mid range carries it on a phone speaker, which barely plays the low voices.
 */
const sigRoar = score((s, t) => {
  const len = 1.5;
  const end = t + len;
  // The throat's flutter: a gain whose level is shaken ≈ 28 times a second.
  const throat = s.ctx.createGain();
  throat.gain.value = 0.7;
  const flutter = s.ctx.createOscillator();
  flutter.type = "triangle";
  flutter.frequency.setValueAtTime(22, t);
  flutter.frequency.linearRampToValueAtTime(32, t + len * 0.4);
  flutter.frequency.linearRampToValueAtTime(18, end);
  const depth = s.ctx.createGain();
  depth.gain.value = 0.3;
  flutter.connect(depth).connect(throat.gain);
  s.run(flutter, t, end);
  const shape = envelope(s, t, 1, len * 0.22, end, len * 0.28);
  throat.connect(shape).connect(s.out);

  // The voice: three detuned saws, the jaw opening and closing (lowpass sweep), a slight fall in pitch.
  const jaw = filter(s.ctx, "lowpass", 220, 4);
  jaw.frequency.setValueAtTime(220, t);
  jaw.frequency.exponentialRampToValueAtTime(950, t + len * 0.3);
  jaw.frequency.exponentialRampToValueAtTime(600, t + len * 0.55);
  jaw.frequency.exponentialRampToValueAtTime(180, end);
  jaw.connect(throat);
  for (const v of [
    { f: 55, level: 0.22 },
    { f: 57.4, level: 0.18 },
    { f: 82.4, level: 0.12 },
  ]) {
    const osc = s.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(v.f * 1.08, t);
    osc.frequency.exponentialRampToValueAtTime(v.f, t + len * 0.3);
    osc.frequency.exponentialRampToValueAtTime(v.f * 0.86, end);
    const g = s.ctx.createGain();
    g.gain.value = v.level;
    osc.connect(g).connect(jaw);
    s.run(osc, t, end);
  }

  // The growl a phone speaker can play: band-passed noise in the mid range, shaken by the same throat.
  const rasp = s.ctx.createBufferSource();
  rasp.buffer = noise(s.ctx);
  const band = filter(s.ctx, "bandpass", 420, 2.2);
  band.frequency.setValueAtTime(380, t);
  band.frequency.exponentialRampToValueAtTime(820, t + len * 0.3);
  band.frequency.exponentialRampToValueAtTime(300, end);
  const gr = s.ctx.createGain();
  gr.gain.value = 0.55;
  rasp.connect(band).connect(gr).connect(throat);
  s.run(rasp, t, end);

  // The rumble: low noise that swells and lingers, felt more than heard.
  const rumble = s.ctx.createBufferSource();
  rumble.buffer = noise(s.ctx);
  const low = filter(s.ctx, "lowpass", 140, 0.8);
  const gu = envelope(s, t, 0.5, len * 0.35, end);
  rumble.connect(low).connect(gu).connect(s.out);
  s.run(rumble, t, end);
});

/**
 * The blade lit: a short « shing » of steel, then a bright metallic ring that sings on, beating softly (two partials a
 * few hertz apart), with a high shimmer of gold. ≈ 1.8 s.
 */
const sigBlade = score((s, t) => {
  swish(s, t, 0.12, 0.5, 0.03, 2600, 7000);
  metal(s, t + 0.08, 1760, 0.22, 0.6);
  for (const p of [
    { f: 2489, amp: 0.12, len: 1.8 },
    { f: 2493.5, amp: 0.1, len: 1.7 }, // the beat of a long blade
    { f: 3951, amp: 0.05, len: 1.1 },
    { f: 5274, amp: 0.025, len: 0.7 },
  ]) {
    const osc = s.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = p.f;
    const end = t + 0.08 + p.len;
    const g = envelope(s, t + 0.08, p.amp, 0.002, end);
    osc.connect(g).connect(s.out);
    s.run(osc, t + 0.08, end);
  }
  bell(s, t + 0.1, 3135.96, 0.05, 0.9); // G7, the gold
});

// The fights (spec sound-and-reveal §4.2): each fighter strikes with the sound of its gear. A blow is ≤ 450 ms, so it
// ends before the defender's recoil; a critical (`strong`) strikes sharper here, the player also plays it louder.

/** How hard a blow lands: a critical has a near-instant attack and a little more body. */
const force = (strong: boolean) => ({ k: strong ? 1.25 : 1, attack: (normal: number) => (strong ? Math.min(normal, 0.006) : normal) });

/** A short burst of filtered noise: a scuff, a tick, a crackle. */
function burst(s: Score, start: number, type: BiquadFilterType, freq: number, q: number, level: number, length: number): void {
  const src = s.ctx.createBufferSource();
  src.buffer = noise(s.ctx);
  const f = filter(s.ctx, type, freq, q);
  const g = envelope(s, start, level, 0.001, start + length);
  src.connect(f).connect(g).connect(s.out);
  s.run(src, start, start + length);
}

/** Struck metal: a bright tick and a few inharmonic partials that die fast (a blade, a coin, an iron rib). */
function metal(s: Score, start: number, freq: number, level: number, length: number): void {
  burst(s, start, "highpass", 5000, 0.7, level * 0.8, 0.025);
  [
    { ratio: 1, amp: 1, decay: 1 },
    { ratio: 2.32, amp: 0.55, decay: 0.6 },
    { ratio: 3.86, amp: 0.3, decay: 0.35 },
  ].forEach((p) => {
    const osc = s.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * p.ratio;
    const end = start + length * p.decay;
    const g = envelope(s, start, level * p.amp, 0.001, end);
    osc.connect(g).connect(s.out);
    s.run(osc, start, end);
  });
}

/** The swish of an edge through the air: narrow, rising high. */
function swish(s: Score, start: number, length: number, level: number, attack: number, from = 1800, to = 5200): void {
  whoosh(s, start, length, from, to, level, attack, 1.8);
}

/** Lame: a metallic swish and the ring of steel. ≈ 0.4 s. */
const blowBlade = score((s, t, strong) => {
  const f = force(strong);
  swish(s, t, 0.13, 0.6 * f.k, f.attack(0.05));
  metal(s, t + 0.11, 2400, 0.2 * f.k, 0.28);
});

/** Bâton ou lance: a broad wooden whoosh and the thock of the shaft. ≈ 0.3 s. */
const blowStaff = score((s, t, strong) => {
  const f = force(strong);
  whoosh(s, t, 0.17, 380, 1100, 0.38 * f.k, f.attack(0.07), 0.9);
  wood(s, t + 0.15, 430, 0.55 * f.k, 0.11);
  thud(s, t + 0.15, 210, 0.3 * f.k, 0.12, f.attack(0.004));
});

/** Éventail: the paper flaps twice as it opens, then the iron ribs snap shut. ≈ 0.25 s. */
const blowFan = score((s, t, strong) => {
  const f = force(strong);
  whoosh(s, t, 0.06, 800, 1500, 0.55 * f.k, f.attack(0.02), 0.8);
  whoosh(s, t + 0.065, 0.07, 900, 1700, 0.6 * f.k, f.attack(0.02), 0.8);
  burst(s, t + 0.15, "bandpass", 3200, 9, 1.8 * f.k, 0.03);
  metal(s, t + 0.15, 1850, 0.14 * f.k, 0.09);
});

/** Poings: a short body thump; a muted knock carries it on a phone speaker. ≈ 0.22 s. */
const blowFist = score((s, t, strong) => {
  const f = force(strong);
  whoosh(s, t, 0.06, 600, 1200, 0.16, f.attack(0.025));
  thud(s, t + 0.05, 140, 0.5 * f.k, 0.16, f.attack(0.004));
  wood(s, t + 0.05, 300, 0.26 * f.k, 0.07, true);
});

/** L'épée Thuận Thiên (epic): the blade's swish, then a jade ring that sings on. ≈ 0.45 s. */
const blowThuanThien = score((s, t, strong) => {
  const f = force(strong);
  swish(s, t, 0.13, 0.42 * f.k, f.attack(0.05), 1600, 4800);
  metal(s, t + 0.11, 2400, 0.07 * f.k, 0.12);
  bell(s, t + 0.11, 1567.98, 0.16 * f.k, 0.34); // G6, jade
  bell(s, t + 0.13, 2349.32, 0.06 * f.k, 0.3); // D7 above it
  gong(s, t + 0.11, 523.25, 0.05 * f.k, 0.32); // a breath of resonance under the ring
});

/** Pháp sư (legendary), bare-handed: paper talismans crackle in the air, a soft bell seals the spell. ≈ 0.42 s. */
const blowPhapSu = score((s, t, strong) => {
  const f = force(strong);
  const ticks = [
    { at: 0, f: 3400, l: 0.9 },
    { at: 0.022, f: 5200, l: 0.6 },
    { at: 0.041, f: 2800, l: 1 },
    { at: 0.07, f: 4600, l: 0.7 },
    { at: 0.088, f: 3900, l: 0.85 },
    { at: 0.115, f: 3000, l: 0.55 },
  ];
  for (const k of ticks) burst(s, t + k.at, "bandpass", k.f, 3, k.l * 1.3 * f.k, 0.022);
  whoosh(s, t, 0.12, 1200, 2600, 0.2 * f.k, f.attack(0.04), 1.4);
  bell(s, t + 0.12, 2093, 0.13 * f.k, 0.3); // C7
});

/** Kiếm khách (epic), bare-handed: two quick swishes, back and forth, light as a feint. ≈ 0.3 s. */
const blowKiemKhach = score((s, t, strong) => {
  const f = force(strong);
  swish(s, t, 0.08, 0.6 * f.k, f.attack(0.025), 2200, 6000);
  swish(s, t + 0.1, 0.09, 0.7 * f.k, f.attack(0.02), 2400, 6600);
  metal(s, t + 0.17, 3136, 0.1 * f.k, 0.13);
});

/** Dégâts: a dull impact, felt in the chest. ≤ 0.26 s. */
const fightHurt = score((s, t) => {
  thud(s, t, 95, 0.7, 0.24);
  wood(s, t, 260, 0.3, 0.1, true);
});

/** Raté: only the air the blow moved. ≈ 0.26 s. */
const fightMiss = score((s, t) => whoosh(s, t, 0.26, 320, 1300, 0.34, 0.11, 0.7));

// The arena (spec sound-and-reveal §4.3).

/** The gong that opens a duel: middle-low, struck firmly, ringing about two seconds. */
const arenaStart = score((s, t) => {
  gong(s, t, 146.83, 0.34, 2.2); // D3
  gong(s, t, 293.66, 0.13, 1.7); // its octave carries it on a phone speaker
  wood(s, t, 280, 0.28, 0.12, true); // the mallet
});

/** Victory: a light gong and a quick rising call of plucks, the last one ringing. ≤ 1.5 s. */
const arenaVictory = score((s, t) => {
  gong(s, t, 196, 0.16, 1.3);
  const call = [
    { at: 0.02, f: N.D5, length: 0.3 },
    { at: 0.12, f: N.D5, length: 0.3 },
    { at: 0.22, f: N.A5, length: 0.4 },
  ];
  for (const c of call) pluck(s, t + c.at, c.f, { length: c.length, level: 0.42, bright: 7 });
  pluck(s, t + 0.38, N.D6, { length: 1.1, level: 0.5, bright: 6, ring: 1.5 });
  bell(s, t + 0.38, N.D6 * 2, 0.06, 0.9);
});

/** Defeat: two soft plucks going down, the last one sagging (luyến). Sober, never a buzzer. ≤ 1.2 s. */
const arenaDefeat = score((s, t) => {
  pluck(s, t, N.G4, { length: 0.5, level: 0.5, bright: 3 });
  pluck(s, t + 0.26, N.D4, { length: 0.9, level: 0.56, bright: 3, ring: 1.2, bend: { from: 1, to: 0.95, start: 0.2, time: 0.4 } });
});

/** Kim bài: a few small coins clinking together. ≤ 0.5 s. */
const arenaCoins = score((s, t) => {
  const clinks = [
    { at: 0, f: 3520, l: 0.12 },
    { at: 0.065, f: 4186, l: 0.1 },
    { at: 0.14, f: 3729, l: 0.11 },
    { at: 0.19, f: 4435, l: 0.08 },
  ];
  for (const c of clinks) metal(s, t + c.at, c.f, c.l, 0.22);
});

export const recipes: Record<SoundCue, Recipe> = {
  "answer.correct": answerCorrect,
  "answer.wrong": answerWrong,
  "lesson.won": lessonWon,
  "lesson.lost": lessonLost,
  "heart.lost": heartLost,

  "gacha.shake": gachaShake,
  "gacha.omen.common": omenCommon,
  "gacha.omen.rare": omenRare,
  "gacha.omen.epic": omenEpic,
  "gacha.omen.legendary": omenLegendary,
  "gacha.flip.common": flipCommon,
  "gacha.flip.rare": flipRare,
  "gacha.flip.epic": flipEpic,
  "gacha.flip.legendary": flipLegendary,

  "sig.wind": sigWind,
  "sig.brush": sigBrush,
  "sig.gong": sigGong,
  "sig.roar": sigRoar,
  "sig.blade": sigBlade,

  "blow.blade": blowBlade,
  "blow.staff": blowStaff,
  "blow.fan": blowFan,
  "blow.fist": blowFist,
  "blow.acc_thuan_thien": blowThuanThien,
  "blow.char_phap_su": blowPhapSu,
  "blow.char_kiem_khach": blowKiemKhach,

  "fight.hurt": fightHurt,
  "fight.miss": fightMiss,
  "arena.start": arenaStart,
  "arena.victory": arenaVictory,
  "arena.defeat": arenaDefeat,
  "arena.coins": arenaCoins,
};

