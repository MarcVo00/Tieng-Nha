import type { LessonSummary, ProgressSnapshot } from "@/domain/types";
import { buildPathLayout, PATH_WIDTH, type PathNode } from "@/features/home/pathLayout";

const lessons: LessonSummary[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `l${n}`, title: `Leçon ${i + 1}`, description: "", emoji: "", dialogueId: `d${n}`, order: i + 1 };
});

function snapshot(lessonsDone: string[]): ProgressSnapshot {
  return { xpTotal: 0, xpWeek: 0, xpToday: 0, streak: 0, lessonsDone, perfectLessons: [], dialoguesDone: [], vocabReviewed: 0, examBest: null, badges: [], activeDays: [] };
}

const stop = (nodes: PathNode[], id: string) => {
  const node = nodes.find((n) => n.kind === "lesson" && n.key === id);
  if (!node) throw new Error(`no stop ${id}`);
  return node;
};
const cx = (n: PathNode) => PATH_WIDTH / 2 + n.offset;

test("before any lesson, the hero waits beside the path, level with lesson 1, away from it", () => {
  const { nodes, hero } = buildPathLayout(lessons, snapshot([]));
  const first = stop(nodes, "l01");
  expect(hero.at).toBeNull();
  expect(hero.y).toBe(first.cy);
  expect(Math.abs(hero.x - cx(first))).toBeGreaterThanOrEqual(64);
  expect(hero.x).toBeGreaterThanOrEqual(24);
  expect(hero.x).toBeLessThanOrEqual(PATH_WIDTH - 24);
});

test("the hero stands on the stop of the last lesson completed", () => {
  const { nodes, hero } = buildPathLayout(lessons, snapshot(["l01", "l02", "l03"]));
  const third = stop(nodes, "l03");
  expect(hero).toEqual({ at: "l03", x: cx(third), y: third.cy - third.size / 2 });
});

test("with a gap in the completed lessons, the hero is on the furthest one", () => {
  expect(buildPathLayout(lessons, snapshot(["l01", "l04", "l02"])).hero.at).toBe("l04");
});

test("once every lesson is done, the hero stands on lesson 10, facing the boss", () => {
  expect(buildPathLayout(lessons, snapshot(lessons.map((l) => l.id))).hero.at).toBe("l10");
});
