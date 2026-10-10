import type { LessonSummary, ProgressSnapshot } from "@/domain/types";

export const PATH_WIDTH = 320;
export const EXAM_UNLOCK_LESSONS = 10;
const MAIN_OFFSETS = [-40, 0, 40, 0] as const;
const ROW_HEIGHT = { lesson: 136, dialogue: 92, exam: 168 } as const;
const PAD = 24;

export type LessonState = "done" | "available" | "locked";

export type PathNode =
  | { kind: "lesson"; key: string; lesson: LessonSummary; order: number; state: LessonState; perfect: boolean; next: boolean; offset: number; cy: number; height: number; size: 64 }
  | { kind: "dialogue"; key: string; lesson: LessonSummary; done: boolean; offset: number; cy: number; height: number; size: 48 }
  | { kind: "exam"; key: string; locked: boolean; best: number | null; next: boolean; offset: number; cy: number; height: number; size: 64 };

export type PathLayout = { nodes: PathNode[]; height: number; d: string };

type Draft = PathNode extends infer N ? (N extends PathNode ? Omit<N, "cy"> : never) : never;

export function lessonStateOf(lessons: readonly LessonSummary[], index: number, done: ReadonlySet<string>): LessonState {
  const lesson = lessons[index];
  if (!lesson) return "locked";
  if (done.has(lesson.id)) return "done";
  const prev = lessons[index - 1];
  return !prev || done.has(prev.id) ? "available" : "locked";
}

/** Deterministic vertical layout: stops alternate -40/0/+40/0 px around the centre line. */
export function buildPathLayout(lessons: readonly LessonSummary[], snapshot: ProgressSnapshot): PathLayout {
  const done = new Set<string>(snapshot.lessonsDone);
  const perfect = new Set<string>(snapshot.perfectLessons);
  const dialoguesDone = new Set<string>(snapshot.dialoguesDone);
  const nextIndex = lessons.findIndex((_, i) => lessonStateOf(lessons, i, done) === "available");
  const examLocked = snapshot.lessonsDone.length < EXAM_UNLOCK_LESSONS;

  const drafts: Draft[] = [];
  let mainCount = 0;
  const mainOffset = (n: number) => MAIN_OFFSETS[n % MAIN_OFFSETS.length] ?? 0;
  lessons.forEach((lesson, i) => {
    const state = lessonStateOf(lessons, i, done);
    const offset = mainOffset(mainCount++);
    drafts.push({ kind: "lesson", key: lesson.id, lesson, order: i + 1, state, perfect: perfect.has(lesson.id), next: i === nextIndex, offset, height: ROW_HEIGHT.lesson, size: 64 });
    if (state === "done") {
      // The dialogue sits between its lesson and the next stop, nudged toward the middle of the curve.
      const dOffset = Math.round((offset + mainOffset(mainCount)) / 2) || 24;
      drafts.push({ kind: "dialogue", key: `${lesson.id}-dialogue`, lesson, done: dialoguesDone.has(lesson.dialogueId), offset: dOffset, height: ROW_HEIGHT.dialogue, size: 48 });
    }
  });
  drafts.push({ kind: "exam", key: "exam", locked: examLocked, best: snapshot.examBest, next: nextIndex === -1 && !examLocked, offset: mainOffset(mainCount), height: ROW_HEIGHT.exam, size: 64 });

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
  return { nodes, height: y + PAD, d };
}
