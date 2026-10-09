import type { Exercise, VocabItem, VocabProgress } from "@/domain/types";
import { pickN, shuffle } from "@/services/random";

export const REVIEW_MAX = 20;
type Kind = "listen_choose" | "translate_choose" | "speak";

export function buildReviewSession(
  due: readonly VocabProgress[], pool: readonly VocabItem[], rng: () => number, opts: { hasStt: boolean; max?: number },
): Exercise[] {
  const live = pool.filter((v) => !v.deprecated);
  const byId = new Map(live.map((v) => [v.id, v]));
  const kinds: Kind[] = opts.hasStt ? ["listen_choose", "translate_choose", "speak"] : ["listen_choose", "translate_choose"];
  const out: Exercise[] = [];
  for (const [i, p] of [...due].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, opts.max ?? REVIEW_MAX).entries()) {
    const word = byId.get(p.vocabId);
    if (!word) continue;
    const others = live.filter((v) => v.id !== word.id && v.vi !== word.vi);
    if (others.length < 3) continue;
    const kind = kinds[Math.floor(rng() * kinds.length)] ?? "listen_choose";
    const id = `rev_${word.id}_${i}`;
    if (kind === "listen_choose") {
      out.push({ id, type: "listen_choose", vocabId: word.id, choices: shuffle([word.id, ...pickN(others, 3, rng).map((v) => v.id)], rng) });
    } else if (kind === "translate_choose") {
      out.push({ id, type: "translate_choose", promptFr: word.fr, answerVi: word.vi, distractorsVi: pickN(others, 3, rng).map((v) => v.vi) });
    } else {
      out.push({ id, type: "speak", vi: word.vi, fr: word.fr, vocabIds: [word.id] });
    }
  }
  return out;
}
