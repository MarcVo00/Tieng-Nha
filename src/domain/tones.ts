export type Tone = "ngang" | "huyen" | "sac" | "hoi" | "nga" | "nang";
export const TONES: readonly Tone[] = ["ngang", "huyen", "sac", "hoi", "nga", "nang"];

// Unicode combining marks used for Vietnamese tones.
export const TONE_MARKS: Record<Tone, string> = {
  ngang: "",
  huyen: "̀", // grave
  sac: "́", // acute
  hoi: "̉", // hook above
  nga: "̃", // tilde
  nang: "̣", // dot below
};

/** Detects the tone by decomposing to NFD only to find the combining mark. */
export function toneOfSyllable(syllable: string): Tone {
  const decomposed = syllable.normalize("NFD");
  for (const tone of TONES) {
    const mark = TONE_MARKS[tone];
    if (mark && decomposed.includes(mark)) return tone;
  }
  return "ngang";
}
