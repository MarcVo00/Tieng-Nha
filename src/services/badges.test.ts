import { evaluateBadges } from "@/services/badges";
import { BadgesFileSchema } from "@/content/schema";
import badgesFile from "@/content/badges.json";
import type { ProgressSnapshot } from "@/domain/types";

const defs = BadgesFileSchema.parse(badgesFile).badges;
const empty: ProgressSnapshot = { xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone: [], perfectLessons: [], dialoguesDone: [], vocabReviewed: 0, examBest: null, badges: [], activeDays: [] };

test("nothing for an empty snapshot", () => expect(evaluateBadges(empty, defs)).toEqual([]));
test("perfect_lessons counts distinct perfect lessons", () => {
  const five = { id: "perfect_5", title: "t", description: "d", icon: "i", rule: { kind: "perfect_lessons" as const, gte: 5 }, coins: 60 };
  expect(evaluateBadges({ ...empty, perfectLessons: ["l01", "l02", "l03", "l04"] }, [five])).toEqual([]);
  expect(evaluateBadges({ ...empty, perfectLessons: ["l01", "l02", "l03", "l04", "l05"] }, [five])).toEqual(["perfect_5"]);
});

test("first lesson + perfect", () =>
  expect(evaluateBadges({ ...empty, lessonsDone: ["l01"], perfectLessons: ["l01"] }, defs).sort()).toEqual(["first_lesson", "perfect_lesson"]));
test("already unlocked badges are not returned again", () =>
  expect(evaluateBadges({ ...empty, lessonsDone: ["l01"], badges: ["first_lesson"] }, defs)).toEqual([]));
test("streak, vocab, dialogues, exam thresholds", () => {
  const ids = evaluateBadges({ ...empty, streak: 7, vocabReviewed: 100, dialoguesDone: ["d01"], examBest: 91 }, defs);
  expect(ids).toEqual(expect.arrayContaining(["streak_3", "streak_7", "vocab_100", "first_dialogue", "exam_passed", "exam_excellent"]));
  expect(ids).not.toContain("streak_30");
});

test("xp_total and active_days unlock from the snapshot", () => {
  expect(evaluateBadges({ ...empty, xpTotal: 499 }, defs)).toEqual([]);
  expect(evaluateBadges({ ...empty, xpTotal: 1500 }, defs)).toEqual(["xp_500", "xp_1500"]);
  const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  expect(evaluateBadges({ ...empty, activeDays: days.slice(0, 9) }, defs)).toEqual([]);
  expect(evaluateBadges({ ...empty, activeDays: days }, defs)).toEqual(["days_10"]);
});

test("every badge pays between 20 and 200 xu, harder ones more", () => {
  const coins = Object.fromEntries(defs.map((d) => [d.id, d.coins]));
  expect(defs).toHaveLength(24);
  expect(defs.every((d) => d.coins >= 20 && d.coins <= 200)).toBe(true);
  expect([coins["first_lesson"], coins["five_lessons"], coins["ten_lessons"]]).toEqual([20, 40, 100]);
  expect([coins["streak_3"], coins["streak_7"], coins["streak_14"], coins["streak_30"]]).toEqual([30, 60, 100, 200]);
  expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
});
