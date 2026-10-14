import type { Boss, Tree } from "@/domain/types";

/** The fakes have a single lesson (l05): it leads straight to the final boss. */
export const treeFixture: Tree = {
  contentVersion: 1,
  nodes: [
    { id: "l05", kind: "lesson", requires: [], branch: "trunk" },
    { id: "boss_thuy_tinh", kind: "boss", requires: ["l05"], branch: "trunk" },
  ],
};

export const bossFixture: Boss = {
  id: "boss_thuy_tinh",
  name: "Thủy Tinh",
  title: "Le dieu des eaux",
  legend:
    "Thủy Tinh voulait épouser la princesse Mỵ Nương. Battu par Sơn Tinh, le génie des montagnes, il fait monter les eaux chaque année. Repousse-les avec ton vietnamien !",
  illustration: "boss_thuy_tinh",
  hp: 15,
  playerLives: 5,
  pool: "exam",
};
