import type { ProgressSnapshot, Tree } from "@/domain/types";
import { bossWon } from "@/services/exam";
import { LANGUAGES, type LanguageId } from "@/domain/languages";

/** The Vietnamese boss that closes the trunk; its fight uses the exam pool and its result is `examBest`. */
export const FINAL_BOSS_ID = "boss_thuy_tinh";

export type NodeState = "locked" | "available" | "done";
export type TreeProgress = { lessonsDone: readonly string[]; bossesWon: readonly string[] };

/** Progress on a language's tree: its lessons done, and its bosses won. */
export function treeProgress(snapshot: Pick<ProgressSnapshot, "lessonsDone" | "examBest" | "examBests" | "bossBests">, language: LanguageId = "vi"): TreeProgress {
  return { lessonsDone: snapshot.lessonsDone, bossesWon: LANGUAGES[language].bossIds.filter((id) => bossWon(snapshot, id)) };
}

/** The boss nodes of a tree, in path order: the nth closes level n. */
export const treeBosses = (tree: Tree): string[] => tree.nodes.filter((n) => n.kind === "boss").map((n) => n.id);

/** The lessons of level `level`: those between the boss before it and its own boss. */
export function levelLessons(tree: Tree, level: number): string[] {
  let current = 1;
  const ids: string[] = [];
  for (const n of tree.nodes) {
    if (n.kind === "boss") current += 1;
    else if (current === level) ids.push(n.id);
  }
  return ids;
}

/** The boss a lesson waits for: an unbeaten boss among its prerequisites, or null. */
export function blockingBoss(tree: Tree, lessonId: string, p: TreeProgress): string | null {
  const node = tree.nodes.find((n) => n.id === lessonId);
  const boss = node?.requires.find((r) => tree.nodes.some((n) => n.id === r && n.kind === "boss") && !p.bossesWon.includes(r));
  return boss ?? null;
}

/** Generic unlock rule (spec §2.2): a node is available once every node it requires is done. */
export function nodeState(tree: Tree, id: string, p: TreeProgress): NodeState {
  const node = tree.nodes.find((n) => n.id === id);
  if (!node) return "locked";
  const done = (nodeId: string): boolean => {
    const n = tree.nodes.find((x) => x.id === nodeId);
    if (!n) return false;
    return n.kind === "lesson" ? p.lessonsDone.includes(n.id) : p.bossesWon.includes(n.id);
  };
  if (done(node.id)) return "done";
  return node.requires.every(done) ? "available" : "locked";
}
