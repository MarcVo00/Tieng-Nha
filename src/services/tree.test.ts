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

test("each language's tree counts its own boss: Bakunawa is won by the Tagalog score, never the Vietnamese one", () => {
  const tlTree = {
    contentVersion: 1,
    nodes: [
      { id: "tl_l01", kind: "lesson" as const, requires: [], branch: "trunk" },
      { id: "tl_boss_bakunawa", kind: "boss" as const, requires: ["tl_l01"], branch: "trunk" },
    ],
  };
  const vietnameseOnly = treeProgress({ lessonsDone: ["tl_l01"], examBest: 92, examBests: { vi: 92 } }, "tl");
  expect(nodeState(tlTree, "tl_boss_bakunawa", vietnameseOnly)).toBe("available");
  const won = treeProgress({ lessonsDone: ["tl_l01"], examBest: null, examBests: { tl: 78 } }, "tl");
  expect(nodeState(tlTree, "tl_boss_bakunawa", won)).toBe("done");
  expect(treeProgress({ lessonsDone: [], examBest: null, examBests: { tl: 78 } }, "vi").bossesWon).toEqual([]);
});
