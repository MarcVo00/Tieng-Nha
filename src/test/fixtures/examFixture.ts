import type { ExamQuestion, Exercise, ExamSection } from "@/domain/types";
import { lessonFixture } from "@/test/fixtures/lessonFixture";

const bySection: Record<ExamSection, Exercise["type"][]> = {
  listening: ["listen_choose"], translation: ["translate_choose", "word_order"], tones: ["tone_pick"], speaking: ["speak"],
};
const counts: Record<ExamSection, number> = { listening: 20, translation: 16, tones: 12, speaking: 12 };

/** 60-question pool built by cloning fixture exercises with unique ids. */
export const examPoolFixture: ExamQuestion[] = (Object.keys(counts) as ExamSection[]).flatMap((section) => {
  const templates = lessonFixture.exercises.filter((e) => bySection[section].includes(e.type));
  return Array.from({ length: counts[section] }, (_, i) => {
    const tpl = templates[i % templates.length]!;
    return { section, exercise: { ...tpl, id: `${section}_${i}` }, id: "" } as ExamQuestion;
  });
}).map((q, i) => ({ ...q, id: `exam_q${String(i + 1).padStart(3, "0")}` }));
