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
