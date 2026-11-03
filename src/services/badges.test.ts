import { evaluateBadges, shownBadges } from "@/services/badges";
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
  expect(defs).toHaveLength(33);
  expect(defs.every((d) => d.coins >= 20 && d.coins <= 200)).toBe(true);
  expect([coins["first_lesson"], coins["five_lessons"], coins["ten_lessons"]]).toEqual([20, 40, 100]);
  expect([coins["streak_3"], coins["streak_7"], coins["streak_14"], coins["streak_30"]]).toEqual([30, 60, 100, 200]);
  expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
});

test("Tagalog lessons never count toward the Vietnamese lesson badges", () => {
  const tl = ["tl_l01", "tl_l02", "tl_l03", "tl_l04", "tl_l05", "tl_l06", "tl_l07", "tl_l08"];
  const ids = evaluateBadges({ ...empty, lessonsDone: ["l01", ...tl, "l02", "l03"] }, defs);
  expect(ids).toEqual(expect.arrayContaining(["first_lesson", "three_lessons"]));
  expect(ids).not.toContain("five_lessons");
  expect(ids).not.toContain("ten_lessons");
});

test("Tagalog perfect lessons and dialogues do not unlock the Vietnamese badges", () => {
  const five = { id: "perfect_5", title: "t", description: "d", icon: "i", rule: { kind: "perfect_lessons" as const, gte: 5 }, coins: 60 };
  const one = { id: "perfect_1", title: "t", description: "d", icon: "i", rule: { kind: "perfect_lesson" as const }, coins: 20 };
  const dlg = { id: "dlg", title: "t", description: "d", icon: "i", rule: { kind: "dialogues_done" as const, gte: 1 }, coins: 20 };
  const perfect = ["tl_l01", "tl_l02", "tl_l03", "tl_l04", "tl_l05"];
  expect(evaluateBadges({ ...empty, perfectLessons: perfect }, [five, one])).toEqual([]);
  expect(evaluateBadges({ ...empty, dialoguesDone: ["tl_d01"] }, [dlg])).toEqual([]);
  expect(evaluateBadges({ ...empty, perfectLessons: [...perfect, "l01"] }, [one])).toEqual(["perfect_1"]);
});

test("the Tagalog badges count only Tagalog progress, and the Vietnamese ones only Vietnamese", () => {
  const tl = ["tl_l01", "tl_l02", "tl_l03", "tl_l04", "tl_l05", "tl_l06", "tl_l07", "tl_l08"];
  const tlDialogues = tl.map((id) => id.replace("_l", "_d"));
  const ids = evaluateBadges({ ...empty, lessonsDone: tl, perfectLessons: tl, dialoguesDone: tlDialogues, examBests: { tl: 92 } }, defs);
  expect(ids.sort()).toEqual(
    ["tl_all_dialogues", "tl_all_lessons", "tl_exam_excellent", "tl_exam_passed", "tl_first_dialogue", "tl_first_lesson", "tl_four_lessons", "tl_perfect_all", "tl_perfect_lesson"],
  );
  const vietnamese = evaluateBadges({ ...empty, lessonsDone: ["l01", "l02", "l03", "l04"], dialoguesDone: ["d01"], examBest: 92, examBests: { vi: 92 } }, defs);
  expect(vietnamese.filter((id) => id.startsWith("tl_"))).toEqual([]);
  expect(vietnamese).toEqual(expect.arrayContaining(["first_lesson", "exam_passed", "exam_excellent"]));
});

test("Tagalog badges pay between 20 and 200 xu and grant no item", () => {
  const tlDefs = defs.filter((d) => d.id.startsWith("tl_"));
  expect(tlDefs).toHaveLength(9);
  for (const d of tlDefs) {
    expect(d.coins).toBeGreaterThanOrEqual(20);
    expect(d.coins).toBeLessThanOrEqual(200);
    expect(d.reward).toBeUndefined();
  }
});

test("a profile shows another language's badges only once that language is started", () => {
  const count = (p: { lessonsDone: string[]; badges: string[] }, active?: "vi" | "tl") => shownBadges(defs, p, active).length;
  expect(count({ lessonsDone: ["l01"], badges: [] })).toBe(24);
  expect(count({ lessonsDone: ["l01"], badges: [] }, "tl")).toBe(33);
  expect(count({ lessonsDone: ["tl_l01"], badges: [] })).toBe(33);
  expect(count({ lessonsDone: [], badges: ["tl_first_lesson"] })).toBe(25);
});
