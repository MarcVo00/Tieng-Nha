import type { Tree } from "@/domain/types";

/** The fakes have a single lesson (l05): it leads straight to the final boss. */
export const treeFixture: Tree = {
  contentVersion: 1,
  nodes: [
    { id: "l05", kind: "lesson", requires: [], branch: "trunk" },
    { id: "boss_thuy_tinh", kind: "boss", requires: ["l05"], branch: "trunk" },
  ],
};
