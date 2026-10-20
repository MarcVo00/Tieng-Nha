import type { Boss, LessonSummary, ProgressSnapshot, Tree } from "@/domain/types";
import { EXAM_PASS } from "@/services/exam";
import { FINAL_BOSS_ID, nodeState, treeProgress } from "@/services/tree";

export const PATH_WIDTH = 320;
const MAIN_OFFSETS = [-40, 0, 40, 0] as const;
const ROW_HEIGHT = { lesson: 136, dialogue: 92, exam: 168 } as const;
const PAD = 24;
const MILESTONE_EVERY = 3;

export type BossInfo = Pick<Boss, "name" | "illustration">;

export type LessonState = "done" | "available" | "locked";

export type PathNode =
  | { kind: "lesson"; key: string; lesson: LessonSummary; order: number; state: LessonState; perfect: boolean; stars: 0 | 1 | 2 | 3; milestone: boolean; next: boolean; offset: number; cy: number; height: number; size: 64 }
  | { kind: "dialogue"; key: string; lesson: LessonSummary; done: boolean; offset: number; cy: number; height: number; size: 48 }
  | { kind: "exam"; key: string; boss: BossInfo; locked: boolean; best: number | null; next: boolean; offset: number; cy: number; height: number; size: 64 };

/**
 * Where the hero stands: on top of the last lesson completed (`at` = its id, (x,y) = top of the stop), or, before
 * the first lesson, beside the path level with lesson 1 (`at` = null, (x,y) = where his feet touch the ground).
 */
export type HeroPlacement = { at: string | null; x: number; y: number };

export type PathLayout = { nodes: PathNode[]; height: number; d: string; hero: HeroPlacement };

const HERO_SIDE_GAP = 72; // px between lesson 1 and the waiting hero: clearly off the path, never on it
const HERO_EDGE = 24;

type Draft = PathNode extends infer N ? (N extends PathNode ? Omit<N, "cy"> : never) : never;

export function lessonStateOf(lessons: readonly LessonSummary[], index: number, done: ReadonlySet<string>): LessonState {
  const lesson = lessons[index];
  if (!lesson) return "locked";
  if (done.has(lesson.id)) return "done";
  const prev = lessons[index - 1];
  return !prev || done.has(prev.id) ? "available" : "locked";
}

/** Deterministic vertical layout: stops alternate -40/0/+40/0 px around the centre line. */
export function buildPathLayout(lessons: readonly LessonSummary[], snapshot: ProgressSnapshot, tree: Tree, boss: BossInfo): PathLayout {
  const done = new Set<string>(snapshot.lessonsDone);
  const perfect = new Set<string>(snapshot.perfectLessons);
  const dialoguesDone = new Set<string>(snapshot.dialoguesDone);
  const nextIndex = lessons.findIndex((_, i) => lessonStateOf(lessons, i, done) === "available");
  const examLocked = nodeState(tree, FINAL_BOSS_ID, treeProgress(snapshot)) === "locked";

  const drafts: Draft[] = [];
  let mainCount = 0;
  const mainOffset = (n: number) => MAIN_OFFSETS[n % MAIN_OFFSETS.length] ?? 0;
  lessons.forEach((lesson, i) => {
    const state = lessonStateOf(lessons, i, done);
    const offset = mainOffset(mainCount++);
    const isPerfect = perfect.has(lesson.id);
    // Stars: 1 = completed, 2 = completed and its dialogue played, 3 = perfect (no mistake).
    const stars = state !== "done" ? 0 : isPerfect ? 3 : dialoguesDone.has(lesson.dialogueId) ? 2 : 1;
    drafts.push({ kind: "lesson", key: lesson.id, lesson, order: i + 1, state, perfect: isPerfect, stars, milestone: (i + 1) % MILESTONE_EVERY === 0, next: i === nextIndex, offset, height: ROW_HEIGHT.lesson, size: 64 });
    if (state === "done") {
      // The dialogue sits between its lesson and the next stop, nudged toward the middle of the curve.
      const dOffset = Math.round((offset + mainOffset(mainCount)) / 2) || 24;
      drafts.push({ kind: "dialogue", key: `${lesson.id}-dialogue`, lesson, done: dialoguesDone.has(lesson.dialogueId), offset: dOffset, height: ROW_HEIGHT.dialogue, size: 48 });
    }
  });
  drafts.push({ kind: "exam", key: "exam", boss: { name: boss.name, illustration: boss.illustration }, locked: examLocked, best: snapshot.examBest, next: nextIndex === -1 && !examLocked && !(snapshot.examBest !== null && snapshot.examBest >= EXAM_PASS), offset: mainOffset(mainCount), height: ROW_HEIGHT.exam, size: 64 });

  let y = PAD;
  const nodes = drafts.map((n) => {
    const cy = y + n.height / 2;
    y += n.height;
    return { ...n, cy };
  });
  const cx = (n: PathNode) => PATH_WIDTH / 2 + n.offset;
  const d = nodes
    .map((n, i) => {
      const prev = nodes[i - 1];
      if (!prev) return `M${cx(n)} ${n.cy}`;
      const mid = (prev.cy + n.cy) / 2;
      return `C${cx(prev)} ${mid} ${cx(n)} ${mid} ${cx(n)} ${n.cy}`;
    })
    .join(" ");
  return { nodes, height: y + PAD, d, hero: placeHero(nodes, cx) };
}

function placeHero(nodes: readonly PathNode[], cx: (n: PathNode) => number): HeroPlacement {
  const lessonsOnPath = nodes.filter((n): n is Extract<PathNode, { kind: "lesson" }> => n.kind === "lesson");
  const last = lessonsOnPath.filter((n) => n.state === "done").at(-1);
  if (last) return { at: last.key, x: cx(last), y: last.cy - last.size / 2 };
  const first = lessonsOnPath[0];
  if (!first) return { at: null, x: PATH_WIDTH / 2, y: PAD };
  // Waits on the outer side of lesson 1, so he never sits on the path itself.
  const side = first.offset <= 0 ? -1 : 1;
  const x = Math.min(PATH_WIDTH - HERO_EDGE, Math.max(HERO_EDGE, cx(first) + side * HERO_SIDE_GAP));
  return { at: null, x, y: first.cy };
}
