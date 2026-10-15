import { StaticContentSource, createStaticContentSource } from "@/adapters/content";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";
import { examPoolFixture } from "@/test/fixtures/examFixture";
import badges from "@/content/badges.json";
import { shopFixture } from "@/adapters/fakes/seed/shop";
import { treeFixture, bossFixture } from "@/adapters/fakes/seed/tree";
import { ContentNotFoundError } from "@/domain/errors";

const l01 = { ...structuredClone(lessonFixture), id: "l01", dialogueId: "d01" };
const src = new StaticContentSource({
  lessons: { "/src/content/lessons/l05.json": async () => lessonFixture, "/src/content/lessons/l01.json": async () => l01 },
  dialogues: { "/src/content/dialogues/d05.json": async () => dialogueFixture },
  exam: async () => ({ contentVersion: 1, questions: examPoolFixture }),
  badges: async () => badges,
  tree: async () => treeFixture,
  bosses: async () => ({ contentVersion: 1, bosses: [bossFixture] }),
  shop: async () => ({ contentVersion: 1, items: shopFixture }),
});

test("lists lessons ordered by id with order numbers", async () => {
  expect((await src.listLessons()).map((l) => [l.id, l.order])).toEqual([["l01", 1], ["l05", 2]]);
});
test("gets a lesson by id and validates it", async () => expect((await src.getLesson("l05")).title).toBe("Au café"));
test("unknown ids throw ContentNotFoundError", async () => {
  await expect(src.getLesson("l99")).rejects.toBeInstanceOf(ContentNotFoundError);
  await expect(src.getDialogue("d99")).rejects.toBeInstanceOf(ContentNotFoundError);
});
test("vocab index spans all lessons", async () => expect((await src.getVocabIndex()).get("v_ly")?.vi).toBe("ly"));
test("exam pool and badges", async () => {
  expect(await src.getExamPool()).toHaveLength(60);
  expect((await src.getBadges()).length).toBe(12);
});
test("createStaticContentSource lists real lessons in order and loads the real exam pool", async () => {
  const real = createStaticContentSource();
  const lessons = await real.listLessons();
  expect(lessons.length).toBeGreaterThan(0);
  expect(lessons.map((l) => l.order)).toEqual(lessons.map((_, i) => i + 1));
  expect(lessons.map((l) => l.id)).toEqual([...lessons.map((l) => l.id)].sort());
  for (const l of lessons) expect((await real.getLesson(l.id)).id).toBe(l.id);
  const pool = await real.getExamPool();
  const count = (section: string) => pool.filter((q) => q.section === section).length;
  expect(pool.length).toBeGreaterThanOrEqual(60);
  expect(count("listening")).toBeGreaterThanOrEqual(20);
  expect(count("translation")).toBeGreaterThanOrEqual(16);
  expect(count("tones")).toBeGreaterThanOrEqual(12);
  expect(count("speaking")).toBeGreaterThanOrEqual(12);
  expect((await real.getBadges()).length).toBe(12);
});

test("the real shop catalogue matches the fakes fixture", async () => {
  expect(await createStaticContentSource().getShop()).toEqual(shopFixture);
});
