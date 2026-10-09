import type { Lesson } from "@/domain/types";

const vocab = [
  ["v_ca_phe", "cà phê", "café"], ["v_ca_phe_sua_da", "cà phê sữa đá", "café au lait glacé"],
  ["v_ca_phe_den", "cà phê đen", "café noir"], ["v_tra_da", "trà đá", "thé glacé"], ["v_ly", "ly", "verre"],
  ["v_da", "đá", "glace"], ["v_duong", "đường", "sucre"], ["v_cho_tui", "cho tui", "donne-moi"],
  ["v_tinh_tien", "tính tiền", "l'addition"], ["v_ngon", "ngon", "bon"], ["v_nuoc", "nước", "eau"], ["v_sua", "sữa", "lait"],
] as const;

export const lessonFixture: Lesson = {
  id: "l05",
  contentVersion: 1,
  title: "Au café",
  description: "Commander un café glacé comme à Sài Gòn.",
  emoji: "☕",
  dialogueId: "d05",
  vocab: vocab.map(([id, vi, fr]) => ({ id, vi, fr, dialect: "south" as const })),
  exercises: [
    { id: "l05_e01", type: "listen_choose", vocabId: "v_ca_phe_sua_da", choices: ["v_ca_phe_sua_da", "v_ca_phe_den", "v_tra_da", "v_ly"] },
    { id: "l05_e02", type: "tone_pick", syllable: "đá", answerTone: "sac" },
    { id: "l05_e03", type: "translate_choose", promptFr: "Un café noir, s'il te plaît.", answerVi: "Cho tui một ly cà phê đen.", distractorsVi: ["Cho tui một ly trà đá.", "Cho tui một ly cà phê sữa đá.", "Tính tiền."] },
    { id: "l05_e04", type: "word_order", fr: "Un café au lait glacé pour moi.", tokensVi: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"], extraTokens: ["đen"] },
    { id: "l05_e05", type: "speak", vi: "Cho tui một ly trà đá.", fr: "Un thé glacé pour moi.", vocabIds: ["v_cho_tui", "v_ly", "v_tra_da"] },
    { id: "l05_e06", type: "listen_choose", vocabId: "v_tra_da", choices: ["v_tra_da", "v_ca_phe", "v_nuoc", "v_sua"] },
    { id: "l05_e07", type: "translate_choose", promptFr: "L'addition !", answerVi: "Tính tiền!", distractorsVi: ["Ngon quá!", "Cho tui nước.", "Cà phê đen."] },
    { id: "l05_e08", type: "speak", vi: "Ngon quá!", fr: "C'est trop bon !", vocabIds: ["v_ngon"] },
  ],
};
