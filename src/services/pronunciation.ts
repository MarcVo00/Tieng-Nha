// grave, acute, tilde, hook above, dot below
const TONE_MARKS = /[\u0300\u0301\u0303\u0309\u0323]/g;
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"];

export const PASS_THRESHOLD = 0.7;
export type SyllableStatus = "ok" | "tone" | "wrong" | "missing" | "extra";
export type SyllableDiff = { expected: string | null; heard: string | null; status: SyllableStatus };
export type PronunciationResult = { score: number; diff: SyllableDiff[]; heard: string };

export function normalizeVi(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(spellDigits)
    .join(" ");
}

function spellDigits(w: string): string[] {
  if (!/^\d+$/.test(w)) return [w];
  if (w.length > 2) return [...w].map((c) => DIGITS[Number(c)] ?? c);
  return [Number(w) <= 10 ? (DIGITS[Number(w)] ?? w) : w];
}

export function stripTones(s: string): string {
  return s.normalize("NFD").replace(TONE_MARKS, "").normalize("NFC");
}

export function syllables(s: string): string[] {
  const n = normalizeVi(s);
  return n ? n.split(" ") : [];
}

function subCost(a: string, b: string): number {
  if (a === b) return 0;
  if (stripTones(a) === stripTones(b)) return 0.5;
  return 1;
}

function align(exp: readonly string[], got: readonly string[]): { cost: number; diff: SyllableDiff[] } {
  const n = exp.length;
  const m = got.length;
  const width = m + 1;
  const d = new Float64Array((n + 1) * width);
  const at = (i: number, j: number): number => d[i * width + j] ?? 0;
  const set = (i: number, j: number, v: number): void => {
    d[i * width + j] = v;
  };
  const expAt = (i: number): string => exp[i - 1] ?? "";
  const gotAt = (j: number): string => got[j - 1] ?? "";

  for (let i = 0; i <= n; i++) set(i, 0, i);
  for (let j = 0; j <= m; j++) set(0, j, j);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      set(i, j, Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + subCost(expAt(i), gotAt(j))));

  const diff: SyllableDiff[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + subCost(expAt(i), gotAt(j))) {
      const c = subCost(expAt(i), gotAt(j));
      diff.push({ expected: expAt(i), heard: gotAt(j), status: c === 0 ? "ok" : c === 0.5 ? "tone" : "wrong" });
      i--;
      j--;
    } else if (i > 0 && at(i, j) === at(i - 1, j) + 1) {
      diff.push({ expected: expAt(i), heard: null, status: "missing" });
      i--;
    } else {
      diff.push({ expected: null, heard: gotAt(j), status: "extra" });
      j--;
    }
  }
  return { cost: at(n, m), diff: diff.reverse() };
}

export function scorePronunciation(expected: string, heardAlternatives: readonly string[]): PronunciationResult {
  const exp = syllables(expected);
  let best: PronunciationResult = {
    score: 0,
    diff: exp.map((e) => ({ expected: e, heard: null, status: "missing" as const })),
    heard: "",
  };
  for (const alt of heardAlternatives) {
    const { cost, diff } = align(exp, syllables(alt));
    const score = exp.length === 0 ? 0 : Math.max(0, Math.min(1, 1 - cost / exp.length));
    if (score > best.score) best = { score: Math.round(score * 100) / 100, diff, heard: alt };
  }
  return best;
}
