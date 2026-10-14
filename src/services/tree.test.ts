import type { Tree } from "@/domain/types";
import { FINAL_BOSS_ID, nodeState, treeProgress } from "@/services/tree";

const tree: Tree = {
  contentVersion: 1,
  nodes: [
    { id: "l01", kind: "lesson", requires: [], branch: "trunk" },
    { id: "l02", kind: "lesson", requires: ["l01"], branch: "trunk" },
    { id: FINAL_BOSS_ID, kind: "boss", requires: ["l02"], branch: "trunk" },
  ],
};

test("a node is available when all its prerequisites are done, locked otherwise", () => {
  const none = treeProgress({ lessonsDone: [], examBest: null });
  expect(nodeState(tree, "l01", none)).toBe("available");
  expect(nodeState(tree, "l02", none)).toBe("locked");
  expect(nodeState(tree, FINAL_BOSS_ID, none)).toBe("locked");
  const both = treeProgress({ lessonsDone: ["l01", "l02"], examBest: null });
  expect(nodeState(tree, "l02", both)).toBe("done");
  expect(nodeState(tree, FINAL_BOSS_ID, both)).toBe("available");
});

test("the final boss counts as done once beaten (best score at least 70)", () => {
  expect(nodeState(tree, FINAL_BOSS_ID, treeProgress({ lessonsDone: ["l01", "l02"], examBest: 60 }))).toBe("available");
  expect(nodeState(tree, FINAL_BOSS_ID, treeProgress({ lessonsDone: ["l01", "l02"], examBest: 70 }))).toBe("done");
});

test("an unknown node is locked", () => {
  expect(nodeState(tree, "nope", treeProgress({ lessonsDone: [], examBest: null }))).toBe("locked");
});
