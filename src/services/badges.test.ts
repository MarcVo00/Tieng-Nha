import { evaluateBadges } from "@/services/badges";
import { BadgesFileSchema } from "@/content/schema";
import badgesFile from "@/content/badges.json";
import type { ProgressSnapshot } from "@/domain/types";

const defs = BadgesFileSchema.parse(badgesFile).badges;
const empty: ProgressSnapshot = { xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone: [], perfectLessons: [], dialoguesDone: [], vocabReviewed: 0, examBest: null, badges: [], activeDays: [] };

test("nothing for an empty snapshot", () => expect(evaluateBadges(empty, defs)).toEqual([]));
test("perfect_lessons counts distinct perfect lessons", () => {
  const five = { id: "perfect_5", title: "t", description: "d", icon: "i", rule: { kind: "perfect_lessons" as const, gte: 5 } };
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
