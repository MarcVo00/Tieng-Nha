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
  /** The boss closing the language's path, `null` when it has none. */
  finalBossId: string | null;
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
    finalBossId: "boss_thuy_tinh",
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
    finalBossId: "tl_boss_bakunawa",
    packVoices: ["tl-f", "tl-m"],
  },
};

/** The language a content id (lesson, dialogue, vocab…) belongs to: `tl_` ids are Tagalog, the rest Vietnamese. */
export const languageOfId = (id: string): LanguageId => (id.startsWith("tl_") ? "tl" : "vi");

/** `ref_id` of a language's `exam_finished` events: `exam` (Vietnamese, as before 2.1) or `tl_exam`. */
export const examRefId = (language: LanguageId): string => `${LANGUAGES[language].idPrefix}exam`;
