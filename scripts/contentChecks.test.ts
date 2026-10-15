import { checkContent, type ContentBundle } from "./contentChecks";
import type { Dialogue, Lesson } from "@/domain/types";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";
import { examPoolFixture } from "@/test/fixtures/examFixture";
import badges from "@/content/badges.json";

const ok = {
  lessons: [lessonFixture] as Lesson[],
  dialogues: [dialogueFixture] as Dialogue[],
  exam: { contentVersion: 1, questions: examPoolFixture },
  badges,
} satisfies ContentBundle;

test("valid bundle has no errors (non-strict)", () => {
  expect(checkContent(ok, { strict: false })).toEqual([]);
});

test("detects unknown vocabId in listen_choose", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[0] = { id: "x1", type: "listen_choose", vocabId: "v_nope", choices: ["v_nope", "v_ly", "v_da", "v_ca_phe"] };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/v_nope/);
});

test("detects listen_choose whose answer is not among choices", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[0] = { id: "x1", type: "listen_choose", vocabId: "v_ly", choices: ["v_da", "v_ca_phe", "v_tra_da", "v_sua"] };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/not among choices/);
});

test("detects tone mismatch", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[1] = { id: "x2", type: "tone_pick", syllable: "đá", answerTone: "huyen" };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/tone/);
});

test("detects NFD text", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.vocab[0]!.vi = "cà phê".normalize("NFD");
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/NFC/);
});

test("detects dialogue with dangling next", () => {
  const bad = structuredClone(ok);
  const t = bad.dialogues[0]!.turns[0]!;
  if (t.speaker === "npc") t.next = "t99";
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/t99/);
});

test("detects duplicate ids across lessons", () => {
  const bad = structuredClone(ok);
  bad.lessons.push({ ...structuredClone(lessonFixture), id: "l06" });
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/duplicate/i);
});

test("strict mode requires 10 lessons, 10 dialogues and exam quotas", () => {
  const errors = checkContent(ok, { strict: true }).join("\n");
  expect(errors).toMatch(/10 lessons/);
  expect(errors).toMatch(/10 dialogues/);
});

const lines = (errs: string[]) => errs.join(String.fromCharCode(10));

test("detects duplicate vocab id inside one lesson", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.vocab[1]!.id = bad.lessons[0]!.vocab[0]!.id;
  expect(lines(checkContent(bad, { strict: false }))).toMatch(/duplicate/i);
});

test("detects duplicate exam question id", () => {
  const bad = structuredClone(ok);
  bad.exam.questions[1]!.id = bad.exam.questions[0]!.id;
  expect(lines(checkContent(bad, { strict: false }))).toMatch(/duplicate/i);
});

test("detects duplicate turn id in a dialogue", () => {
  const bad = structuredClone(ok);
  bad.dialogues[0]!.turns[2]!.id = "t1";
  expect(lines(checkContent(bad, { strict: false }))).toMatch(/duplicate turn id t1/);
});

test("strict mode flags an exam section below its quota", () => {
  const bad = structuredClone(ok);
  bad.exam.questions = bad.exam.questions.filter((q) => q.section !== "tones");
  const errors = lines(checkContent(bad, { strict: true }));
  expect(errors).toMatch(/section tones needs >= 12, found 0/);
  expect(errors).toMatch(/expected >= 60 questions/);
});

test("the tree must reference existing nodes and be acyclic", () => {
  const tree = {
    contentVersion: 1,
    nodes: [
      { id: "a", kind: "boss", requires: ["b"], branch: "trunk" },
      { id: "b", kind: "boss", requires: ["a", "ghost"], branch: "trunk" },
    ],
  };
  const errors = checkContent({ ...ok, lessons: [], dialogues: [], tree }, { strict: false });
  expect(errors).toContain("tree: b requires unknown ghost");
  expect(errors.some((e) => e.startsWith("tree: cycle through"))).toBe(true);
});

const treeWithBoss = {
  contentVersion: 1,
  nodes: [
    { id: "l05", kind: "lesson", requires: [], branch: "trunk" },
    { id: "boss_a", kind: "boss", requires: ["l05"], branch: "trunk" },
  ],
};
const sheet = (id: string, hp = 15, playerLives = 5) => ({
  id, name: "Thủy Tinh", title: "Le dieu des eaux", legend: "x", illustration: "boss_a", hp, playerLives, pool: "exam",
});
const withBosses = (bosses: unknown[], tree: unknown = treeWithBoss) => ({
  ...ok,
  tree,
  bosses: { contentVersion: 1, bosses },
});

test("a boss sheet must match a boss node of the tree", () => {
  const errors = checkContent(withBosses([sheet("boss_a"), sheet("boss_b")]), { strict: false });
  expect(errors).toContain("bosses: boss_b is not a boss node of the tree");
  expect(errors).not.toContain("bosses: boss_a is not a boss node of the tree");
});

test("duplicate boss sheet ids are reported", () => {
  expect(checkContent(withBosses([sheet("boss_a"), sheet("boss_a")]), { strict: false }).join("\n")).toMatch(/duplicate id "boss_a"/);
});

test("strict mode requires a boss sheet for every boss node", () => {
  const withOther = withBosses([sheet("boss_b")]);
  expect(checkContent(withOther, { strict: true })).toContain("tree: boss node boss_a has no boss sheet");
});

test("strict mode flags a missing bosses file and still reports unsheeted boss nodes", () => {
  const errors = checkContent({ ...ok, tree: treeWithBoss }, { strict: true });
  expect(errors).toContain("bosses: missing");
  expect(errors).toContain("tree: boss node boss_a has no boss sheet");
  expect(checkContent({ ...ok, tree: treeWithBoss }, { strict: false })).not.toContain("bosses: missing");
});

test("strict mode checks the exam pool is large enough for the boss", () => {
  const small = { ...withBosses([sheet("boss_a")]), exam: { contentVersion: 1, questions: examPoolFixture.slice(0, 10) } };
  expect(checkContent(small, { strict: true })).toContain("bosses: boss_a needs 19 questions, the exam pool has 10");
});

const shopOk = { contentVersion: 1, items: [{ id: "frame_a", kind: "cosmetic", slot: "frame", price: 10 }, { id: "boost", kind: "consumable", slot: null, price: 5 }] };

test("a valid shop has no errors and strict mode flags a missing shop", () => {
  expect(checkContent({ ...ok, shop: shopOk }, { strict: false })).toEqual([]);
  expect(checkContent(ok, { strict: true })).toContain("shop: missing");
  expect(checkContent(ok, { strict: false })).not.toContain("shop: missing");
});

test("shop ids are unique", () => {
  const dup = { contentVersion: 1, items: [shopOk.items[0], shopOk.items[0]] };
  expect(checkContent({ ...ok, shop: dup }, { strict: false }).join("\n")).toMatch(/duplicate id "frame_a"/);
});

test("cosmetics need a slot and consumables must not have one", () => {
  const bad = {
    contentVersion: 1,
    items: [{ id: "frame_x", kind: "cosmetic", slot: null, price: 10 }, { id: "boost", kind: "consumable", slot: "frame", price: 5 }],
  };
  const errors = checkContent({ ...ok, shop: bad }, { strict: false });
  expect(errors).toContain("shop: frame_x slot mismatch");
  expect(errors).toContain("shop: boost slot mismatch");
});
