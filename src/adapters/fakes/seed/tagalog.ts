import type { Boss, Dialogue, ExamQuestion, Lesson, Tree } from "@/domain/types";

const word = (id: string, text: string, fr: string, pron?: string) => ({ id: `tl_v_${id}`, vi: text, fr, dialect: "manila" as const, ...(pron ? { pron } : {}) });

const greetings = [
  word("kumusta", "kumusta", "comment vas-tu"), word("salamat", "salamat", "merci", "sa·LA·mat"), word("oo", "oo", "oui"), word("hindi", "hindi", "non"),
  word("po", "po", "marque de respect"), word("opo", "opo", "oui (poli)"), word("paalam", "paalam", "au revoir"), word("mabuti", "mabuti", "bien"),
  word("magandang_umaga", "magandang umaga", "bonjour (le matin)"), word("magandang_gabi", "magandang gabi", "bonsoir"),
  word("walang_anuman", "walang anuman", "de rien"), word("pasensya", "pasensya na", "désolé"),
];
const food = [
  word("kain", "kain", "manger"), word("tubig", "tubig", "eau"), word("kanin", "kanin", "riz"), word("isda", "isda", "poisson"),
  word("manok", "manok", "poulet"), word("gulay", "gulay", "légume"), word("prutas", "prutas", "fruit"), word("gatas", "gatas", "lait"),
  word("kape", "kape", "café"), word("tinapay", "tinapay", "pain"), word("masarap", "masarap", "délicieux"), word("gutom", "gutom", "faim"),
];

const exercises = (lessonId: string, ids: string[], quote: string, quoteFr: string, quotePron?: string): Lesson["exercises"] => {
  const id = (i: number): string => ids[i] ?? "";
    return [
    { id: `${lessonId}_e01`, type: "listen_choose", vocabId: id(0), choices: [id(0), id(1), id(2), id(3)] },
    { id: `${lessonId}_e02`, type: "listen_choose", vocabId: id(1), choices: [id(1), id(0), id(4), id(5)] },
    { id: `${lessonId}_e03`, type: "listen_choose", vocabId: id(2), choices: [id(2), id(3), id(6), id(7)] },
    { id: `${lessonId}_e04`, type: "translate_choose", promptFr: quoteFr, answerVi: quote, distractorsVi: ["Hindi po.", "Oo.", "Paalam."] },
    { id: `${lessonId}_e05`, type: "translate_choose", promptFr: "Non.", answerVi: "Hindi.", distractorsVi: ["Oo.", "Opo.", "Salamat."] },
    { id: `${lessonId}_e06`, type: "word_order", fr: quoteFr, tokensVi: quote.replace(/[.!]$/, "").split(" ") },
    { id: `${lessonId}_e07`, type: "speak", vi: quote, fr: quoteFr, vocabIds: [id(0)], ...(quotePron ? { pron: quotePron } : {}) },
  { id: `${lessonId}_e08`, type: "speak", vi: "Salamat po.", fr: "Merci (poliment).", vocabIds: [id(1)] },
  ];
};

const lesson = (n: number, title: string, emoji: string, vocab: Lesson["vocab"], quote: string, quoteFr: string, quotePron?: string): Lesson => {
  const id = `tl_l0${n}`;
  return {
    id, contentVersion: 1, title, description: `${title} (fixture).`, emoji, dialogueId: `tl_d0${n}`, vocab,
    exercises: exercises(id, vocab.map((v) => v.id), quote, quoteFr, quotePron),
  };
};

export const tagalogLessonFixtures: Lesson[] = [
  lesson(1, "Salamat at kumusta", "👋", greetings, "Salamat po.", "Merci (poliment).", "sa·LA·mat po"),
  lesson(2, "Kain tayo", "🍚", food, "Masarap po.", "C'est délicieux (poliment)."),
];

const dialogue = (n: number, title: string, npc: string, npcFr: string, answer: string, answerFr: string, pron?: { npc: string; answer: string }): Dialogue => ({
  id: `tl_d0${n}`, contentVersion: 1, title, scene: "Sa kalye",
  turns: [
    { id: "t1", speaker: "npc", vi: npc, fr: npcFr, next: "t2", ...(pron ? { pron: pron.npc } : {}) },
    { id: "t2", speaker: "user", options: [{ id: "o1", vi: answer, fr: answerFr, next: "t3", ...(pron ? { pron: pron.answer } : {}) }, { id: "o2", vi: "Hindi po.", fr: "Non (poliment).", next: "t3" }] },
    { id: "t3", speaker: "npc", vi: "Salamat!", fr: "Merci !", next: "t4" },
    { id: "t4", speaker: "user", options: [{ id: "o1", vi: "Paalam!", fr: "Au revoir !", next: null }, { id: "o2", vi: "Paalam po!", fr: "Au revoir (poliment) !", next: null }] },
  ],
});

export const tagalogDialogueFixtures: Dialogue[] = [
  dialogue(1, "Une rencontre", "Kumusta ka?", "Comment vas-tu ?", "Mabuti, salamat.", "Bien, merci.", { npc: "ku·MUS·ta ka", answer: "ma·BU·ti sa·LA·mat" }),
  dialogue(2, "À table", "Gutom ka na ba?", "As-tu déjà faim ?", "Oo, gutom na ako.", "Oui, j'ai faim."),
];

const SECTION = { listen_choose: "listening", translate_choose: "translation", word_order: "translation", speak: "speaking", tone_pick: "tones" } as const;

/** The lessons' exercises, cycled to 20 questions (a 15 + 5 boss needs 19), renumbered like src/content/tl/exam.json. */
export const tagalogExamFixture: ExamQuestion[] = Array.from({ length: 20 }, (_, i) => {
  const all = tagalogLessonFixtures.flatMap((l) => l.exercises);
  const exercise = all[i % all.length] ?? all[0];
  if (!exercise) throw new Error("no Tagalog exercise");
  const n = String(i + 1).padStart(3, "0");
  return { id: `tl_exam_q${n}`, section: SECTION[exercise.type], exercise: { ...exercise, id: `tl_exam_e${n}` } };
});

/** Two lessons in a row, then Bakunawa. */
export const tagalogTreeFixture: Tree = {
  contentVersion: 1,
  nodes: [
    { id: "tl_l01", kind: "lesson", requires: [], branch: "trunk" },
    { id: "tl_l02", kind: "lesson", requires: ["tl_l01"], branch: "trunk" },
    { id: "tl_boss_bakunawa", kind: "boss", requires: ["tl_l02"], branch: "trunk" },
  ],
};

export const tagalogBossFixtures: Boss[] = [
  {
    id: "tl_boss_bakunawa",
    name: "Bakunawa",
    title: "Le serpent qui avale la lune",
    legend: "Bakunawa sort des flots pour avaler la lune (fixture).",
    illustration: "tl_boss_bakunawa",
    hp: 15,
    playerLives: 5,
    pool: "exam",
  },
];
