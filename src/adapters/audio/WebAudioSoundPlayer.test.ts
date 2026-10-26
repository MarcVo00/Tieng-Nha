import { SOUND_CUES, type SoundCue } from "@/domain/sound";
import { WebAudioSoundPlayer } from "@/adapters/audio/WebAudioSoundPlayer";
import { recipes } from "@/adapters/audio/recipes";

// A minimal AudioContext stand-in: records every node, param event and start/stop so tests can see what would sound.
type ParamEvent = { type: string; value: number; time: number };
class FakeParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(value = 1) {
    this.value = value;
  }
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: "set", value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "linear", value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "exp", value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number) {
    this.events.push({ type: "target", value, time });
    return this;
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: "cancel", value: 0, time });
    return this;
  }
}
class FakeNode {
  connect(dest: unknown) {
    return dest;
  }
  disconnect() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}
class FakeSource extends FakeNode {
  started: number[] = [];
  stops: number[] = [];
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  playbackRate = new FakeParam(1);
  type = "sine";
  buffer: unknown = null;
  constructor(private readonly ctx: FakeAudioContext) {
    super();
  }
  start(at = 0) {
    this.started.push(at);
    this.ctx.starts++;
  }
  stop(at = 0) {
    this.stops.push(at);
  }
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}
class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
}
class FakeAudioContext {
  state: "suspended" | "running" | "closed" = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  starts = 0;
  resumes = 0;
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    return new FakeSource(this);
  }
  createBufferSource() {
    return new FakeSource(this);
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
  resume() {
    this.resumes++;
    this.state = "running";
    return Promise.resolve();
  }
}

function setup(opts: { busy?: () => boolean; context?: FakeAudioContext | null } = {}) {
  let t = 0;
  const ctx = opts.context === undefined ? new FakeAudioContext() : opts.context;
  const player = new WebAudioSoundPlayer({
    isVoiceBusy: opts.busy ?? (() => false),
    now: () => t,
    createContext: () => ctx as unknown as AudioContext | null,
  });
  return { player, ctx, at: (ms: number) => (t = ms) };
}

/** The per-cue bus gain the player creates first for each play (its level carries soft/strong). */
function busOfNextPlay(ctx: FakeAudioContext, play: () => void): FakeGain | undefined {
  const before = ctx.gains.length;
  play();
  return ctx.gains[before];
}

/** A bus is still sounding unless it was faded out to 0. */
function isFadedOut(bus: FakeGain): boolean {
  return bus.gain.events.some((e) => (e.type === "linear" || e.type === "target") && e.value === 0);
}

test("locked then unlocked: nothing plays before a gesture unlocked the context, then cues play", () => {
  const { player, ctx } = setup();
  player.play("answer.correct");
  expect(ctx!.starts).toBe(0);
  player.unlock();
  player.play("answer.correct");
  expect(ctx!.starts).toBeGreaterThanOrEqual(1);
});

test("a suspended context is resumed by unlock and plays nothing until it runs", () => {
  const ctx = new FakeAudioContext();
  ctx.state = "suspended";
  ctx.resume = () => {
    ctx.resumes++;
    return new Promise<void>(() => undefined); // iOS: resolves later
  };
  const { player } = setup({ context: ctx });
  player.unlock();
  expect(ctx.resumes).toBe(1);
  player.play("answer.correct");
  expect(ctx.starts).toBe(0);
  ctx.state = "running";
  player.play("answer.correct");
  expect(ctx.starts).toBeGreaterThan(0);
});

test("no Web Audio: unlock and play never throw and start nothing", () => {
  const { player } = setup({ context: null });
  expect(() => {
    player.unlock();
    player.play("answer.correct");
    player.stopAll();
    player.setEnabled(false);
  }).not.toThrow();
});

test("a context that throws while being created leaves the player silent", () => {
  const player = new WebAudioSoundPlayer({
    isVoiceBusy: () => false,
    createContext: () => {
      throw new Error("blocked");
    },
  });
  expect(() => {
    player.unlock();
    player.play("lesson.won");
  }).not.toThrow();
});

test("disabled: nothing starts, and enabling again plays", () => {
  const { player, ctx, at } = setup();
  player.unlock();
  player.setEnabled(false);
  player.play("answer.correct");
  expect(ctx!.starts).toBe(0);
  player.setEnabled(true);
  at(100);
  player.play("answer.correct");
  expect(ctx!.starts).toBeGreaterThan(0);
});

test("disabling fades out what is sounding", () => {
  const { player, ctx } = setup();
  player.unlock();
  const bus = busOfNextPlay(ctx!, () => player.play("lesson.won"));
  player.setEnabled(false);
  expect(isFadedOut(bus!)).toBe(true);
});

test("dedupe: the same cue is not replayed within 50 ms", () => {
  const { player, ctx, at } = setup();
  player.unlock();
  at(0);
  const first = busOfNextPlay(ctx!, () => player.play("gacha.flip.common"));
  at(30);
  const second = busOfNextPlay(ctx!, () => player.play("gacha.flip.common"));
  expect(first).toBeDefined();
  expect(second).toBeUndefined();
  at(60);
  const third = busOfNextPlay(ctx!, () => player.play("gacha.flip.common"));
  expect(third).toBeDefined();
});

test("voice cap: at most 6 cues sound at once, the oldest are faded out", () => {
  const { player, ctx } = setup();
  player.unlock();
  const cues: SoundCue[] = ["answer.correct", "answer.wrong", "lesson.won", "lesson.lost", "heart.lost", "gacha.flip.rare", "gacha.flip.epic", "arena.coins"];
  const buses = cues.map((cue) => busOfNextPlay(ctx!, () => player.play(cue))!);
  expect(buses.filter((b) => !isFadedOut(b))).toHaveLength(6);
  expect(isFadedOut(buses[0]!)).toBe(true);
  expect(isFadedOut(buses[1]!)).toBe(true);
  expect(isFadedOut(buses[7]!)).toBe(false);
});

test("voice busy: a cue plays at most a quarter as loud and never stops the voice", () => {
  let busy = false;
  const { player, ctx, at } = setup({ busy: () => busy });
  player.unlock();
  const normal = busOfNextPlay(ctx!, () => player.play("answer.correct"))!;
  busy = true;
  at(100);
  const soft = busOfNextPlay(ctx!, () => player.play("answer.correct"))!;
  expect(soft.gain.value).toBeGreaterThan(0);
  expect(soft.gain.value).toBeLessThanOrEqual(0.25 * normal.gain.value);
});

test("strong: a critical hit peaks louder than a normal one", () => {
  const { player, ctx, at } = setup();
  player.unlock();
  const normal = busOfNextPlay(ctx!, () => player.play("blow.blade"))!;
  at(100);
  const strong = busOfNextPlay(ctx!, () => player.play("blow.blade", { strong: true }))!;
  expect(strong.gain.value).toBeGreaterThan(normal.gain.value);
});

test("stopAll fades out every sounding cue", () => {
  const { player, ctx } = setup();
  player.unlock();
  const a = busOfNextPlay(ctx!, () => player.play("lesson.won"))!;
  const b = busOfNextPlay(ctx!, () => player.play("gacha.omen.legendary"))!;
  player.stopAll();
  expect(isFadedOut(a)).toBe(true);
  expect(isFadedOut(b)).toBe(true);
  const fadeEnds = [a, b].map((bus) => Math.max(...bus.gain.events.filter((e) => e.type === "linear").map((e) => e.time)));
  fadeEnds.forEach((end) => expect(end).toBeLessThanOrEqual(0.08));
});

test("every cue has a recipe that starts sound and ends in bounded time", () => {
  for (const cue of SOUND_CUES) {
    expect(recipes[cue]).toBeTypeOf("function");
    const ctx = new FakeAudioContext();
    const out = ctx.createGain();
    const voice = recipes[cue](ctx as unknown as AudioContext, out as unknown as AudioNode, 0, false);
    expect(ctx.starts, cue).toBeGreaterThan(0);
    expect(voice.end, cue).toBeGreaterThan(0);
    expect(voice.end, cue).toBeLessThanOrEqual(4.5);
  }
});

test("lesson cues stay within their length budget", () => {
  const budget: Partial<Record<SoundCue, number>> = { "answer.correct": 0.25, "answer.wrong": 0.2, "heart.lost": 0.3, "lesson.won": 1.6, "lesson.lost": 1.5 };
  for (const [cue, max] of Object.entries(budget) as [SoundCue, number][]) {
    const ctx = new FakeAudioContext();
    const voice = recipes[cue](ctx as unknown as AudioContext, ctx.createGain() as unknown as AudioNode, 0, false);
    expect(voice.end, cue).toBeLessThanOrEqual(max);
  }
});
