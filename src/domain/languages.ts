import type { Exercise } from "@/domain/types";

/** The languages the app teaches. Everything language-specific hangs off this registry. */
export type LanguageId = "vi" | "tl";
/** Order shown in the language picker. */
export const LANGUAGE_IDS: readonly LanguageId[] = ["vi", "tl"];

export type Language = {
  id: LanguageId;
  nameFr: string;
  nameNative: string;
  purposeFr: string;
  /** Value of the `lang` attribute on target-language text. */
  htmlLang: "vi" | "tl";
  /** BCP 47 tag handed to speech synthesis and recognition. */
  speechLang: "vi-VN" | "fil-PH";
  /** Prefix of every content id of this language (`""` for Vietnamese, whose ids never changed). */
  idPrefix: "" | "tl_";
  exerciseTypes: readonly Exercise["type"][];
  /** The boss closing each level of the language's path, level 1 first; beating one opens the next level. */
  bossIds: readonly string[];
  /** Voice packs of the language, the first one being the default. */
  packVoices: readonly string[];
};

export const LANGUAGES: Readonly<Record<LanguageId, Language>> = {
  vi: {
    id: "vi",
    nameFr: "Vietnamien",
    nameNative: "Tiếng Việt",
    purposeFr: "Le parler du Sud",
    htmlLang: "vi",
    speechLang: "vi-VN",
    idPrefix: "",
    exerciseTypes: ["listen_choose", "translate_choose", "tone_pick", "word_order", "speak"],
    bossIds: ["boss_thuy_tinh", "boss_son_tinh"],
    packVoices: ["south-f", "south-m", "north-f", "north-m"],
  },
  tl: {
    id: "tl",
    nameFr: "Tagalog",
    nameNative: "Wikang Tagalog",
    purposeFr: "Pour voyager aux Philippines",
    htmlLang: "tl",
    speechLang: "fil-PH",
    idPrefix: "tl_",
    exerciseTypes: ["listen_choose", "translate_choose", "word_order", "speak"],
    bossIds: ["tl_boss_bakunawa", "tl_boss_tikbalang"],
    packVoices: ["tl-f", "tl-m"],
  },
};

/** The language a content id (lesson, dialogue, vocab…) belongs to: `tl_` ids are Tagalog, the rest Vietnamese. */
export const languageOfId = (id: string): LanguageId => (id.startsWith("tl_") ? "tl" : "vi");

/** The level a boss closes (1 for the first boss of its language; also 1 for an unknown id). */
export const bossLevel = (bossId: string): number => Math.max(1, LANGUAGES[languageOfId(bossId)].bossIds.indexOf(bossId) + 1);

/** `ref_id` of a boss's `exam_finished` events: `exam` / `tl_exam` for level 1 (as before 2.3), the boss id above it. */
export const bossRefId = (bossId: string): string => (bossLevel(bossId) === 1 ? `${LANGUAGES[languageOfId(bossId)].idPrefix}exam` : bossId);

/** The screen of a boss: `/exam` for level 1 of the active language, its own path above it. */
export const examPath = (bossId: string): string => (bossLevel(bossId) === 1 ? "/exam" : `/exam/${bossId}`);
