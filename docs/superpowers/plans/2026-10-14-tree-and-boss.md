# Arbre de compétences + boss Thủy Tinh — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations de l'arbre de compétences (données + déverrouillage générique) et transformer le test final en combat contre le boss Thủy Tinh (PV, vies, victoire/défaite, certificat).

**Architecture:** Deux nouveaux fichiers de contenu (`tree.json`, `bosses.json`) lus par le port `ContentSource` ; deux modules purs (`services/tree.ts`, `services/bossFight.ts`) ; les écrans `/exam`, `/exam/run`, `/exam/result` deviennent l'intro, le combat et le résultat du boss. Le serveur ne change pas : l'événement `exam_finished` garde `score` (dérivé des vies) et `attemptId`, avec des champs d'information en plus.

**Tech Stack:** Vite 5, React 18, TS strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes), Tailwind 3.4 (tokens uniquement), motion 11 (`motion/react`), Zod 3, Vitest + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-14-progression-boss-energy-design.md`](../specs/2026-10-14-progression-boss-energy-design.md) §2, §3, §8 (étapes 1–2). Direction artistique : [`docs/art-direction.md`](../../art-direction.md), dessin [`docs/art/boss-thuy-tinh.svg`](../../art/boss-thuy-tinh.svg).

## Global Constraints

- Stack figée, **aucune nouvelle dépendance** (CLAUDE.md).
- Architecture hexagonale : `src/features/**` et `src/ui/**` n'importent **jamais** `src/adapters/**` ; une feature n'importe pas une autre feature (ESLint boundaries).
- Code, identifiants, commentaires et commits en **anglais** ; textes d'interface en **français** dans `src/i18n/fr.ts` uniquement.
- Couleurs : **tokens Tailwind uniquement** (`bg-paper`, `border-gold`, `text-ink`…), jamais de hex dans les composants.
- Animations : uniquement `transform` / `opacity`, durées/ressorts de `src/ui/motion.ts` (`duration`, `spring`, `ease`).
- Personnages toujours posés sur le médaillon papier (`bg-paper border-gold`), voir `docs/art-direction.md` §3.
- Les identifiants de contenu sont immuables (spec V1 §3).
- Commits **signés uniquement par l'utilisateur** : jamais de `Co-Authored-By: Claude` ni « Generated with Claude Code ».
- `npm run verify` vert avant chaque commit ; `npm run test:e2e` vert à la fin.
- Constantes du boss : **15 PV**, **5 vies** ; scores de victoire 5→100, 4→92, 3→85, 2→78, 1→70 ; défaite `round(60 × dégâts / PV)` ; mention ≥ 90 Excellent, ≥ 80 Très bien, ≥ 70 Réussi (spec §3.3).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/content/tree.json` | **new** — nœuds du tronc l01→l10→boss |
| `src/content/bosses.json` | **new** — fiche de Thủy Tinh |
| `src/content/schema.ts` | + `TreeFileSchema`, `BossesFileSchema` |
| `src/domain/types.ts` | + `TreeNode`, `Tree`, `Boss` ; payload `exam_finished` étendu |
| `src/ports/ContentSource.ts` | + `getTree()`, `getBoss(id)` |
| `src/adapters/content/StaticContentSource.ts` | charge `tree.json` / `bosses.json` |
| `src/adapters/fakes/InMemoryContentSource.ts`, `seed/tree.ts`, `createFakeServices.ts` | fakes |
| `scripts/contentChecks.ts`, `scripts/validate-content.ts` | validation arbre + boss |
| `src/services/tree.ts` | **new** — `FINAL_BOSS_ID`, `treeProgress`, `nodeState` |
| `src/services/bossFight.ts` | **new** — deck, coups, score, mention |
| `src/services/exam.ts` | réduit à `EXAM_PASS` + `ExamMention` (tirage/score supprimés) |
| `src/services/activity.ts` | `finishExam` accepte le résumé du boss |
| `src/features/home/pathLayout.ts`, `HomeScreen.tsx`, `PathStop.tsx` | déverrouillage par l'arbre, case boss |
| `src/assets/characters/boss-thuy-tinh.svg` | **new** — copie du dessin de référence |
| `src/features/exam/bossArt.ts`, `BossPortrait.tsx` | **new** — image + médaillon animé |
| `src/features/exam/ExamIntroScreen.tsx`, `ExamRunScreen.tsx`, `ExamResultScreen.tsx`, `examState.ts` | intro, combat, résultat |
| `src/features/profile/MeScreen.tsx`, `src/features/leaderboard/PublicProfileScreen.tsx` | « Thủy Tinh vaincu ✓ (4/5 ❤️) » |
| `src/content/badges.json`, `src/i18n/fr.ts` | textes |
| `e2e/boss.spec.ts` | **new** |

---

### Task 1: Tree content, schema, port and `services/tree.ts`

**Files:**
- Create: `src/content/tree.json`, `src/services/tree.ts`, `src/services/tree.test.ts`, `src/adapters/fakes/seed/tree.ts`
- Modify: `src/content/schema.ts`, `src/domain/types.ts`, `src/ports/ContentSource.ts`, `src/adapters/content/StaticContentSource.ts`, `src/adapters/fakes/InMemoryContentSource.ts`, `src/adapters/fakes/createFakeServices.ts`, `scripts/contentChecks.ts`, `scripts/validate-content.ts`, `scripts/contentChecks.test.ts`

**Interfaces:**
- Produces:
  - `type TreeNode = { id: string; kind: "lesson" | "boss"; requires: string[]; branch: string }`, `type Tree = { contentVersion: number; nodes: TreeNode[] }` (in `@/domain/types`)
  - `ContentSource.getTree(): Promise<Tree>`
  - `FINAL_BOSS_ID = "boss_thuy_tinh"`, `type TreeProgress = { lessonsDone: readonly string[]; bossesWon: readonly string[] }`, `treeProgress(snapshot: Pick<ProgressSnapshot, "lessonsDone" | "examBest">): TreeProgress`, `nodeState(tree: Tree, id: string, p: TreeProgress): "locked" | "available" | "done"` (in `@/services/tree`)
  - `treeFixture: Tree` (fakes: `l05` → boss)

- [ ] **Step 1: Write the failing tests** — `src/services/tree.test.ts`

```ts
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
```

- [ ] **Step 2: Run** `npx vitest run src/services/tree.test.ts` — expected FAIL (`Cannot find module '@/services/tree'`).

- [ ] **Step 3: Schema + types.** In `src/content/schema.ts`, after `ExamPoolSchema`:

```ts
export const TreeNodeSchema = z
  .object({ id: z.string().min(1), kind: z.enum(["lesson", "boss"]), requires: z.array(z.string().min(1)), branch: z.string().min(1) })
  .strict();
export const TreeFileSchema = z.object({ contentVersion: z.number().int().min(1), nodes: z.array(TreeNodeSchema).min(1) }).strict();
```

In `src/domain/types.ts`, add `TreeNodeSchema, TreeFileSchema` to the schema type import and:

```ts
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type Tree = z.infer<typeof TreeFileSchema>;
```

- [ ] **Step 4: Implement `src/services/tree.ts`**

```ts
import type { ProgressSnapshot, Tree } from "@/domain/types";
import { EXAM_PASS } from "@/services/exam";

/** The boss that closes the trunk; its fight uses the exam pool and its result is `examBest`. */
export const FINAL_BOSS_ID = "boss_thuy_tinh";

export type NodeState = "locked" | "available" | "done";
export type TreeProgress = { lessonsDone: readonly string[]; bossesWon: readonly string[] };

export function treeProgress(snapshot: Pick<ProgressSnapshot, "lessonsDone" | "examBest">): TreeProgress {
  const won = snapshot.examBest !== null && snapshot.examBest >= EXAM_PASS;
  return { lessonsDone: snapshot.lessonsDone, bossesWon: won ? [FINAL_BOSS_ID] : [] };
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
```

- [ ] **Step 5: Run** `npx vitest run src/services/tree.test.ts` — expected PASS (3 tests).

- [ ] **Step 6: Content file** `src/content/tree.json`

```json
{
  "contentVersion": 1,
  "nodes": [
    { "id": "l01", "kind": "lesson", "requires": [], "branch": "trunk" },
    { "id": "l02", "kind": "lesson", "requires": ["l01"], "branch": "trunk" },
    { "id": "l03", "kind": "lesson", "requires": ["l02"], "branch": "trunk" },
    { "id": "l04", "kind": "lesson", "requires": ["l03"], "branch": "trunk" },
    { "id": "l05", "kind": "lesson", "requires": ["l04"], "branch": "trunk" },
    { "id": "l06", "kind": "lesson", "requires": ["l05"], "branch": "trunk" },
    { "id": "l07", "kind": "lesson", "requires": ["l06"], "branch": "trunk" },
    { "id": "l08", "kind": "lesson", "requires": ["l07"], "branch": "trunk" },
    { "id": "l09", "kind": "lesson", "requires": ["l08"], "branch": "trunk" },
    { "id": "l10", "kind": "lesson", "requires": ["l09"], "branch": "trunk" },
    { "id": "boss_thuy_tinh", "kind": "boss", "requires": ["l10"], "branch": "trunk" }
  ]
}
```

- [ ] **Step 7: Port + adapters.**
  - `src/ports/ContentSource.ts`: add `getTree(): Promise<Tree>;` (import `Tree`).
  - `StaticContentSource`: add `tree: () => Promise<unknown>` to `ContentLoaders`; `async getTree() { return TreeFileSchema.parse(await this.loaders.tree()); }`; in `createStaticContentSource` add `const tree = import.meta.glob("/src/content/tree.json", { import: "default", eager: true });` and the loader `tree: async () => tree["/src/content/tree.json"]`.
  - `src/adapters/fakes/seed/tree.ts`:

```ts
import type { Tree } from "@/domain/types";

/** The fakes have a single lesson (l05): it leads straight to the final boss. */
export const treeFixture: Tree = {
  contentVersion: 1,
  nodes: [
    { id: "l05", kind: "lesson", requires: [], branch: "trunk" },
    { id: "boss_thuy_tinh", kind: "boss", requires: ["l05"], branch: "trunk" },
  ],
};
```

  - `InMemoryContentSource`: add a 5th constructor parameter `private readonly tree: Tree` and `async getTree() { return this.tree; }`. `createFakeServices`: pass `treeFixture`.

- [ ] **Step 8: Validation.** In `scripts/contentChecks.ts`: extend `ContentBundle` with `tree?: unknown`; parse it with `TreeFileSchema.safeParse` when present (push `tree: …` issues on failure). With a parsed tree, push errors for: duplicate node ids (`tree: duplicate node X`), unknown `requires` (`tree: X requires unknown Y`), a cycle (`tree: cycle through X`, DFS like the dialogue check), a lesson node without a lesson file (`tree: lesson X has no lesson file`). In `strict` mode also: every lesson file appears as a lesson node (`tree: lesson X missing from the tree`) and `tree` is required (`tree: missing`). In `validate-content.ts` pass `tree: existsSync(join(root, "tree.json")) ? JSON.parse(readFileSync(join(root, "tree.json"), "utf8")) : undefined`. In `scripts/contentChecks.test.ts` add:

```ts
test("the tree must reference existing nodes and be acyclic", () => {
  const tree = { contentVersion: 1, nodes: [
    { id: "a", kind: "boss", requires: ["b"], branch: "trunk" },
    { id: "b", kind: "boss", requires: ["a", "ghost"], branch: "trunk" },
  ] };
  const errors = checkContent({ lessons: [], dialogues: [], exam: { contentVersion: 1, questions: [] }, badges: { contentVersion: 1, badges: [] }, tree }, { strict: false });
  expect(errors).toContain("tree: b requires unknown ghost");
  expect(errors.some((e) => e.startsWith("tree: cycle through"))).toBe(true);
});
```

(Adapt the `badges` literal to whatever minimal valid shape the existing tests in that file already use.)

- [ ] **Step 9: Run** `npm run verify` — expected green (`✓ Content valid (strict)`).

- [ ] **Step 10: Commit**

```bash
git add src/content/tree.json src/content/schema.ts src/domain/types.ts src/ports/ContentSource.ts src/adapters scripts src/services/tree.ts src/services/tree.test.ts
git commit -m "feat(tree): add the skill tree content and the generic unlock rule"
```

---

### Task 2: Path and exam intro unlock through the tree

**Files:**
- Modify: `src/features/home/pathLayout.ts`, `src/features/home/pathLayout.test.ts`, `src/features/home/HomeScreen.tsx`, `src/features/exam/ExamIntroScreen.tsx`, `src/features/exam/examState.ts`, `src/features/exam/exam.test.tsx`

**Interfaces:**
- Consumes: `ContentSource.getTree`, `FINAL_BOSS_ID`, `nodeState`, `treeProgress` (Task 1).
- Produces: `buildPathLayout(lessons: readonly LessonSummary[], snapshot: ProgressSnapshot, tree: Tree): PathLayout` (new third parameter). `EXAM_UNLOCK_LESSONS` and `EXAM_LESSONS_REQUIRED` are **removed**.

- [ ] **Step 1: Failing test** — in `pathLayout.test.ts`, build `const tree: Tree` from the 10 `lessons` (`requires` = previous id) plus `{ id: FINAL_BOSS_ID, kind: "boss", requires: ["l10"], branch: "trunk" }`, pass it to every `buildPathLayout(lessons, snapshot(...), tree)` call, and add:

```ts
test("the boss stop is locked until the tree says so", () => {
  const exam = (done: string[]) => buildPathLayout(lessons, snapshot(done), tree).nodes.find((n) => n.kind === "exam");
  expect(exam(lessons.slice(0, 9).map((l) => l.id))).toMatchObject({ locked: true });
  expect(exam(lessons.map((l) => l.id))).toMatchObject({ locked: false });
});
```

- [ ] **Step 2: Run** `npx vitest run src/features/home/pathLayout.test.ts` — expected FAIL (type error / wrong arity).

- [ ] **Step 3: Implement.** In `pathLayout.ts`: delete `EXAM_UNLOCK_LESSONS`; add the `tree: Tree` parameter; replace `const examLocked = snapshot.lessonsDone.length < EXAM_UNLOCK_LESSONS;` with `const examLocked = nodeState(tree, FINAL_BOSS_ID, treeProgress(snapshot)) === "locked";`. In `HomeScreen.tsx`, load the tree alongside the lessons (same effect, `Promise.all([content.listLessons(), content.getTree()])`), keep it in state, and pass it to `buildPathLayout`; the layout stays `null` until both are loaded.

- [ ] **Step 4: Exam intro.** In `examState.ts` delete `EXAM_LESSONS_REQUIRED`. In `ExamIntroScreen.tsx` load the tree with `content.getTree()` in an effect (state `tree: Tree | null`, skeleton while `null`), then:

```ts
const progress = treeProgress(snapshot);
const unlocked = nodeState(tree, FINAL_BOSS_ID, progress) !== "locked";
const trunkLessons = tree.nodes.filter((n) => n.kind === "lesson");
const done = trunkLessons.filter((n) => progress.lessonsDone.includes(n.id)).length;
const total = trunkLessons.length;
```

and use `done / total` (instead of `EXAM_LESSONS_REQUIRED`) in the locked card. In `exam.test.tsx`, the fakes tree has one lesson (`l05`): change the locked test to use `snapshotWith(0)` and expect `fr.exam.intro.locked.progress(0, 1)`; tests that need the boss unlocked must have `l05` in `lessonsDone` — replace `snapshotWith` with:

```ts
const snapshotWith = (lessons: number, examBest: number | null = null): ProgressSnapshot => ({
  xpTotal: 120, xpWeek: 40, xpToday: 10, streak: 3,
  lessonsDone: lessons > 0 ? ["l05"] : [],
  perfectLessons: [], dialoguesDone: [], vocabReviewed: 0, examBest, badges: [], activeDays: [],
});
```

- [ ] **Step 5: Run** `npx vitest run src/features/home src/features/exam` — expected PASS.

- [ ] **Step 6: Run** `npm run verify` — expected green. **Commit**

```bash
git add src/features/home src/features/exam
git commit -m "feat(tree): unlock the final test from the skill tree instead of a lesson count"
```

---

### Task 3: Boss content, art and portrait

**Files:**
- Create: `src/content/bosses.json`, `src/assets/characters/boss-thuy-tinh.svg` (copy of `docs/art/boss-thuy-tinh.svg`), `src/features/exam/bossArt.ts`, `src/features/exam/BossPortrait.tsx`, `src/features/exam/BossPortrait.test.tsx`
- Modify: `src/content/schema.ts`, `src/domain/types.ts`, `src/ports/ContentSource.ts`, `src/adapters/content/StaticContentSource.ts`, `src/adapters/fakes/InMemoryContentSource.ts`, `src/adapters/fakes/seed/tree.ts`, `src/adapters/fakes/createFakeServices.ts`, `scripts/contentChecks.ts`, `scripts/validate-content.ts`, `src/i18n/fr.ts`

**Interfaces:**
- Produces:
  - `type Boss = { id: string; name: string; title: string; legend: string; illustration: string; hp: number; playerLives: number; pool: "exam" }`
  - `ContentSource.getBoss(id: string): Promise<Boss>` (throws `ContentNotFoundError`)
  - `bossFixture: Boss` (in `seed/tree.ts`, same values as `bosses.json`)
  - `bossArtUrl(illustration: string): string | null` (`@/features/exam/bossArt`)
  - `<BossPortrait boss={Boss} size={number} hits={number} defeated={boolean} />`

- [ ] **Step 1: Content** `src/content/bosses.json`

```json
{
  "contentVersion": 1,
  "bosses": [
    {
      "id": "boss_thuy_tinh",
      "name": "Thủy Tinh",
      "title": "Le dieu des eaux",
      "legend": "Thủy Tinh voulait épouser la princesse Mỵ Nương. Battu par Sơn Tinh, le génie des montagnes, il fait monter les eaux chaque année. Repousse-les avec ton vietnamien !",
      "illustration": "boss_thuy_tinh",
      "hp": 15,
      "playerLives": 5,
      "pool": "exam"
    }
  ]
}
```

- [ ] **Step 2: Schema, types, port, adapters, fakes** (same pattern as Task 1):

```ts
// schema.ts
export const BossSchema = z
  .object({
    id: z.string().regex(/^boss_[a-z0-9_]+$/),
    name: ViTextSchema,
    title: z.string().min(1),
    legend: z.string().min(1),
    illustration: z.string().min(1),
    hp: z.number().int().min(1).max(50),
    playerLives: z.number().int().min(1).max(10),
    pool: z.literal("exam"),
  })
  .strict();
export const BossesFileSchema = z.object({ contentVersion: z.number().int().min(1), bosses: z.array(BossSchema).min(1) }).strict();
```

`types.ts`: `export type Boss = z.infer<typeof BossSchema>;`. Port: `getBoss(id: string): Promise<Boss>; // throws ContentNotFoundError`. `StaticContentSource`: loader `bosses` (eager glob of `/src/content/bosses.json`), `async getBoss(id) { const b = BossesFileSchema.parse(await this.loaders.bosses()).bosses.find((x) => x.id === id); if (!b) throw new ContentNotFoundError(id); return b; }`. `InMemoryContentSource`: 6th constructor parameter `bosses: Boss[]`, same lookup. `seed/tree.ts`: export `bossFixture` with the JSON values above; `createFakeServices` passes `[bossFixture]`. Validation: `ContentBundle.bosses?: unknown`, parse with `BossesFileSchema`; errors `bosses: X is not a boss node of the tree` (each boss id must be a `kind: "boss"` node) and, in strict mode, `tree: boss node X has no boss sheet` and `bosses: X needs N questions, the exam pool has M` when `hp + playerLives - 1 > questions.length`.

- [ ] **Step 3: Art.** `cp docs/art/boss-thuy-tinh.svg src/assets/characters/boss-thuy-tinh.svg`. `src/features/exam/bossArt.ts`:

```ts
import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";

const ART: Record<string, string> = { boss_thuy_tinh: thuyTinh };

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string): string | null {
  return ART[illustration] ?? null;
}
```

- [ ] **Step 4: Failing test** `src/features/exam/BossPortrait.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { BossPortrait } from "@/features/exam/BossPortrait";

test("shows the boss on its paper medallion with an accessible name", () => {
  render(<BossPortrait boss={bossFixture} size={160} hits={0} defeated={false} />);
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeInTheDocument();
});

test("a defeated boss says so", () => {
  render(<BossPortrait boss={bossFixture} size={160} hits={3} defeated />);
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeInTheDocument();
});
```

(Test files may import fakes: `src/**/*.test.tsx` is outside the boundary rule; existing tests already import `@/adapters/fakes`.)

- [ ] **Step 5: Run** `npx vitest run src/features/exam/BossPortrait.test.tsx` — expected FAIL.

- [ ] **Step 6: Implement** `fr.ts` → in `exam`: `boss: { aria: (name: string, title: string, defeated: boolean) => \`${name}, ${title.charAt(0).toLowerCase()}${title.slice(1)}${defeated ? " — vaincu" : ""}\` }`. `src/features/exam/BossPortrait.tsx`:

```tsx
import { useEffect } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { Boss } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { duration, spring } from "@/ui";
import { bossArtUrl } from "@/features/exam/bossArt";

const SHAKE = [0, -8, 8, -5, 5, 0];

// The boss on its paper medallion (docs/art-direction.md §3). Shakes on every hit, bows when defeated.
export function BossPortrait({ boss, size, hits, defeated }: { boss: Boss; size: number; hits: number; defeated: boolean }) {
  const controls = useAnimationControls();
  const url = bossArtUrl(boss.illustration);
  useEffect(() => {
    if (hits === 0 || defeated) return;
    void controls.start({ x: SHAKE, opacity: [1, 0.6, 1], transition: { duration: duration.base } });
  }, [hits, defeated, controls]);
  useEffect(() => {
    if (defeated) void controls.start({ rotate: -8, y: 6, transition: spring.soft });
  }, [defeated, controls]);
  return (
    <motion.div
      role="img"
      aria-label={fr.exam.boss.aria(boss.name, boss.title, defeated)}
      animate={controls}
      className="flex items-center justify-center overflow-hidden rounded-lg border-2 border-gold bg-paper shadow-card"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" width={size * 0.86} height={size * 0.86} draggable={false} /> : null}
    </motion.div>
  );
}
```

- [ ] **Step 7: Run** the portrait test, then `npm run verify` — expected green. **Commit**

```bash
git add src/content/bosses.json src/content/schema.ts src/domain/types.ts src/ports src/adapters scripts src/assets src/features/exam/bossArt.ts src/features/exam/BossPortrait.tsx src/features/exam/BossPortrait.test.tsx src/i18n/fr.ts
git commit -m "feat(boss): add the Thuy Tinh boss sheet, its art and the portrait"
```

---

### Task 4: `services/bossFight.ts` (pure fight rules)

**Files:**
- Create: `src/services/bossFight.ts`, `src/services/bossFight.test.ts`

**Interfaces:**
- Consumes: `Boss`, `ExamQuestion` types; `createRng`, `shuffle` (`@/services/random`); `ExamMention` (`@/services/exam`).
- Produces:
  - `type FightStatus = "fighting" | "won" | "lost"`
  - `type Fight = { bossHp: number; lives: number; answers: { questionId: string; correct: boolean }[]; status: FightStatus }`
  - `maxQuestions(boss: Boss): number` — `hp + playerLives - 1`
  - `buildDeck(pool: readonly ExamQuestion[], boss: Boss, seed: number, hasStt: boolean): ExamQuestion[]`
  - `startFight(boss: Boss): Fight`
  - `answer(fight: Fight, questionId: string, correct: boolean): Fight`
  - `outOfQuestions(fight: Fight): Fight` — a fight still running becomes `lost`
  - `fightScore(fight: Fight, boss: Boss): number`
  - `bossMention(score: number): ExamMention`
  - `livesFromScore(score: number, playerLives: number): number | null`

- [ ] **Step 1: Failing tests** `src/services/bossFight.test.ts`

```ts
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { answer, bossMention, buildDeck, fightScore, livesFromScore, maxQuestions, outOfQuestions, startFight, type Fight } from "@/services/bossFight";

const play = (results: boolean[]): Fight => results.reduce((f, ok, i) => answer(f, `q${i}`, ok), startFight(bossFixture));

test("15 HP and 5 lives: at most 19 questions, drawn without repeats, rotating through the sections", () => {
  expect(maxQuestions(bossFixture)).toBe(19);
  const deck = buildDeck(examPoolFixture, bossFixture, 42, true);
  expect(deck).toHaveLength(19);
  expect(new Set(deck.map((q) => q.id)).size).toBe(19);
  expect(deck.slice(0, 4).map((q) => q.section)).toEqual(["listening", "translation", "tones", "speaking"]);
  expect(buildDeck(examPoolFixture, bossFixture, 42, true)).toEqual(deck); // same seed, same deck
});

test("without speech recognition, no speaking question is drawn", () => {
  expect(buildDeck(examPoolFixture, bossFixture, 7, false).some((q) => q.section === "speaking")).toBe(false);
});

test("a right answer hits the boss, a wrong one costs a life, and the fight ends at 0", () => {
  const f = play([true, false, true]);
  expect(f).toMatchObject({ bossHp: 13, lives: 4, status: "fighting" });
  expect(play(Array(15).fill(true)).status).toBe("won");
  expect(play(Array(5).fill(false)).status).toBe("lost");
  const over = play(Array(5).fill(false));
  expect(answer(over, "late", true)).toBe(over); // a finished fight ignores answers
});

test("score: victory by lives left, defeat by damage dealt", () => {
  const win = (wrong: number) => play([...Array(wrong).fill(false), ...Array(15).fill(true)]);
  expect([0, 1, 2, 3, 4].map((w) => fightScore(win(w), bossFixture))).toEqual([100, 92, 85, 78, 70]);
  expect(fightScore(play([...Array(9).fill(true), ...Array(5).fill(false)]), bossFixture)).toBe(36); // round(60 * 9 / 15)
  expect(fightScore(play(Array(5).fill(false)), bossFixture)).toBe(0);
});

test("running out of questions while fighting is a defeat", () => {
  expect(outOfQuestions(play([true])).status).toBe("lost");
  expect(outOfQuestions(play(Array(15).fill(true))).status).toBe("won");
});

test("mention and lives read back from a score", () => {
  expect([100, 92, 85, 78, 70, 36].map(bossMention)).toEqual(["excellent", "excellent", "tres_bien", "bien", "bien", "presque"]);
  expect([100, 92, 85, 78, 70].map((s) => livesFromScore(s, 5))).toEqual([5, 4, 3, 2, 1]);
  expect(livesFromScore(36, 5)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/services/bossFight.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Implement** `src/services/bossFight.ts`

```ts
import type { Boss, ExamQuestion, ExamSection } from "@/domain/types";
import type { ExamMention } from "@/services/exam";
import { createRng, shuffle } from "@/services/random";

const ROTATION: readonly ExamSection[] = ["listening", "translation", "tones", "speaking"];
const WIN_SCORES_5_LIVES = [70, 78, 85, 92, 100] as const; // spec §3.3, index = lives left - 1
const DEFEAT_MAX = 60;

export type FightStatus = "fighting" | "won" | "lost";
export type Fight = { bossHp: number; lives: number; answers: { questionId: string; correct: boolean }[]; status: FightStatus };

/** Enough questions for the longest possible fight: every hit plus every life but the last. */
export const maxQuestions = (boss: Boss): number => boss.hp + boss.playerLives - 1;

/** One question at a time, no repeats, rotating through the sections (speaking only with speech recognition). */
export function buildDeck(pool: readonly ExamQuestion[], boss: Boss, seed: number, hasStt: boolean): ExamQuestion[] {
  const rng = createRng(seed);
  const sections = ROTATION.filter((s) => hasStt || s !== "speaking");
  const queues = new Map(sections.map((s) => [s, shuffle(pool.filter((q) => q.section === s && !q.exercise.deprecated), rng)]));
  const deck: ExamQuestion[] = [];
  const need = maxQuestions(boss);
  for (let i = 0; deck.length < need; i++) {
    if (sections.every((s) => (queues.get(s)?.length ?? 0) === 0)) break;
    const next = queues.get(sections[i % sections.length] ?? "listening")?.shift();
    if (next) deck.push(next);
  }
  return deck;
}

export const startFight = (boss: Boss): Fight => ({ bossHp: boss.hp, lives: boss.playerLives, answers: [], status: "fighting" });

export function answer(fight: Fight, questionId: string, correct: boolean): Fight {
  if (fight.status !== "fighting") return fight;
  const bossHp = correct ? fight.bossHp - 1 : fight.bossHp;
  const lives = correct ? fight.lives : fight.lives - 1;
  const status: FightStatus = bossHp <= 0 ? "won" : lives <= 0 ? "lost" : "fighting";
  return { bossHp, lives, answers: [...fight.answers, { questionId, correct }], status };
}

export const outOfQuestions = (fight: Fight): Fight => (fight.status === "fighting" ? { ...fight, status: "lost" } : fight);

function winScore(livesLeft: number, playerLives: number): number {
  if (playerLives === 5) return WIN_SCORES_5_LIVES[livesLeft - 1] ?? 70;
  return 70 + Math.round((30 * (livesLeft - 1)) / Math.max(1, playerLives - 1));
}

/** The 0-100 score stored for the attempt (badges, XP, best score). */
export function fightScore(fight: Fight, boss: Boss): number {
  if (fight.status === "won") return winScore(fight.lives, boss.playerLives);
  return Math.round((DEFEAT_MAX * (boss.hp - fight.bossHp)) / boss.hp);
}

export function bossMention(score: number): ExamMention {
  if (score >= 90) return "excellent";
  if (score >= 80) return "tres_bien";
  if (score >= 70) return "bien";
  return "presque";
}

/** Lives left behind a victory score (profile: "4/5 ❤️"); null for a defeat score. */
export function livesFromScore(score: number, playerLives: number): number | null {
  for (let lives = playerLives; lives >= 1; lives--) if (winScore(lives, playerLives) === score) return lives;
  return null;
}
```

- [ ] **Step 4: Run** `npx vitest run src/services/bossFight.test.ts` — expected PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/bossFight.ts src/services/bossFight.test.ts
git commit -m "feat(boss): add the pure boss fight rules (deck, hits, lives, score, mention)"
```

---

### Task 5: Boss intro screen

**Files:**
- Modify: `src/features/exam/ExamIntroScreen.tsx`, `src/features/exam/exam.test.tsx` (`describe("intro")`), `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `getBoss`, `getTree`, `FINAL_BOSS_ID`, `nodeState`, `treeProgress`, `livesFromScore`, `EXAM_PASS`, `<BossPortrait>`.
- Produces: intro texts `fr.exam.intro.kicker = "Boss final"`, `fr.exam.intro.rules(hp: number, lives: number): string[]`, `fr.exam.intro.won(name: string, lives: number, max: number)`.

- [ ] **Step 1: Failing tests** — replace `"lists the rules and the best score once unlocked"` with:

```tsx
test("presents the boss, its legend and the fight rules once unlocked", async () => {
  useAppState.setState({ snapshot: snapshotWith(1, null) });
  renderExam({ entry: "/exam" });
  expect(await screen.findByRole("heading", { name: "Thủy Tinh" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeInTheDocument();
  expect(screen.getByText(/Mỵ Nương/)).toBeInTheDocument();
  for (const rule of fr.exam.intro.rules(15, 5)) expect(screen.getByText(rule)).toBeInTheDocument();
});

test("shows the best victory as the lives kept", async () => {
  useAppState.setState({ snapshot: snapshotWith(1, 92) });
  renderExam({ entry: "/exam" });
  expect(await screen.findByText(fr.exam.intro.won("Thủy Tinh", 4, 5))).toBeInTheDocument();
});
```

Keep the other intro tests; replace any `fr.exam.intro.title` heading lookup with `{ name: "Thủy Tinh" }`.

- [ ] **Step 2: Run** `npx vitest run src/features/exam/exam.test.tsx -t intro` — expected FAIL.

- [ ] **Step 3: Texts** (`fr.exam.intro`): `kicker: "Boss final"`; replace `rules` by

```ts
rules: (hp: number, lives: number) => [
  `Thủy Tinh a ${hp} PV : chaque bonne réponse lui en retire 1`,
  `Tu as ${lives} vies : chaque erreur t'en coûte 1`,
  "Pas de correction pendant le combat : tu la verras à la fin",
  "3 essais par jour ; le certificat s'obtient en le battant",
],
won: (name: string, lives: number, max: number) => `${name} vaincu ✓ (${lives}/${max} ❤️)`,
```

and `locked.title: "Thủy Tinh t'attend au bout du parcours"`, `locked.body: "Termine les leçons pour l'affronter."`. Remove `partsLabel` (and the sections list) if no longer used.

- [ ] **Step 4: Implement.** Load `content.getBoss(FINAL_BOSS_ID)` together with the tree (Task 2 effect, `Promise.all`). Layout (hero = the boss): kicker (`text-caption text-gold-ink`) → `<BossPortrait boss={boss} size={176} hits={0} defeated={false} />` centered → `<h1 lang="vi" className="text-title text-ink">{boss.name}</h1>` → `boss.title` (`text-body-strong text-ink-muted`) → `boss.legend` (`text-body text-ink`). Best line, when `examBest !== null`: if `livesFromScore(examBest, boss.playerLives)` is a number, `fr.exam.intro.won(boss.name, lives, boss.playerLives)` in `text-body-strong text-gold-ink`, otherwise nothing. Unlocked: the rules list from `fr.exam.intro.rules(boss.hp, boss.playerLives)` then the existing start button/offline/error block unchanged. Locked: the existing card with the new title/body and the Task 2 progress.

- [ ] **Step 5: Run** the intro tests, then `npm run verify`. **Commit**

```bash
git add src/features/exam/ExamIntroScreen.tsx src/features/exam/exam.test.tsx src/i18n/fr.ts
git commit -m "feat(boss): turn the exam intro into the Thuy Tinh boss presentation"
```

---

### Task 6: Boss fight screen

**Files:**
- Modify: `src/features/exam/ExamRunScreen.tsx`, `src/features/exam/examState.ts`, `src/services/activity.ts`, `src/services/activity.test.ts`, `src/domain/types.ts`, `src/services/exam.ts`, `src/services/exam.test.ts`, `src/features/exam/exam.test.tsx` (`describe("run")`), `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `buildDeck`, `startFight`, `answer`, `outOfQuestions`, `fightScore`, `bossMention` (Task 4); `getBoss` (Task 3); `<BossPortrait>`.
- Produces:
  - `ActivityService.finishExam(i: { attemptId: string; score: number; noSpeaking: boolean; boss?: BossOutcome }): Promise<ActivityResult>` where `type BossOutcome = { bossId: string; won: boolean; livesLeft: number; bossHpLeft: number }` (exported from `@/services/activity`); the event payload is `{ score, attemptId, noSpeaking, ...boss }`.
  - `EventPayload["exam_finished"]` gains optional `bossId?: string; won?: boolean; livesLeft?: number; bossHpLeft?: number`.
  - `ResultState` gains `boss: { id: string; name: string; title: string; illustration: string; hp: number; playerLives: number; won: boolean; livesLeft: number; bossHpLeft: number }`; `isResultState` checks `isRecord(v["boss"]) && typeof v["boss"]["won"] === "boolean"`.
  - `src/services/exam.ts` keeps only `EXAM_PASS` and `ExamMention`; `drawExam`, `examScore`, `examMention`, `EXAM_LAYOUT` are deleted with their tests (`src/services/exam.test.ts` keeps nothing → delete the file). `EXAM_TOTAL`, `sectionsOf`'s use in the run screen and `formatElapsed` go if unused (`npm run verify` / ESLint will flag leftovers).

- [ ] **Step 1: Activity test** — in `src/services/activity.test.ts` add:

```ts
test("finishExam records the boss outcome in the event payload", async () => {
  const s = createFakeServices();
  await s.activity.finishExam({ attemptId: "a1", score: 92, noSpeaking: false, boss: { bossId: "boss_thuy_tinh", won: true, livesLeft: 4, bossHpLeft: 0 } });
  const ev = (await s.progress.listEvents()).find((e) => e.type === "exam_finished");
  expect(ev?.payload).toEqual({ score: 92, attemptId: "a1", noSpeaking: false, bossId: "boss_thuy_tinh", won: true, livesLeft: 4, bossHpLeft: 0 });
});
```

(Use the file's existing setup helpers if it already builds services differently.)

- [ ] **Step 2: Fight tests** — in `exam.test.tsx`, replace `answerAll`, `setupRun` and the two « 30 right answers » / « without speech recognition » tests by:

```tsx
async function fight(deck: ExamQuestion[], rightUntil: number, stt: FakeSpeechRecognizer) {
  // Answers right for the first `rightUntil` questions, wrong afterwards, until the result page shows up.
  for (const [i, q] of deck.entries()) {
    if (await screen.findByRole("heading", { level: 1 }, { timeout: 50 }).then(() => true, () => false)) return;
    await waitFor(() => expect(document.querySelectorAll("[data-exercise-id]")).toHaveLength(1));
    await waitFor(() => expect(document.querySelector(`[data-exercise-id="${q.exercise.id}"]`)).not.toBeNull());
    const right = i < rightUntil;
    const ex = q.exercise;
    const verify = () => userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
    switch (ex.type) {
      case "listen_choose": {
        const label = (ex.vocabId === "v_ca_phe_sua_da") === right ? /café au lait glacé/ : /thé glacé/;
        await userEvent.click(await screen.findByRole("button", { name: label }));
        await verify();
        break;
      }
      case "tone_pick":
        await userEvent.click(await screen.findByRole("button", { name: right ? fr.ui.tones[ex.answerTone] : fr.ui.tones[ex.answerTone === "ngang" ? "sac" : "ngang"] }));
        await verify();
        break;
      case "translate_choose":
        await userEvent.click(await screen.findByRole("button", { name: right ? ex.answerVi : (ex.distractorsVi[0] ?? "") }));
        await verify();
        break;
      case "word_order": {
        const bank = within(await screen.findByRole("group", { name: fr.exercises.wordOrder.bank }));
        const tokens = right ? ex.tokensVi : [...ex.tokensVi].reverse();
        for (const token of tokens) await userEvent.click(bank.getByRole("button", { name: token }));
        await verify();
        break;
      }
      case "speak":
        stt.queue = [[right ? ex.vi : "không"]];
        await userEvent.click(await screen.findByRole("button", { name: /parler/i }));
        break;
    }
  }
}

function setupFight(stt: boolean) {
  useAppState.setState({ settings: withCapabilities(stt) });
  markAttempt("pending", ATTEMPT.attemptId);
  const recognizer = new FakeSpeechRecognizer();
  const services = createFakeServices({ stt: recognizer });
  const finishExam = vi.spyOn(services.activity, "finishExam");
  const submit = vi.spyOn(services.exam, "submitAttempt");
  const deck = buildDeck(examPoolFixture, bossFixture, seedFromString(ATTEMPT.attemptId), stt);
  renderExam({ services, entry: { pathname: "/exam/run", state: ATTEMPT } });
  return { recognizer, finishExam, submit, deck };
}

test("15 right answers beat Thủy Tinh with 5 lives: score 100, one saved finish, the certificate", async () => {
  const { recognizer, finishExam, submit, deck } = setupFight(true);
  expect(await screen.findByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeInTheDocument();
  await fight(deck, 99, recognizer);
  expect(await screen.findByRole("heading", { name: fr.exam.result.won("Thủy Tinh") }, { timeout: 8000 })).toBeInTheDocument();
  expect(finishExam).toHaveBeenCalledTimes(1);
  expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 100, noSpeaking: false, boss: { bossId: "boss_thuy_tinh", won: true, livesLeft: 5, bossHpLeft: 0 } });
  expect(submit).toHaveBeenCalledWith(ATTEMPT.attemptId, 100);
}, TEST_TIMEOUT);

test("five mistakes in a row lose the fight with the damage dealt so far", async () => {
  const { recognizer, finishExam, deck } = setupFight(false);
  await fight(deck, 3, recognizer); // 3 hits, then wrong until 0 lives
  expect(await screen.findByRole("heading", { name: fr.exam.result.lost("Thủy Tinh") }, { timeout: 8000 })).toBeInTheDocument();
  expect(finishExam).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId, score: 12, noSpeaking: true, boss: { bossId: "boss_thuy_tinh", won: false, livesLeft: 0, bossHpLeft: 12 } });
}, TEST_TIMEOUT);
```

(Imports: `buildDeck` from `@/services/bossFight`, `bossFixture` from `@/adapters/fakes/seed/tree`; drop `drawExam`/`EXAM_TOTAL`. Keep the reload/quit/redirect run tests; replace any `fr.exam.intro.title` heading with `"Thủy Tinh"`.)

- [ ] **Step 3: Run** the exam + activity tests — expected FAIL.

- [ ] **Step 4: Texts** (`fr.exam.run`): `bossHp: (name: string, hp: number, max: number) => \`PV de ${name} : ${hp} sur ${max}\``, `hit: "Touché !"`, `miss: "Aïe !"`; `fr.exam.result.won: (name: string) => \`${name} est vaincu !\``, `lost: (name: string) => \`${name} a gagné cette fois\``, `damage: (dealt: number, hp: number) => \`Tu lui as infligé ${dealt} dégâts sur ${hp}\``, `livesLeft: (n: number, max: number) => \`${n} vie${n > 1 ? "s" : ""} sur ${max} gardée${n > 1 ? "s" : ""}\``. Mention labels: `fr.exam.result.mention.bien = "Réussi"` and the certificate's `bien = "Réussi"` (spec §3.3).

- [ ] **Step 5: Implement `activity.finishExam`** — signature above; `commit(ev("exam_finished", "exam", examXpDelta(score, best), { score, attemptId, noSpeaking, ...(boss ?? {}) }), best === null)`.

- [ ] **Step 6: Implement the fight in `ExamRunScreen.tsx`** (keep `ExamRunScreen`'s attempt-mark guard and the quit dialog unchanged). The `ExamRun` body:
  - Load `Promise.all([content.getExamPool(), content.getVocabIndex(), content.getBoss(FINAL_BOSS_ID)])`; on success `deck = buildDeck(pool, boss, seedFromString(run.attemptId), hasStt.current)` and state `fight = startFight(boss)`; on failure the existing `loadError` empty state.
  - Current question: `deck[fight.answers.length]`. Remove the section interstitial, the timer and `formatElapsed`.
  - `onResult(r)`: guard one result per question index (`handled` ref as today); `let next = answer(fight, question.id, r.correct && !r.skipped)`; record the outcome `{ score: r.skipped ? 0 : r.score, correct: r.correct, skipped: !!r.skipped, expected: r.expected }`; if `next.status === "fighting" && next.answers.length >= deck.length` then `next = outOfQuestions(next)`; `setFight(next)`; if `next.status !== "fighting"` call `finish(next)` after `duration.slow * 1000` ms (lets the last hit/heart animation play).
  - `finish(f)`: `score = fightScore(f, boss)`; `noSpeaking = !deck.some((q) => q.section === "speaking")`; `exam.submitAttempt(run.attemptId, score).catch(() => undefined)`; `activity.finishExam({ attemptId, score, noSpeaking, boss: { bossId: boss.id, won: f.status === "won", livesLeft: f.lives, bossHpLeft: f.bossHp } })`; then navigate to `/exam/result` with `ResultState` `{ score, mention: bossMention(score), results, questions: deck.slice(0, f.answers.length), noSpeaking, xpGained, newBadges, remainingToday, dateIso: clock(), boss: { id, name, title, illustration, hp, playerLives, won, livesLeft: f.lives, bossHpLeft: f.bossHp } }`. Keep the existing saving/saveError handling.
  - Layout (hero = the boss and his HP): `<FocusHeader progress={(boss.hp - fight.bossHp) / boss.hp} onClose={…} closeLabel={fr.exam.run.quit.aria} right={<Hearts count={fight.lives} max={boss.playerLives} />} />`, then a row with `<BossPortrait boss={boss} size={88} hits={boss.hp - fight.bossHp} defeated={fight.status === "won"} />` and, beside it, `<p lang="vi" className="text-heading text-ink">{boss.name}</p>` and `<ProgressBar value={fight.bossHp / boss.hp} label={fr.exam.run.bossHp(boss.name, fight.bossHp, boss.hp)} />`, then the `ExerciseHost` (`mode="exam"`, `attempt={fight.answers.length}`) exactly as today.

- [ ] **Step 7: Trim `services/exam.ts`** to `EXAM_PASS` + `ExamMention`, delete `src/services/exam.test.ts`; fix the remaining imports (`MeScreen` uses `examMention` → replace with `bossMention` from `@/services/bossFight`).

- [ ] **Step 8: Run** `npm run verify` — expected green. **Commit**

```bash
git add src/features/exam src/services src/domain/types.ts src/i18n/fr.ts src/features/profile/MeScreen.tsx
git commit -m "feat(boss): fight Thuy Tinh with hit points and lives instead of a 30-question test"
```

---

### Task 7: Victory / defeat screen

**Files:**
- Modify: `src/features/exam/ExamResultScreen.tsx`, `src/features/exam/exam.test.tsx` (`describe("result")`, `describe("certificate on the result page")`)

**Interfaces:**
- Consumes: `ResultState.boss` (Task 6), `<BossPortrait>`, `<Hearts>`, existing `Certificate`, `Confetti`, `XpCounter`, `BadgeMedal`, `Corrections`.

- [ ] **Step 1: Failing tests** — the result `describe` builds its `ResultState` fixture; add the `boss` field to it (`{ id: "boss_thuy_tinh", name: "Thủy Tinh", title: "Le dieu des eaux", illustration: "boss_thuy_tinh", hp: 15, playerLives: 5, won, livesLeft, bossHpLeft }`) and adjust:

```tsx
test("a victory shows the defeated boss, the lives kept and the certificate", async () => {
  renderExam({ entry: { pathname: "/exam/result", state: result({ score: 92, won: true, livesLeft: 4, bossHpLeft: 0 }) } });
  expect(await screen.findByRole("heading", { name: fr.exam.result.won("Thủy Tinh") })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: fr.ui.hearts(4, 5) })).toBeInTheDocument();
  expect(screen.getByText(fr.exam.result.mention.excellent)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: fr.exam.result.download })).toBeInTheDocument();
});

test("a defeat shows the damage dealt, a retry and the review, no certificate", async () => {
  renderExam({ entry: { pathname: "/exam/result", state: result({ score: 36, won: false, livesLeft: 0, bossHpLeft: 6 }) } });
  expect(await screen.findByRole("heading", { name: fr.exam.result.lost("Thủy Tinh") })).toBeInTheDocument();
  expect(screen.getByText(fr.exam.result.damage(9, 15))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: fr.exam.result.retry(2) })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: fr.exam.result.download })).not.toBeInTheDocument();
});
```

(`result(...)` = a local helper returning the file's existing `ResultState` fixture with these fields merged; the « below 70 » / « above 70 » tests become these two; keep the correction-list, no-attempts-left, print/portal and no-pseudo tests, giving them a `boss` field.)

- [ ] **Step 2: Run** the result tests — expected FAIL.

- [ ] **Step 3: Implement.** `isResultState` already checks `boss` (Task 6). Header: `<BossPortrait boss={…from state.boss} size={160} hits={0} defeated={state.boss.won} />`, then `<h1 className="text-title text-ink">` with `won(name)` / `lost(name)`. Victory: `<Hearts count={livesLeft} max={playerLives} />` + `fr.exam.result.livesLeft(...)` caption, the mention (`fr.exam.result.mention[state.mention]`, `text-heading text-gold-ink`), XP, new badges, `<Confetti fire />`, the certificate block (unchanged, built from `state.score` / `state.mention`). Defeat: `fr.exam.result.damage(hp - bossHpLeft, hp)` and the existing retry/review buttons. Remove `CountUp` and the per-section bars; keep `Corrections` and the home button.

- [ ] **Step 4: Run** `npm run verify` — expected green. **Commit**

```bash
git add src/features/exam
git commit -m "feat(boss): show the boss defeated or victorious on the result screen"
```

---

### Task 8: Boss on the path, profiles, badges, e2e

**Files:**
- Modify: `src/features/home/pathLayout.ts`, `src/features/home/PathStop.tsx`, `src/features/home/HomeScreen.tsx`, `src/features/home/home.test.tsx`, `src/features/profile/MeScreen.tsx`, `src/features/leaderboard/PublicProfileScreen.tsx`, their tests, `src/content/badges.json`, `src/i18n/fr.ts`, `e2e/exam-locked.spec.ts`
- Create: `src/features/home/bossArt.ts` (features cannot import each other: same 4-line map as `features/exam/bossArt.ts`), `e2e/boss.spec.ts`

**Interfaces:**
- Consumes: `getBoss`, `FINAL_BOSS_ID`, `livesFromScore`, `bossMention`.
- Produces: the `exam` path node gains `boss: { name: string; illustration: string }`; `buildPathLayout(lessons, snapshot, tree, boss: Pick<Boss, "name" | "illustration">)`.

- [ ] **Step 1: Failing tests.** `pathLayout.test.ts`: pass `{ name: "Thủy Tinh", illustration: "boss_thuy_tinh" }` as the 4th argument of every `buildPathLayout` call and assert the exam node carries it (`expect(node).toMatchObject({ kind: "exam", boss: { name: "Thủy Tinh" } })`). `home.test.tsx`: the locked stop is now `screen.getByRole("button", { name: /Thủy Tinh.*verrouillé/ })` (update the two existing lookups of `/Bài kiểm tra/`). `MeScreen` test: with `examBest: 92` the stats show `fr.profile.stats.bossWon("Thủy Tinh", 4, 5)`; with `examBest: 36`, `fr.profile.stats.examNone`. Public profile test: same with `fr.publicProfile.bossWon("Thủy Tinh", 4, 5)`.

- [ ] **Step 2: Run** those tests — expected FAIL.

- [ ] **Step 3: Texts.** `fr.home.exam`: `aria: (name: string, locked: boolean) => \`${name}, boss final${locked ? ", verrouillé" : ""}\``, `kicker: "Boss final"`, `lockedToast: "Termine d'abord les leçons pour affronter Thủy Tinh"`; `fr.profile.stats.exam = "Boss final"`, `bossWon: (name: string, lives: number, max: number) => \`${name} vaincu ✓ (${lives}/${max} ❤️)\``, `examNone = "Pas encore vaincu"`; `fr.publicProfile.examTitle = "Boss final"`, `bossWon` (same signature), `examNone = "Pas encore vaincu"`. `badges.json`: `exam_passed` → `"title": "Vainqueur de Thủy Tinh", "description": "Bats le boss final."`; `exam_excellent` → `"description": "Bats le boss final en gardant au moins 4 vies."` (ids and rules unchanged).

- [ ] **Step 4: Implement.**
  - `HomeScreen` also loads `content.getBoss(FINAL_BOSS_ID)` and passes `{ name, illustration }` to `buildPathLayout`; `pathLayout.ts` copies it onto the `exam` node.
  - `PathStop` exam visual: the circle shows the boss art on the paper medallion (`<img src={bossArtUrl(node.boss.illustration)} …>` inside `bg-paper border-2 border-gold`, grayscale-free; locked = `opacity-60` + small lock badge), title `node.boss.name` (`lang="vi"`), sub `fr.home.exam.kicker` or the locked hint, aria `fr.home.exam.aria(node.boss.name, node.locked)`.
  - `MeScreen` / `PublicProfileScreen`: load the boss (`content.getBoss(FINAL_BOSS_ID)`, falls back to `fr.profile.stats.exam` text while loading); show `bossWon(name, lives, max)` when `livesFromScore(examBest, boss.playerLives)` is a number, else `examNone`. Certificate mention in `MeScreen` from `bossMention`.
  - `e2e/exam-locked.spec.ts`: update text lookups to the boss wording.
  - `e2e/boss.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { fr } from "@/i18n/fr";
import { onboard } from "./helpers";

test("after the ten lessons, Thủy Tinh can be challenged: HP bar and five lives", async ({ page }) => {
  await onboard(page);
  // Mark the ten lessons as done straight in the local event log (blind answers cannot pass a lesson reliably).
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("tieng-nha");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("events", "readwrite");
    for (let i = 1; i <= 10; i++) {
      const id = `l${String(i).padStart(2, "0")}`;
      tx.objectStore("events").put({ clientId: crypto.randomUUID(), schemaVersion: 1, type: "lesson_completed", refId: id, xp: 10, payload: { mistakes: 1, durationMs: 1000, perfect: false }, createdAt: new Date(Date.now() - (11 - i) * 60000).toISOString() });
    }
    await new Promise((res) => { tx.oncomplete = res; });
  });
  await page.goto("/exam");
  await expect(page.getByRole("heading", { name: "Thủy Tinh" })).toBeVisible();
  await page.getByRole("button", { name: fr.exam.intro.start }).click();
  await expect(page.getByRole("progressbar", { name: fr.exam.run.bossHp("Thủy Tinh", 15, 15) })).toBeVisible();
  await expect(page.getByRole("img", { name: fr.ui.hearts(5, 5) })).toBeVisible();
});
```

- [ ] **Step 5: Run** `npm run verify` then `npm run test:e2e` — expected green (11 e2e tests). Check the path, the intro, the fight and both result screens at 375 px in light and dark mode (skill `vietlearn-design`, `references/review-checklist.md`).

- [ ] **Step 6: Commit**

```bash
git add src/features src/content/badges.json src/i18n/fr.ts e2e
git commit -m "feat(boss): show Thuy Tinh on the path, in profiles and badges, with an e2e check"
```

---

### Task 9: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-progression-boss-energy-design.md`, `docs/README.md`

- [ ] **Step 1:** In the spec header add « Étapes 1–2 (arbre, boss) **implémentées** le <date> — plan [`2026-10-14-tree-and-boss.md`](../plans/2026-10-14-tree-and-boss.md) ». In `docs/README.md`, add the plan row next to the V1 plan.
- [ ] **Step 2: Commit**

```bash
git add docs
git commit -m "docs: mark the skill tree and the boss as implemented"
```
