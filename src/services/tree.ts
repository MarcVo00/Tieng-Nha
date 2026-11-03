import type { ProgressSnapshot, Tree } from "@/domain/types";
import { EXAM_PASS, examBestIn } from "@/services/exam";
import { LANGUAGES, type LanguageId } from "@/domain/languages";

/** The Vietnamese boss that closes the trunk; its fight uses the exam pool and its result is `examBest`. */
export const FINAL_BOSS_ID = "boss_thuy_tinh";

export type NodeState = "locked" | "available" | "done";
export type TreeProgress = { lessonsDone: readonly string[]; bossesWon: readonly string[] };

/** Progress on a language's tree: its lessons done, and its final boss once won. */
export function treeProgress(snapshot: Pick<ProgressSnapshot, "lessonsDone" | "examBest" | "examBests">, language: LanguageId = "vi"): TreeProgress {
  const best = examBestIn(snapshot, language);
  const boss = LANGUAGES[language].finalBossId;
  const won = boss !== null && best !== null && best >= EXAM_PASS;
  return { lessonsDone: snapshot.lessonsDone, bossesWon: won ? [boss] : [] };
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
