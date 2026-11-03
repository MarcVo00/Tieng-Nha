import { LANGUAGES, LANGUAGE_IDS, languageOfId } from "@/domain/languages";

test("the language of a content id follows its prefix", () => {
  expect(languageOfId("tl_l01")).toBe("tl");
  expect(languageOfId("l01")).toBe("vi");
  expect(languageOfId("v_chao")).toBe("vi");
  expect(languageOfId("tl_v_salamat")).toBe("tl");
});

test("the picker order is Vietnamese then Tagalog", () => expect(LANGUAGE_IDS).toEqual(["vi", "tl"]));

test("every registry entry carries its own id and a prefix matching languageOfId", () => {
  for (const id of LANGUAGE_IDS) {
    expect(LANGUAGES[id].id).toBe(id);
    expect(languageOfId(`${LANGUAGES[id].idPrefix}l01`)).toBe(id);
  }
});

test("Tagalog has its own final boss, two voices and four exercise types; Vietnamese keeps its boss", () => {
  expect(LANGUAGES.tl).toMatchObject({ finalBossId: "tl_boss_bakunawa", packVoices: ["tl-f", "tl-m"], speechLang: "fil-PH", htmlLang: "tl", idPrefix: "tl_" });
  expect(LANGUAGES.tl.exerciseTypes).toEqual(["listen_choose", "translate_choose", "word_order", "speak"]);
  expect(LANGUAGES.vi).toMatchObject({ finalBossId: "boss_thuy_tinh", speechLang: "vi-VN", idPrefix: "" });
  expect(LANGUAGES.vi.exerciseTypes).toHaveLength(5);
  expect(LANGUAGES.vi.packVoices[0]).toBe("south-f");
});
