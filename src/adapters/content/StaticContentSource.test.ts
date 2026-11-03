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
  expect((await src.getBadges()).length).toBe(33);
});
test("createStaticContentSource lists real lessons in order and loads the real exam pool", async () => {
  const real = createStaticContentSource("vi");
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
  expect((await real.getBadges()).length).toBe(33);
});

test("the real shop catalogue matches the fakes fixture", async () => {
  expect(await createStaticContentSource("vi").getShop()).toEqual(shopFixture);
});

describe("one content source per language", () => {
  const vi = createStaticContentSource("vi");
  const tl = createStaticContentSource("tl");

  test("vi lists the ten Vietnamese lessons in order", async () => {
    expect((await vi.listLessons()).map((l) => l.id)).toEqual(["l01", "l02", "l03", "l04", "l05", "l06", "l07", "l08", "l09", "l10"]);
  });
  test("tl lists only tl_ lessons and dialogues", async () => {
    const ids = (await tl.listLessons()).map((l) => l.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("tl_"))).toBe(true);
    expect((await tl.getDialogue("tl_d01")).id).toBe("tl_d01");
    await expect(vi.getDialogue("tl_d01")).rejects.toBeInstanceOf(ContentNotFoundError);
  });
  test("each vocab index holds only its own language", async () => {
    const viKeys = [...(await vi.getVocabIndex()).keys()];
    const tlKeys = [...(await tl.getVocabIndex()).keys()];
    expect(viKeys.length).toBeGreaterThan(0);
    expect(tlKeys.length).toBeGreaterThan(0);
    expect(viKeys.some((k) => k.startsWith("tl_"))).toBe(false);
    expect(tlKeys.every((k) => k.startsWith("tl_"))).toBe(true);
  });
  test("tree, exam and bosses are per language", async () => {
    expect((await tl.getTree()).nodes.map((n) => n.id)).toEqual(["tl_l01", "tl_l02", "tl_l03", "tl_l04", "tl_l05", "tl_l06", "tl_l07", "tl_l08", "tl_boss_bakunawa"]);
    const pool = await tl.getExamPool();
    expect(pool.length).toBeGreaterThanOrEqual(19); // 15 hp + 5 lives - 1
    expect(pool.every((q) => q.id.startsWith("tl_exam_q") && q.exercise.id.startsWith("tl_exam_e"))).toBe(true);
    expect((await vi.getTree()).nodes.some((n) => n.id === "boss_thuy_tinh")).toBe(true);
  });
  test("badges, shop and changelog are shared", async () => {
    expect(await tl.getBadges()).toEqual(await vi.getBadges());
    expect(await tl.getShop()).toEqual(await vi.getShop());
    expect(await tl.getChangelog()).toEqual(await vi.getChangelog());
  });
  test("the Vietnamese boss is unknown to the Tagalog source", async () => {
    await expect(vi.getBoss("boss_thuy_tinh")).resolves.toMatchObject({ id: "boss_thuy_tinh" });
    await expect(tl.getBoss("boss_thuy_tinh")).rejects.toBeInstanceOf(ContentNotFoundError);
    await expect(tl.getBoss("tl_boss_bakunawa")).resolves.toMatchObject({ name: "Bakunawa", hp: 15, playerLives: 5 });
    await expect(vi.getBoss("tl_boss_bakunawa")).rejects.toBeInstanceOf(ContentNotFoundError);
  });
});
