import type { Tree } from "@/domain/types";
import { blockingBoss, FINAL_BOSS_ID, levelLessons, nodeState, treeBosses, treeProgress } from "@/services/tree";

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

describe("levels", () => {
  const levels = {
    contentVersion: 1,
    nodes: [
      { id: "l01", kind: "lesson" as const, requires: [], branch: "trunk" },
      { id: "boss_thuy_tinh", kind: "boss" as const, requires: ["l01"], branch: "trunk" },
      { id: "l02", kind: "lesson" as const, requires: ["boss_thuy_tinh"], branch: "trunk" },
      { id: "l03", kind: "lesson" as const, requires: ["l02"], branch: "trunk" },
      { id: "boss_son_tinh", kind: "boss" as const, requires: ["l03"], branch: "trunk" },
    ],
  };
  test("a level's lessons stop at its boss", () => {
    expect(treeBosses(levels)).toEqual(["boss_thuy_tinh", "boss_son_tinh"]);
    expect(levelLessons(levels, 1)).toEqual(["l01"]);
    expect(levelLessons(levels, 2)).toEqual(["l02", "l03"]);
  });
  test("the next level stays locked until the boss before it is beaten, however many lessons are done", () => {
    const lost = treeProgress({ lessonsDone: ["l01"], examBest: 60 });
    expect(blockingBoss(levels, "l02", lost)).toBe("boss_thuy_tinh");
    expect(nodeState(levels, "l02", lost)).toBe("locked");
    const won = treeProgress({ lessonsDone: ["l01"], examBest: 70 });
    expect(blockingBoss(levels, "l02", won)).toBeNull();
    expect(nodeState(levels, "l02", won)).toBe("available");
  });
  test("each boss has its own win", () => {
    const p = treeProgress({ lessonsDone: ["l01", "l02", "l03"], examBest: 92, bossBests: { boss_son_tinh: 70 } });
    expect(p.bossesWon).toEqual(["boss_thuy_tinh", "boss_son_tinh"]);
    expect(treeProgress({ lessonsDone: [], examBest: null, bossBests: { boss_son_tinh: 92 } }).bossesWon).toEqual(["boss_son_tinh"]);
  });
});
