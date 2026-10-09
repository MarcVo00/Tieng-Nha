# Phase 1 — Pure services (T04–T10)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read **Global Constraints** first.
> All files in `src/services/` are **pure TypeScript**: no React, no DOM, no `Date.now()`, no `Math.random()` (time and randomness are parameters). Strict TDD: write the test, run it, see it fail, implement, see it pass.
> Order: T04 first; then T05, T06, T08, T09 in parallel; then T07 (needs T05, T06); then T10.

---

### Task T04: Time and seeded randomness

**Spec:** §4.3 · **Files:**
- Create: `src/services/time.ts`, `src/services/time.test.ts`, `src/services/random.ts`, `src/services/random.test.ts`

**Interfaces — Produces:**
```ts
// @/services/time
export const PARIS_TZ = "Europe/Paris";
export function parisDay(iso: string): string;            // "YYYY-MM-DD" civil date in Paris
export function addDays(day: string, n: number): string;   // day arithmetic on "YYYY-MM-DD"
export function daysBetween(a: string, b: string): number; // b - a in whole days
export function startOfParisWeek(iso: string): string;     // Monday "YYYY-MM-DD" of the Paris week containing iso
export function addDaysIso(iso: string, n: number): string; // iso + n*24h, ISO string
// @/services/random
export function createRng(seed: number): () => number;     // mulberry32, values in [0,1)
export function shuffle<T>(items: readonly T[], rng: () => number): T[]; // Fisher–Yates, returns a new array
export function pickN<T>(items: readonly T[], n: number, rng: () => number): T[]; // first n of shuffle
export function seedFromString(s: string): number;         // stable 32-bit hash (FNV-1a)
```

- [ ] **Step 1: Failing tests** — `src/services/time.test.ts`

```ts
import { parisDay, addDays, daysBetween, startOfParisWeek, addDaysIso } from "@/services/time";

test("parisDay handles summer time (UTC+2)", () => {
  expect(parisDay("2026-10-09T22:30:00.000Z")).toBe("2026-10-10");
  expect(parisDay("2026-10-09T21:59:00.000Z")).toBe("2026-10-09");
});
test("parisDay handles winter time (UTC+1) and DST switch on 2026-10-25", () => {
  expect(parisDay("2026-10-24T22:30:00.000Z")).toBe("2026-10-25"); // still CEST
  expect(parisDay("2026-10-25T23:30:00.000Z")).toBe("2026-10-26"); // CET
  expect(parisDay("2026-12-31T23:30:00.000Z")).toBe("2027-01-01");
});
test("addDays / daysBetween across month and DST", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
  expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
});
test("startOfParisWeek returns Monday", () => {
  expect(startOfParisWeek("2026-10-09T10:00:00.000Z")).toBe("2026-10-05"); // Friday
  expect(startOfParisWeek("2026-10-11T21:30:00.000Z")).toBe("2026-10-05"); // Sunday 23:30 Paris
  expect(startOfParisWeek("2026-10-11T22:30:00.000Z")).toBe("2026-10-12"); // Monday 00:30 Paris
});
test("addDaysIso adds 24h multiples", () => {
  expect(addDaysIso("2026-10-10T08:00:00.000Z", 2)).toBe("2026-10-12T08:00:00.000Z");
});
```
`src/services/random.test.ts`:
```ts
import { createRng, shuffle, pickN, seedFromString } from "@/services/random";

test("rng is deterministic per seed", () => {
  const a = createRng(42), b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test("rng values are in [0,1)", () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
test("shuffle is a permutation and does not mutate input", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, createRng(7));
  expect([...out].sort()).toEqual(input);
  expect(input).toEqual([1, 2, 3, 4, 5, 6]);
});
test("pickN returns n distinct items", () => {
  expect(new Set(pickN([1, 2, 3, 4, 5], 3, createRng(3))).size).toBe(3);
});
test("seedFromString is stable", () => {
  expect(seedFromString("l05_e01")).toBe(seedFromString("l05_e01"));
  expect(seedFromString("a")).not.toBe(seedFromString("b"));
});
```
Run: `npx vitest run src/services/time.test.ts src/services/random.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/services/time.ts`:
```ts
export const PARIS_TZ = "Europe/Paris";
const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: PARIS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function parisDay(iso: string): string {
  return fmt.format(new Date(iso)); // en-CA formats as YYYY-MM-DD
}
// Noon UTC avoids any DST edge when doing pure calendar arithmetic.
const noon = (day: string) => Date.parse(`${day}T12:00:00.000Z`);

export function addDays(day: string, n: number): string {
  return new Date(noon(day) + n * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((noon(b) - noon(a)) / DAY_MS);
}
export function startOfParisWeek(iso: string): string {
  const day = parisDay(iso);
  const dow = new Date(noon(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}
export function addDaysIso(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY_MS).toISOString();
}
```
`src/services/random.ts`:
```ts
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export function pickN<T>(items: readonly T[], n: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, n);
}
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```
Run tests → PASS.

- [ ] **Step 3: Commit** — `git add src/services && git commit -m "feat(services): add Paris calendar helpers and seeded rng"`

**Acceptance:** tests pass under any machine timezone (run once with `TZ=America/New_York npx vitest run src/services/time.test.ts` to prove it).

---

### Task T05: XP rules, streak, progress projection

**Spec:** §4.2, §4.3 · **ADR:** 0004 · **Files:**
- Create: `src/services/xp.ts`, `xp.test.ts`, `streak.ts`, `streak.test.ts`, `progress.ts`, `progress.test.ts`

**Interfaces:**
- Consumes: `parisDay`, `startOfParisWeek`, `addDays`, `daysBetween` (T04); `AppEvent`, `ProgressSnapshot` (T02).
- Produces:
```ts
// @/services/xp
export const XP = { lessonFirst: 10, lessonPerfectBonus: 5, lessonReplay: 3, reviewPerWord: 2, reviewMaxPerSession: 40, dialogueFirst: 15, dialogueReplay: 3, dailyCap: 200 } as const;
export function lessonXp(i: { firstTime: boolean; perfect: boolean }): number;
export function dialogueXp(i: { firstTime: boolean }): number;
export function reviewXp(correctCount: number): number;
export function examXpDelta(score: number, previousBest: number | null): number;
// @/services/streak
export function computeStreak(activeDays: readonly string[], today: string): number;
// @/services/progress
export const STREAK_EVENT_TYPES: readonly AppEventType[]; // lesson_completed, dialogue_completed, review_session_completed
export function computeProgress(events: readonly AppEvent[], nowIso: string): ProgressSnapshot;
```

- [ ] **Step 1: Failing tests**

`src/services/xp.test.ts`:
```ts
import { lessonXp, dialogueXp, reviewXp, examXpDelta } from "@/services/xp";
test("lesson xp", () => {
  expect(lessonXp({ firstTime: true, perfect: false })).toBe(10);
  expect(lessonXp({ firstTime: true, perfect: true })).toBe(15);
  expect(lessonXp({ firstTime: false, perfect: true })).toBe(3);
});
test("dialogue xp", () => {
  expect(dialogueXp({ firstTime: true })).toBe(15);
  expect(dialogueXp({ firstTime: false })).toBe(3);
});
test("review xp is 2 per word capped at 40", () => {
  expect(reviewXp(0)).toBe(0);
  expect(reviewXp(7)).toBe(14);
  expect(reviewXp(30)).toBe(40);
});
test("exam xp is the improvement over the best score", () => {
  expect(examXpDelta(72, null)).toBe(72);
  expect(examXpDelta(80, 72)).toBe(8);
  expect(examXpDelta(60, 72)).toBe(0);
});
```
`src/services/streak.test.ts`:
```ts
import { computeStreak } from "@/services/streak";
test("no activity → 0", () => expect(computeStreak([], "2026-10-10")).toBe(0));
test("active today only → 1", () => expect(computeStreak(["2026-10-10"], "2026-10-10")).toBe(1));
test("active until yesterday keeps the streak", () =>
  expect(computeStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2));
test("gap of a full day breaks it", () => expect(computeStreak(["2026-10-07", "2026-10-08"], "2026-10-10")).toBe(0));
test("counts consecutive days ending today, ignoring older runs", () =>
  expect(computeStreak(["2026-10-01", "2026-10-02", "2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3));
test("duplicates and unsorted input are tolerated", () =>
  expect(computeStreak(["2026-10-10", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(2));
```
`src/services/progress.test.ts`:
```ts
import { computeProgress } from "@/services/progress";
import type { AppEvent } from "@/domain/types";

let n = 0;
const ev = (p: Partial<AppEvent> & Pick<AppEvent, "type" | "refId" | "xp" | "createdAt">): AppEvent => ({
  clientId: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, schemaVersion: 1, payload: {}, ...p,
});
const NOW = "2026-10-10T10:00:00.000Z"; // Saturday, week starts 2026-10-05

test("empty log", () => {
  const s = computeProgress([], NOW);
  expect(s).toMatchObject({ xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone: [], badges: [], examBest: null });
});

test("aggregates lessons, dialogues, reviews, exam and badges", () => {
  const s = computeProgress([
    ev({ type: "lesson_completed", refId: "l01", xp: 15, createdAt: "2026-10-09T09:00:00.000Z", payload: { mistakes: 0, durationMs: 1, perfect: true } }),
    ev({ type: "lesson_completed", refId: "l01", xp: 3, createdAt: "2026-10-10T08:00:00.000Z", payload: { mistakes: 2, durationMs: 1, perfect: false } }),
    ev({ type: "dialogue_completed", refId: "d01", xp: 15, createdAt: "2026-10-10T08:10:00.000Z" }),
    ev({ type: "review_session_completed", refId: "review", xp: 8, createdAt: "2026-10-10T08:20:00.000Z", payload: { correctCount: 4, total: 5 } }),
    ev({ type: "exam_finished", refId: "exam", xp: 72, createdAt: "2026-10-10T08:30:00.000Z", payload: { score: 72, attemptId: "a", noSpeaking: false } }),
    ev({ type: "badge_unlocked", refId: "first_lesson", xp: 0, createdAt: "2026-10-09T09:00:01.000Z" }),
  ], NOW);
  expect(s.xpTotal).toBe(113);
  expect(s.xpToday).toBe(98);
  expect(s.xpWeek).toBe(113);
  expect(s.lessonsDone).toEqual(["l01"]);
  expect(s.perfectLessons).toEqual(["l01"]);
  expect(s.dialoguesDone).toEqual(["d01"]);
  expect(s.vocabReviewed).toBe(4);
  expect(s.examBest).toBe(72);
  expect(s.badges).toEqual(["first_lesson"]);
  expect(s.activeDays).toEqual(["2026-10-09", "2026-10-10"]);
  expect(s.streak).toBe(2);
});

test("xp from previous weeks is not in xpWeek", () => {
  const s = computeProgress([ev({ type: "lesson_completed", refId: "l01", xp: 10, createdAt: "2026-10-04T10:00:00.000Z" })], NOW);
  expect(s.xpTotal).toBe(10);
  expect(s.xpWeek).toBe(0);
});

test("daily cap of 200 xp per Paris day", () => {
  const events = Array.from({ length: 25 }, (_, i) =>
    ev({ type: "lesson_completed", refId: `l${String(i).padStart(2, "0")}`, xp: 10, createdAt: `2026-10-10T0${i % 10}:00:00.000Z` }));
  expect(computeProgress(events, NOW).xpToday).toBe(200);
});

test("badge_unlocked does not count as an active day", () => {
  const s = computeProgress([ev({ type: "badge_unlocked", refId: "x", xp: 0, createdAt: NOW })], NOW);
  expect(s.activeDays).toEqual([]);
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`src/services/xp.ts`:
```ts
export const XP = {
  lessonFirst: 10, lessonPerfectBonus: 5, lessonReplay: 3,
  reviewPerWord: 2, reviewMaxPerSession: 40,
  dialogueFirst: 15, dialogueReplay: 3,
  dailyCap: 200,
} as const;

export function lessonXp({ firstTime, perfect }: { firstTime: boolean; perfect: boolean }): number {
  if (!firstTime) return XP.lessonReplay;
  return XP.lessonFirst + (perfect ? XP.lessonPerfectBonus : 0);
}
export function dialogueXp({ firstTime }: { firstTime: boolean }): number {
  return firstTime ? XP.dialogueFirst : XP.dialogueReplay;
}
export function reviewXp(correctCount: number): number {
  return Math.min(Math.max(0, correctCount) * XP.reviewPerWord, XP.reviewMaxPerSession);
}
export function examXpDelta(score: number, previousBest: number | null): number {
  return Math.max(0, score - (previousBest ?? 0));
}
```
`src/services/streak.ts`:
```ts
import { addDays } from "@/services/time";

export function computeStreak(activeDays: readonly string[], today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
```
`src/services/progress.ts`:
```ts
import type { AppEvent, AppEventType, ProgressSnapshot } from "@/domain/types";
import { parisDay, startOfParisWeek } from "@/services/time";
import { computeStreak } from "@/services/streak";
import { XP } from "@/services/xp";

export const STREAK_EVENT_TYPES: readonly AppEventType[] = ["lesson_completed", "dialogue_completed", "review_session_completed"];

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function computeProgress(events: readonly AppEvent[], nowIso: string): ProgressSnapshot {
  const today = parisDay(nowIso);
  const week = startOfParisWeek(nowIso);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const xpByDay = new Map<string, number>();
  const lessons = new Set<string>(), perfect = new Set<string>(), dialogues = new Set<string>(), badges = new Set<string>(), active = new Set<string>();
  let xpTotal = 0, xpWeek = 0, xpToday = 0, vocabReviewed = 0;
  let examBest: number | null = null;

  for (const e of sorted) {
    const day = parisDay(e.createdAt);
    const used = xpByDay.get(day) ?? 0;
    const credited = Math.max(0, Math.min(e.xp, XP.dailyCap - used));
    xpByDay.set(day, used + credited);
    xpTotal += credited;
    if (startOfParisWeek(e.createdAt) === week) xpWeek += credited;
    if (day === today) xpToday += credited;
    if (STREAK_EVENT_TYPES.includes(e.type)) active.add(day);

    switch (e.type) {
      case "lesson_completed":
        lessons.add(e.refId);
        if (e.payload["perfect"] === true) perfect.add(e.refId);
        break;
      case "dialogue_completed":
        dialogues.add(e.refId);
        break;
      case "review_session_completed":
        vocabReviewed += num(e.payload["correctCount"]);
        break;
      case "exam_finished":
        examBest = Math.max(examBest ?? 0, num(e.payload["score"]));
        break;
      case "badge_unlocked":
        badges.add(e.refId);
        break;
    }
  }
  const activeDays = [...active].sort();
  return {
    xpTotal, xpWeek, xpToday,
    streak: computeStreak(activeDays, today),
    lessonsDone: [...lessons], perfectLessons: [...perfect], dialoguesDone: [...dialogues],
    vocabReviewed, examBest, badges: [...badges], activeDays,
  };
}
```
Run tests → PASS. Run `npx vitest run --coverage src/services` → `xp.ts`, `streak.ts`, `progress.ts` ≥ 90 % lines.

- [ ] **Step 3: Commit** — `git commit -am "feat(services): add XP rules, streak and progress projection"` (add new files first).

**Acceptance:** tests pass; no import outside `@/services`, `@/domain`.

---

### Task T06: Leitner scheduling and review session builder

**Spec:** §4.4, §6.6 · **Files:**
- Create: `src/services/leitner.ts`, `leitner.test.ts`, `reviewBuilder.ts`, `reviewBuilder.test.ts`

**Interfaces:**
- Consumes: `addDaysIso`, `createRng`, `shuffle`, `pickN` (T04); `VocabProgress`, `VocabItem`, `Exercise` (T02).
- Produces:
```ts
// @/services/leitner
export const INTERVAL_DAYS: Record<LeitnerBox, number>; // {1:1, 2:2, 3:4, 4:8, 5:16}
export function introduce(vocabId: VocabId, nowIso: string): VocabProgress; // box 1, due now+1d
export function record(p: VocabProgress, correct: boolean, nowIso: string): VocabProgress;
export function isDue(p: VocabProgress, nowIso: string): boolean;
// @/services/reviewBuilder
export const REVIEW_MAX = 20;
export function buildReviewSession(
  due: readonly VocabProgress[], pool: readonly VocabItem[], rng: () => number, opts: { hasStt: boolean; max?: number },
): Exercise[];
```

- [ ] **Step 1: Failing tests**

`src/services/leitner.test.ts`:
```ts
import { introduce, record, isDue } from "@/services/leitner";
const NOW = "2026-10-10T08:00:00.000Z";

test("introduce puts a word in box 1 due tomorrow", () => {
  expect(introduce("v_ly", NOW)).toEqual({ vocabId: "v_ly", box: 1, dueAt: "2026-10-11T08:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: NOW });
});
test("correct answer promotes and schedules by box interval", () => {
  let p = introduce("v_ly", NOW);
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 2, dueAt: "2026-10-12T08:00:00.000Z", correct: 1 });
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 3, dueAt: "2026-10-14T08:00:00.000Z" });
});
test("box 5 is the ceiling (16 days)", () => {
  let p = { ...introduce("v_ly", NOW), box: 5 as const };
  p = record(p, true, NOW);
  expect(p).toMatchObject({ box: 5, dueAt: "2026-10-26T08:00:00.000Z" });
});
test("wrong answer resets to box 1", () => {
  const p = record({ ...introduce("v_ly", NOW), box: 4 }, false, NOW);
  expect(p).toMatchObject({ box: 1, wrong: 1, dueAt: "2026-10-11T08:00:00.000Z" });
});
test("isDue compares with now", () => {
  const p = introduce("v_ly", NOW);
  expect(isDue(p, NOW)).toBe(false);
  expect(isDue(p, "2026-10-11T08:00:00.000Z")).toBe(true);
});
```
`src/services/reviewBuilder.test.ts`:
```ts
import { buildReviewSession } from "@/services/reviewBuilder";
import { introduce } from "@/services/leitner";
import { createRng } from "@/services/random";
import { lessonFixture } from "@/test/fixtures/lessonFixture";

const NOW = "2026-10-10T08:00:00.000Z";
const pool = lessonFixture.vocab;
const due = pool.slice(0, 5).map((v) => introduce(v.id, NOW));

test("one exercise per due word, max 20", () => {
  const many = pool.map((v) => introduce(v.id, NOW));
  expect(buildReviewSession(due, pool, createRng(1), { hasStt: true })).toHaveLength(5);
  expect(buildReviewSession(many, pool, createRng(1), { hasStt: true, max: 3 })).toHaveLength(3);
});
test("listen_choose includes the answer among 4 distinct choices", () => {
  const ex = buildReviewSession(due, pool, createRng(2), { hasStt: false });
  for (const e of ex) {
    if (e.type === "listen_choose") {
      expect(e.choices).toContain(e.vocabId);
      expect(new Set(e.choices).size).toBe(4);
    }
  }
});
test("no speak exercise without speech recognition", () => {
  const ex = buildReviewSession(due, pool, createRng(3), { hasStt: false });
  expect(ex.every((e) => e.type !== "speak")).toBe(true);
});
test("translate_choose uses the word's French as prompt and 3 other words as distractors", () => {
  const ex = buildReviewSession(due, pool, createRng(4), { hasStt: false }).filter((e) => e.type === "translate_choose");
  for (const e of ex) {
    if (e.type !== "translate_choose") continue;
    const word = pool.find((v) => v.vi === e.answerVi)!;
    expect(e.promptFr).toBe(word.fr);
    expect(e.distractorsVi).not.toContain(e.answerVi);
    expect(e.distractorsVi).toHaveLength(3);
  }
});
test("deterministic for the same seed", () => {
  expect(buildReviewSession(due, pool, createRng(9), { hasStt: true })).toEqual(buildReviewSession(due, pool, createRng(9), { hasStt: true }));
});
test("distractors never equal the answer text (synonyms)", () => {
  const withSynonym = [...pool, { id: "v_ly_bis", vi: "ly", fr: "verre (bis)", dialect: "south" as const }];
  for (let seed = 0; seed < 20; seed++) {
    for (const e of buildReviewSession(due, withSynonym, createRng(seed), { hasStt: false })) {
      if (e.type === "translate_choose") expect(e.distractorsVi).not.toContain(e.answerVi);
    }
  }
});
test("words missing from the pool are skipped", () => {
  expect(buildReviewSession([introduce("v_unknown", NOW)], pool, createRng(1), { hasStt: true })).toEqual([]);
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`src/services/leitner.ts`:
```ts
import type { LeitnerBox, VocabId, VocabProgress } from "@/domain/types";
import { addDaysIso } from "@/services/time";

export const INTERVAL_DAYS: Record<LeitnerBox, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export function introduce(vocabId: VocabId, nowIso: string): VocabProgress {
  return { vocabId, box: 1, dueAt: addDaysIso(nowIso, INTERVAL_DAYS[1]), correct: 0, wrong: 0, lastSeenAt: nowIso };
}
export function record(p: VocabProgress, correct: boolean, nowIso: string): VocabProgress {
  const box: LeitnerBox = correct ? (Math.min(p.box + 1, 5) as LeitnerBox) : 1;
  return {
    ...p, box,
    dueAt: addDaysIso(nowIso, INTERVAL_DAYS[box]),
    correct: p.correct + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    lastSeenAt: nowIso,
  };
}
export function isDue(p: VocabProgress, nowIso: string): boolean {
  return p.dueAt <= nowIso;
}
```
`src/services/reviewBuilder.ts`:
```ts
import type { Exercise, VocabItem, VocabProgress } from "@/domain/types";
import { pickN, shuffle } from "@/services/random";

export const REVIEW_MAX = 20;
type Kind = "listen_choose" | "translate_choose" | "speak";

export function buildReviewSession(
  due: readonly VocabProgress[], pool: readonly VocabItem[], rng: () => number, opts: { hasStt: boolean; max?: number },
): Exercise[] {
  const live = pool.filter((v) => !v.deprecated);
  const byId = new Map(live.map((v) => [v.id, v]));
  const kinds: Kind[] = opts.hasStt ? ["listen_choose", "translate_choose", "speak"] : ["listen_choose", "translate_choose"];
  const out: Exercise[] = [];
  for (const [i, p] of [...due].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, opts.max ?? REVIEW_MAX).entries()) {
    const word = byId.get(p.vocabId);
    if (!word) continue;
    const others = live.filter((v) => v.id !== word.id && v.vi !== word.vi);
    if (others.length < 3) continue;
    const kind = kinds[Math.floor(rng() * kinds.length)]!;
    const id = `rev_${word.id}_${i}`;
    if (kind === "listen_choose") {
      out.push({ id, type: "listen_choose", vocabId: word.id, choices: shuffle([word.id, ...pickN(others, 3, rng).map((v) => v.id)], rng) });
    } else if (kind === "translate_choose") {
      out.push({ id, type: "translate_choose", promptFr: word.fr, answerVi: word.vi, distractorsVi: pickN(others, 3, rng).map((v) => v.vi) });
    } else {
      out.push({ id, type: "speak", vi: word.vi, fr: word.fr, vocabIds: [word.id] });
    }
  }
  return out;
}
```
Run → PASS.

- [ ] **Step 3: Commit** — `feat(services): add Leitner scheduling and review session builder`

---

### Task T07: Badges and ActivityService

**Spec:** §4.1, §4.2, §4.5, §4.6 · **ADR:** 0004 · **Files:**
- Create: `src/services/badges.ts`, `badges.test.ts`, `src/services/activity.test.ts`
- Replace: `src/services/activity.ts` (stub from T03)
- Modify: `src/adapters/fakes/createFakeServices.ts` (wire the real activity service)

**Interfaces:**
- Consumes: T05 (`computeProgress`, `lessonXp`, `dialogueXp`, `reviewXp`, `examXpDelta`), T06 (`introduce`, `record`), ports `ProgressRepository`, `Outbox`, `ContentSource`.
- Produces:
```ts
// @/services/badges
export function evaluateBadges(snapshot: ProgressSnapshot, defs: readonly BadgeDef[]): string[]; // ids of badges whose rule holds and are NOT in snapshot.badges
// @/services/activity
export type ActivityResult = { xpGained: number; newBadges: BadgeDef[]; snapshot: ProgressSnapshot; firstTime: boolean };
export type ActivityService = {
  getSnapshot(): Promise<ProgressSnapshot>;
  introduceVocab(vocabIds: readonly VocabId[]): Promise<void>;          // only words not yet known
  recordAnswer(vocabIds: readonly VocabId[], correct: boolean): Promise<void>; // only words already known
  completeLesson(i: { lessonId: LessonId; mistakes: number; durationMs: number; vocabIds: readonly VocabId[] }): Promise<ActivityResult>;
  completeDialogue(i: { dialogueId: DialogueId; durationMs: number }): Promise<ActivityResult>;
  completeReview(i: { correctCount: number; total: number }): Promise<ActivityResult>;
  finishExam(i: { attemptId: string; score: number; noSpeaking: boolean }): Promise<ActivityResult>;
};
export function createActivityService(deps: {
  progress: ProgressRepository; outbox: Outbox; content: ContentSource; clock: () => string; onEventAppended?: () => void;
}): ActivityService;
```

- [ ] **Step 1: Failing tests** — `src/services/badges.test.ts`

```ts
import { evaluateBadges } from "@/services/badges";
import { BadgesFileSchema } from "@/content/schema";
import badgesFile from "@/content/badges.json";
import type { ProgressSnapshot } from "@/domain/types";

const defs = BadgesFileSchema.parse(badgesFile).badges;
const empty: ProgressSnapshot = { xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone: [], perfectLessons: [], dialoguesDone: [], vocabReviewed: 0, examBest: null, badges: [], activeDays: [] };

test("nothing for an empty snapshot", () => expect(evaluateBadges(empty, defs)).toEqual([]));
test("first lesson + perfect", () =>
  expect(evaluateBadges({ ...empty, lessonsDone: ["l01"], perfectLessons: ["l01"] }, defs).sort()).toEqual(["first_lesson", "perfect_lesson"]));
test("already unlocked badges are not returned again", () =>
  expect(evaluateBadges({ ...empty, lessonsDone: ["l01"], badges: ["first_lesson"] }, defs)).toEqual([]));
test("streak, vocab, dialogues, exam thresholds", () => {
  const ids = evaluateBadges({ ...empty, streak: 7, vocabReviewed: 100, dialoguesDone: ["d01"], examBest: 91 }, defs);
  expect(ids).toEqual(expect.arrayContaining(["streak_3", "streak_7", "vocab_100", "first_dialogue", "exam_passed", "exam_excellent"]));
  expect(ids).not.toContain("streak_30");
});
```
`src/services/activity.test.ts`:
```ts
import { createActivityService } from "@/services/activity";
import { InMemoryProgressRepository, InMemoryOutbox } from "@/adapters/fakes";
import { createFakeServices } from "@/adapters/fakes";

function setup(now = "2026-10-10T08:00:00.000Z") {
  const progress = new InMemoryProgressRepository();
  const outbox = new InMemoryOutbox();
  const { content } = createFakeServices();
  let t = now;
  const appended: number[] = [];
  const svc = createActivityService({ progress, outbox, content, clock: () => t, onEventAppended: () => appended.push(1) });
  return { svc, progress, outbox, appended, setNow: (v: string) => (t = v) };
}

test("first lesson: xp, event, outbox, vocab introduced, badges", async () => {
  const { svc, progress, outbox, appended } = setup();
  const r = await svc.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 60000, vocabIds: ["v_ly", "v_da"] });
  expect(r.firstTime).toBe(true);
  expect(r.xpGained).toBe(15);
  expect(r.newBadges.map((b) => b.id).sort()).toEqual(["first_lesson", "perfect_lesson"]);
  const events = await progress.listEvents();
  expect(events.map((e) => e.type)).toEqual(["lesson_completed", "badge_unlocked", "badge_unlocked"]);
  expect(await outbox.size()).toBe(3);
  expect(await progress.getVocabProgress("v_ly")).toMatchObject({ box: 1 });
  expect(appended.length).toBeGreaterThan(0);
});

test("replayed lesson gives replay xp and no duplicate badges", async () => {
  const { svc } = setup();
  await svc.completeLesson({ lessonId: "l05", mistakes: 1, durationMs: 1, vocabIds: [] });
  const r = await svc.completeLesson({ lessonId: "l05", mistakes: 0, durationMs: 1, vocabIds: [] });
  expect(r.firstTime).toBe(false);
  expect(r.xpGained).toBe(3);
  // A perfect replay unlocks perfect_lesson (first run had a mistake) but earns no +5 bonus (first-time only).
  expect(r.newBadges.map((b) => b.id)).toEqual(["perfect_lesson"]);
});

test("recordAnswer only updates known words", async () => {
  const { svc, progress } = setup();
  await svc.recordAnswer(["v_ly"], true);
  expect(await progress.getVocabProgress("v_ly")).toBeUndefined();
  await svc.introduceVocab(["v_ly"]);
  await svc.recordAnswer(["v_ly"], true);
  expect(await progress.getVocabProgress("v_ly")).toMatchObject({ box: 2, correct: 1 });
});

test("exam xp is the delta over the best score", async () => {
  const { svc } = setup();
  expect((await svc.finishExam({ attemptId: "a", score: 72, noSpeaking: false })).xpGained).toBe(72);
  expect((await svc.finishExam({ attemptId: "b", score: 80, noSpeaking: false })).xpGained).toBe(8);
  expect((await svc.finishExam({ attemptId: "c", score: 50, noSpeaking: false })).xpGained).toBe(0);
});

test("review xp", async () => {
  const { svc } = setup();
  expect((await svc.completeReview({ correctCount: 5, total: 6 })).xpGained).toBe(10);
});
```
Run → FAIL.

- [ ] **Step 2: Implement `src/services/badges.ts`**

```ts
import type { BadgeDef, ProgressSnapshot } from "@/domain/types";

function holds(rule: BadgeDef["rule"], s: ProgressSnapshot): boolean {
  switch (rule.kind) {
    case "lessons_done": return s.lessonsDone.length >= rule.gte;
    case "streak": return s.streak >= rule.gte;
    case "perfect_lesson": return s.perfectLessons.length > 0;
    case "vocab_reviewed": return s.vocabReviewed >= rule.gte;
    case "dialogues_done": return s.dialoguesDone.length >= rule.gte;
    case "exam_score": return (s.examBest ?? 0) >= rule.gte;
  }
}
export function evaluateBadges(snapshot: ProgressSnapshot, defs: readonly BadgeDef[]): string[] {
  const owned = new Set(snapshot.badges);
  return defs.filter((d) => !owned.has(d.id) && holds(d.rule, snapshot)).map((d) => d.id);
}
```

- [ ] **Step 3: Implement `src/services/activity.ts`** (replace the stub)

```ts
import type { AppEventType, BadgeDef, DialogueId, LessonId, NewEvent, ProgressSnapshot, VocabId } from "@/domain/types";
import type { ContentSource, Outbox, ProgressRepository } from "@/ports";
import { computeProgress } from "@/services/progress";
import { evaluateBadges } from "@/services/badges";
import { dialogueXp, examXpDelta, lessonXp, reviewXp } from "@/services/xp";
import { introduce, record } from "@/services/leitner";

export type ActivityResult = { xpGained: number; newBadges: BadgeDef[]; snapshot: ProgressSnapshot; firstTime: boolean };
export type ActivityService = {
  getSnapshot(): Promise<ProgressSnapshot>;
  introduceVocab(vocabIds: readonly VocabId[]): Promise<void>;
  recordAnswer(vocabIds: readonly VocabId[], correct: boolean): Promise<void>;
  completeLesson(i: { lessonId: LessonId; mistakes: number; durationMs: number; vocabIds: readonly VocabId[] }): Promise<ActivityResult>;
  completeDialogue(i: { dialogueId: DialogueId; durationMs: number }): Promise<ActivityResult>;
  completeReview(i: { correctCount: number; total: number }): Promise<ActivityResult>;
  finishExam(i: { attemptId: string; score: number; noSpeaking: boolean }): Promise<ActivityResult>;
};

export function createActivityService(deps: {
  progress: ProgressRepository; outbox: Outbox; content: ContentSource; clock: () => string; onEventAppended?: () => void;
}): ActivityService {
  const { progress, outbox, content, clock } = deps;
  const snapshot = async () => computeProgress(await progress.listEvents(), clock());

  async function append(e: NewEvent) {
    const saved = await progress.appendEvent(e, clock());
    await outbox.enqueue(saved);
  }

  async function commit(e: NewEvent, firstTime: boolean): Promise<ActivityResult> {
    const before = await snapshot();
    await append(e);
    const mid = await snapshot();
    const defs = await content.getBadges();
    const newIds = evaluateBadges(mid, defs);
    for (const id of newIds) await append({ type: "badge_unlocked", refId: id, xp: 0, payload: {} });
    deps.onEventAppended?.();
    const after = newIds.length ? await snapshot() : mid;
    return { xpGained: after.xpTotal - before.xpTotal, newBadges: defs.filter((d) => newIds.includes(d.id)), snapshot: after, firstTime };
  }

  const ev = (type: AppEventType, refId: string, xp: number, payload: Record<string, unknown>): NewEvent => ({ type, refId, xp, payload });

  async function introduceVocab(ids: readonly VocabId[]) {
    const now = clock();
    for (const id of ids) if (!(await progress.getVocabProgress(id))) await progress.upsertVocabProgress(introduce(id, now));
  }

  return {
    getSnapshot: snapshot,
    introduceVocab,
    async recordAnswer(ids, correct) {
      const now = clock();
      for (const id of ids) {
        const p = await progress.getVocabProgress(id);
        if (p) await progress.upsertVocabProgress(record(p, correct, now));
      }
    },
    async completeLesson({ lessonId, mistakes, durationMs, vocabIds }) {
      const firstTime = !(await snapshot()).lessonsDone.includes(lessonId);
      await introduceVocab(vocabIds);
      const perfect = mistakes === 0;
      return commit(ev("lesson_completed", lessonId, lessonXp({ firstTime, perfect }), { mistakes, durationMs, perfect }), firstTime);
    },
    async completeDialogue({ dialogueId, durationMs }) {
      const firstTime = !(await snapshot()).dialoguesDone.includes(dialogueId);
      return commit(ev("dialogue_completed", dialogueId, dialogueXp({ firstTime }), { durationMs }), firstTime);
    },
    async completeReview({ correctCount, total }) {
      return commit(ev("review_session_completed", "review", reviewXp(correctCount), { correctCount, total }), false);
    },
    async finishExam({ attemptId, score, noSpeaking }) {
      const best = (await snapshot()).examBest;
      return commit(ev("exam_finished", "exam", examXpDelta(score, best), { score, attemptId, noSpeaking }), best === null);
    },
  };
}
```
- [ ] **Step 4: Wire into fakes** — in `createFakeServices`, build `outbox` and `content` as constants first, then:
```ts
activity: createActivityService({ progress, outbox, content, clock }),
```
(`onEventAppended` is wired to `sync.flush` in T10.)

- [ ] **Step 5: Run** `npx vitest run src/services` → PASS; `npm run verify` → PASS. **Commit:** `feat(services): add badges evaluation and ActivityService`

---

### Task T08: Pronunciation scoring (tone-aware)

**Spec:** §6.5 · **Files:**
- Create: `src/services/pronunciation.ts`, `src/services/pronunciation.test.ts`

**Interfaces — Produces:**
```ts
export type SyllableStatus = "ok" | "tone" | "wrong" | "missing" | "extra";
export type SyllableDiff = { expected: string | null; heard: string | null; status: SyllableStatus };
export type PronunciationResult = { score: number; diff: SyllableDiff[]; heard: string };
export const PASS_THRESHOLD = 0.7;
export function normalizeVi(s: string): string;      // NFC, lowercase, punctuation removed, digits 0–10 → words, single spaces
export function stripTones(s: string): string;       // removes ONLY the 5 tone marks; keeps ă â ê ô ơ ư đ
export function syllables(s: string): string[];      // normalizeVi(s).split(" ") (empty → [])
export function scorePronunciation(expected: string, heardAlternatives: readonly string[]): PronunciationResult; // best alternative
```

- [ ] **Step 1: Failing tests**

```ts
import { normalizeVi, stripTones, scorePronunciation, PASS_THRESHOLD } from "@/services/pronunciation";

test("normalizeVi", () => {
  expect(normalizeVi("  Cho tui một ly Cà Phê, nha!  ")).toBe("cho tui một ly cà phê nha");
  expect(normalizeVi("Cà phê".normalize("NFD"))).toBe("cà phê");
  expect(normalizeVi("1 2 10")).toBe("một hai mười");
});
test("stripTones keeps vowel modifiers and đ", () => {
  expect(stripTones("cà phê sữa đá")).toBe("ca phê sưa đa");
  expect(stripTones("Việt Nam")).toBe("Viêt Nam");
  expect(stripTones("ơi ăn ấm")).toBe("ơi ăn âm");
});
test("perfect match", () => {
  const r = scorePronunciation("Cho tui một ly trà đá.", ["cho tui một ly trà đá"]);
  expect(r.score).toBe(1);
  expect(r.diff.every((d) => d.status === "ok")).toBe(true);
});
test("one wrong tone costs half a syllable", () => {
  const r = scorePronunciation("trà đá", ["trà đà"]);
  expect(r.score).toBe(0.75);
  expect(r.diff[1]).toEqual({ expected: "đá", heard: "đà", status: "tone" });
});
test("missing syllable", () => {
  const r = scorePronunciation("cho tui một ly", ["cho tui ly"]);
  expect(r.score).toBe(0.75);
  expect(r.diff.find((d) => d.status === "missing")?.expected).toBe("một");
});
test("best alternative wins", () => {
  expect(scorePronunciation("xin chào", ["sin chao", "xin chào"]).score).toBe(1);
});
test("garbage scores low and is clamped at 0", () => {
  const r = scorePronunciation("xin chào", ["hello world how are you"]);
  expect(r.score).toBe(0);
  expect(r.score).toBeLessThan(PASS_THRESHOLD);
});
test("no alternatives → score 0", () => expect(scorePronunciation("xin chào", []).score).toBe(0));
```
Run → FAIL.

- [ ] **Step 2: Implement**

```ts
const TONE_MARKS = /[̣̀́̃̉]/g; // grave, acute, tilde, hook above, dot below
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"];
export const PASS_THRESHOLD = 0.7;
export type SyllableStatus = "ok" | "tone" | "wrong" | "missing" | "extra";
export type SyllableDiff = { expected: string | null; heard: string | null; status: SyllableStatus };
export type PronunciationResult = { score: number; diff: SyllableDiff[]; heard: string };

export function normalizeVi(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) && Number(w) <= 10 ? DIGITS[Number(w)]! : w))
    .join(" ");
}
export function stripTones(s: string): string {
  return s.normalize("NFD").replace(TONE_MARKS, "").normalize("NFC");
}
export function syllables(s: string): string[] {
  const n = normalizeVi(s);
  return n ? n.split(" ") : [];
}

function subCost(a: string, b: string): number {
  if (a === b) return 0;
  if (stripTones(a) === stripTones(b)) return 0.5;
  return 1;
}

function align(exp: string[], got: string[]): { cost: number; diff: SyllableDiff[] } {
  const n = exp.length, m = got.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + subCost(exp[i - 1]!, got[j - 1]!));
  const diff: SyllableDiff[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + subCost(exp[i - 1]!, got[j - 1]!)) {
      const c = subCost(exp[i - 1]!, got[j - 1]!);
      diff.push({ expected: exp[i - 1]!, heard: got[j - 1]!, status: c === 0 ? "ok" : c === 0.5 ? "tone" : "wrong" });
      i--; j--;
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      diff.push({ expected: exp[i - 1]!, heard: null, status: "missing" });
      i--;
    } else {
      diff.push({ expected: null, heard: got[j - 1]!, status: "extra" });
      j--;
    }
  }
  return { cost: d[n]![m]!, diff: diff.reverse() };
}

export function scorePronunciation(expected: string, heardAlternatives: readonly string[]): PronunciationResult {
  const exp = syllables(expected);
  let best: PronunciationResult = { score: 0, diff: exp.map((e) => ({ expected: e, heard: null, status: "missing" })), heard: "" };
  for (const alt of heardAlternatives) {
    const got = syllables(alt);
    const { cost, diff } = align(exp, got);
    const score = exp.length === 0 ? 0 : Math.max(0, Math.min(1, 1 - cost / exp.length));
    if (score > best.score) best = { score: Math.round(score * 100) / 100, diff, heard: alt };
  }
  return best;
}
```
Run → PASS. Check coverage ≥ 90 %.

- [ ] **Step 3: Commit** — `feat(services): add tone-aware pronunciation scoring`

---

### Task T09: Exam draw and scoring

**Spec:** §6.8 · **Files:** Create `src/services/exam.ts`, `src/services/exam.test.ts`

**Interfaces — Produces:**
```ts
export const EXAM_LAYOUT = { listening: 10, translation: 8, tones: 6, speaking: 6 } as const; // total 30
export const EXAM_PASS = 70;
export type ExamMention = "excellent" | "tres_bien" | "bien" | "presque";
export function drawExam(pool: readonly ExamQuestion[], seed: number, hasStt: boolean): ExamQuestion[]; // grouped in section order listening, translation, tones, speaking; throws Error("exam_pool_too_small")
export function examScore(scores: readonly number[]): number; // round(100 * sum / length), each score in 0..1; [] → 0
export function examMention(score: number): ExamMention; // ≥95 excellent, ≥85 tres_bien, ≥70 bien, else presque
```

- [ ] **Step 1: Failing tests**

```ts
import { drawExam, examScore, examMention } from "@/services/exam";
import { examPoolFixture } from "@/test/fixtures/examFixture";

test("30 questions with the right layout", () => {
  const q = drawExam(examPoolFixture, 1, true);
  expect(q).toHaveLength(30);
  const count = (s: string) => q.filter((x) => x.section === s).length;
  expect([count("listening"), count("translation"), count("tones"), count("speaking")]).toEqual([10, 8, 6, 6]);
  expect(new Set(q.map((x) => x.id)).size).toBe(30);
});
test("without speech recognition, speaking is replaced by 6 more listening", () => {
  const q = drawExam(examPoolFixture, 1, false);
  expect(q.filter((x) => x.section === "listening")).toHaveLength(16);
  expect(q.filter((x) => x.section === "speaking")).toHaveLength(0);
  expect(q).toHaveLength(30);
});
test("different seeds give different draws, same seed same draw", () => {
  expect(drawExam(examPoolFixture, 1, true)).toEqual(drawExam(examPoolFixture, 1, true));
  expect(drawExam(examPoolFixture, 1, true).map((q) => q.id)).not.toEqual(drawExam(examPoolFixture, 2, true).map((q) => q.id));
});
test("too small pool throws", () => expect(() => drawExam(examPoolFixture.slice(0, 10), 1, true)).toThrow("exam_pool_too_small"));
test("score and mention", () => {
  expect(examScore(Array(30).fill(1))).toBe(100);
  expect(examScore([...Array(21).fill(1), ...Array(9).fill(0)])).toBe(70);
  expect(examScore([0.5, 1])).toBe(75);
  expect(examScore([])).toBe(0);
  expect([examMention(96), examMention(85), examMention(70), examMention(69)]).toEqual(["excellent", "tres_bien", "bien", "presque"]);
});
```

- [ ] **Step 2: Implement**

```ts
import type { ExamQuestion, ExamSection } from "@/domain/types";
import { createRng, pickN } from "@/services/random";

export const EXAM_LAYOUT = { listening: 10, translation: 8, tones: 6, speaking: 6 } as const;
export const EXAM_PASS = 70;
export type ExamMention = "excellent" | "tres_bien" | "bien" | "presque";
const ORDER: ExamSection[] = ["listening", "translation", "tones", "speaking"];

export function drawExam(pool: readonly ExamQuestion[], seed: number, hasStt: boolean): ExamQuestion[] {
  const rng = createRng(seed);
  const layout: Record<ExamSection, number> = hasStt
    ? { ...EXAM_LAYOUT }
    : { ...EXAM_LAYOUT, listening: EXAM_LAYOUT.listening + EXAM_LAYOUT.speaking, speaking: 0 };
  return ORDER.flatMap((section) => {
    const candidates = pool.filter((q) => q.section === section && !q.exercise.deprecated);
    if (candidates.length < layout[section]) throw new Error("exam_pool_too_small");
    return pickN(candidates, layout[section], rng);
  });
}
export function examScore(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((100 * scores.reduce((a, b) => a + Math.max(0, Math.min(1, b)), 0)) / scores.length);
}
export function examMention(score: number): ExamMention {
  if (score >= 95) return "excellent";
  if (score >= 85) return "tres_bien";
  if (score >= EXAM_PASS) return "bien";
  return "presque";
}
```
- [ ] **Step 3: Run, commit** — `feat(services): add exam draw and scoring`

---

### Task T10: SyncService (outbox flushing with backoff)

**Spec:** §4.6 · **ADR:** 0004 · **Files:**
- Replace: `src/services/sync.ts` (stub) · Create: `src/services/sync.test.ts`
- Modify: `src/adapters/fakes/createFakeServices.ts` (real sync + `onEventAppended`)

**Interfaces — Produces:**
```ts
export type Timers = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
export type SyncService = {
  start(): void;              // flush now, flush on window "online", retry with backoff
  stop(): void;
  flush(): Promise<{ sent: number }>; // concurrent calls share the same in-flight promise
  onSizeChange(cb: (n: number) => void): () => void; // called after every flush attempt and enqueue notification
  notifyEnqueued(): void;     // called by ActivityService.onEventAppended → schedules an immediate flush
};
export function createSyncService(deps: {
  outbox: Outbox; sink: EventSink; timers?: Timers; batchSize?: number;
  addOnlineListener?: (cb: () => void) => () => void; // default: window.addEventListener("online")
}): SyncService;
export const BACKOFF_MS = [2000, 4000, 8000, 16000, 32000, 64000, 128000, 300000];
```

- [ ] **Step 1: Failing tests**

```ts
import { createSyncService } from "@/services/sync";
import { InMemoryOutbox, InMemoryProgressRepository, FakeEventSink } from "@/adapters/fakes";

async function seed(outbox: InMemoryOutbox, n: number) {
  const repo = new InMemoryProgressRepository();
  for (let i = 0; i < n; i++) await outbox.enqueue(await repo.appendEvent({ type: "lesson_completed", refId: `l${i}`, xp: 1, payload: {} }, "2026-10-10T08:00:00.000Z"));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("flush sends everything in batches and empties the outbox", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 120);
  const sync = createSyncService({ outbox, sink, batchSize: 50, addOnlineListener: () => () => {} });
  expect(await sync.flush()).toEqual({ sent: 120 });
  expect(await outbox.size()).toBe(0);
  expect(sink.received).toHaveLength(120);
});

test("offline: keeps events and retries with backoff", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  sink.online = false;
  await seed(outbox, 2);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  sync.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(2);
  sink.online = true;
  await vi.advanceTimersByTimeAsync(2000);
  expect(await outbox.size()).toBe(0);
  sync.stop();
});

test("online event triggers a flush", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  let fire: () => void = () => {};
  const sync = createSyncService({ outbox, sink, addOnlineListener: (cb) => { fire = cb; return () => {}; } });
  sync.start();
  await sync.flush(); // let the initial (empty) flush settle
  await seed(outbox, 1);
  fire();
  await vi.advanceTimersByTimeAsync(0);
  expect(await outbox.size()).toBe(0);
});

test("size listeners are notified", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 3);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  const sizes: number[] = [];
  sync.onSizeChange((n) => sizes.push(n));
  await sync.flush();
  expect(sizes.at(-1)).toBe(0);
});

test("concurrent flushes share one run", async () => {
  const outbox = new InMemoryOutbox(); const sink = new FakeEventSink();
  await seed(outbox, 5);
  const sync = createSyncService({ outbox, sink, addOnlineListener: () => () => {} });
  const [a, b] = await Promise.all([sync.flush(), sync.flush()]);
  expect(a).toBe(b);
  expect(sink.received).toHaveLength(5);
});
```

- [ ] **Step 2: Implement**

```ts
import type { EventSink, Outbox } from "@/ports";

export type Timers = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
export type SyncService = {
  start(): void; stop(): void; flush(): Promise<{ sent: number }>;
  onSizeChange(cb: (n: number) => void): () => void; notifyEnqueued(): void;
};
export const BACKOFF_MS = [2000, 4000, 8000, 16000, 32000, 64000, 128000, 300000];

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};
const defaultOnline = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", cb);
  return () => window.removeEventListener("online", cb);
};

export function createSyncService(deps: {
  outbox: Outbox; sink: EventSink; timers?: Timers; batchSize?: number; addOnlineListener?: (cb: () => void) => () => void;
}): SyncService {
  const timers = deps.timers ?? defaultTimers;
  const batch = deps.batchSize ?? 50;
  const listeners = new Set<(n: number) => void>();
  let inflight: Promise<{ sent: number }> | null = null;
  let retryHandle: unknown = null;
  let attempt = 0;
  let unlisten: (() => void) | null = null;
  let running = false;

  const notify = async () => { const n = await deps.outbox.size(); listeners.forEach((l) => l(n)); };
  const scheduleRetry = () => {
    if (!running || retryHandle !== null) return;
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
    attempt++;
    retryHandle = timers.setTimeout(() => { retryHandle = null; void flush(); }, delay);
  };

  async function run(): Promise<{ sent: number }> {
    let sent = 0;
    try {
      for (;;) {
        const events = await deps.outbox.peek(batch);
        if (events.length === 0) break;
        const { accepted } = await deps.sink.push(events);
        await deps.outbox.ack(accepted);
        sent += accepted.length;
        if (accepted.length === 0) break; // avoid infinite loop if the server rejects everything
      }
      attempt = 0;
    } catch {
      scheduleRetry();
    }
    await notify();
    return { sent };
  }

  function flush() {
    if (!inflight) inflight = run().finally(() => { inflight = null; });
    return inflight;
  }

  return {
    flush,
    start() {
      running = true;
      unlisten = (deps.addOnlineListener ?? defaultOnline)(() => { attempt = 0; void flush(); });
      void flush();
    },
    stop() {
      running = false;
      unlisten?.();
      if (retryHandle !== null) timers.clearTimeout(retryHandle);
      retryHandle = null;
    },
    onSizeChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    notifyEnqueued() { void notify(); void flush(); },
  };
}
```
The 60-second periodic flush from spec §4.6 is covered by the backoff (max 5 min) plus `online` and `notifyEnqueued`; no extra interval is needed.

- [ ] **Step 3: Wire into fakes** — in `createFakeServices`: create `sync = createSyncService({ outbox, sink })` before `activity`, and pass `onEventAppended: () => sync.notifyEnqueued()` to `createActivityService`.

- [ ] **Step 4: Run** `npx vitest run src/services` and `npm run verify` → PASS. **Commit:** `feat(services): add outbox sync service with backoff`
