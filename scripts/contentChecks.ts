import {
  BadgesFileSchema, DialogueSchema, ExamPoolSchema, LessonSchema,
} from "../src/content/schema";
import { toneOfSyllable } from "../src/domain/tones";
import type { Dialogue, Exercise, Lesson } from "../src/domain/types";

export type ContentBundle = { lessons: unknown[]; dialogues: unknown[]; exam: unknown; badges: unknown };

const EXAM_MIN = { total: 60, listening: 20, translation: 16, tones: 12, speaking: 12 } as const;

export function checkContent(input: ContentBundle, opts: { strict: boolean }): string[] {
  const errors: string[] = [];
  const lessons: Lesson[] = [];
  const dialogues: Dialogue[] = [];

  input.lessons.forEach((raw, i) => {
    const r = LessonSchema.safeParse(raw);
    if (r.success) lessons.push(r.data);
    else errors.push(`lesson[${i}]: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  input.dialogues.forEach((raw, i) => {
    const r = DialogueSchema.safeParse(raw);
    if (r.success) dialogues.push(r.data);
    else errors.push(`dialogue[${i}]: ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  const exam = ExamPoolSchema.safeParse(input.exam);
  if (!exam.success) errors.push(`exam: ${exam.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  const badges = BadgesFileSchema.safeParse(input.badges);
  if (!badges.success) errors.push(`badges: ${badges.error.message}`);

  // Unique ids
  const seen = new Map<string, string>();
  const claim = (id: string, where: string) => {
    const prev = seen.get(id);
    if (prev !== undefined) errors.push(`duplicate id "${id}" in ${where} (already in ${prev})`);
    else seen.set(id, where);
  };
  for (const l of lessons) {
    claim(l.id, l.id);
    l.vocab.forEach((v) => claim(v.id, `${l.id}.vocab`));
    l.exercises.forEach((e) => claim(e.id, `${l.id}.exercises`));
  }
  dialogues.forEach((d) => claim(d.id, d.id));
  if (exam.success) {
    for (const q of exam.data.questions) {
      claim(q.id, "exam.questions");
      claim(q.exercise.id, `exam.${q.id}.exercise`);
    }
  }

  const vocabIds = new Set(lessons.flatMap((l) => l.vocab.map((v) => v.id)));
  const checkExercise = (e: Exercise, where: string) => {
    switch (e.type) {
      case "listen_choose":
        for (const id of e.choices) if (!vocabIds.has(id)) errors.push(`${where}: unknown vocabId ${id}`);
        if (!vocabIds.has(e.vocabId)) errors.push(`${where}: unknown vocabId ${e.vocabId}`);
        if (!e.choices.includes(e.vocabId)) errors.push(`${where}: answer ${e.vocabId} not among choices`);
        if (new Set(e.choices).size !== e.choices.length) errors.push(`${where}: duplicate choices`);
        break;
      case "translate_choose":
        if (e.distractorsVi.includes(e.answerVi)) errors.push(`${where}: answer duplicated in distractors`);
        break;
      case "tone_pick":
        if (toneOfSyllable(e.syllable) !== e.answerTone)
          errors.push(`${where}: tone mismatch, "${e.syllable}" is ${toneOfSyllable(e.syllable)} not ${e.answerTone}`);
        if (e.syllable.trim().includes(" ")) errors.push(`${where}: tone_pick syllable must be a single syllable`);
        break;
      case "word_order":
        break;
      case "speak":
        for (const id of e.vocabIds) if (!vocabIds.has(id)) errors.push(`${where}: unknown vocabId ${id}`);
        if (e.vi.split(/\s+/).length > 8) errors.push(`${where}: speak sentence longer than 8 syllables`);
        break;
    }
  };
  for (const l of lessons) l.exercises.forEach((e) => checkExercise(e, `${l.id}/${e.id}`));
  if (exam.success) exam.data.questions.forEach((q) => checkExercise(q.exercise, `exam/${q.id}`));

  // NFC on every string (schema already checks Vietnamese fields; this catches notes/fr too)
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string" && v !== v.normalize("NFC")) errors.push(`${path}: text is not NFC`);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
  };
  walk(input, "content");

  // Dialogue graph: every next exists, starts with npc, at least one terminal, no cycles
  for (const d of dialogues) {
    const ids = new Set<string>();
    for (const t of d.turns) {
      if (ids.has(t.id)) errors.push(`${d.id}: duplicate turn id ${t.id}`);
      ids.add(t.id);
      if (t.speaker === "user") {
        const optIds = new Set<string>();
        for (const o of t.options) {
          if (optIds.has(o.id)) errors.push(`${d.id}/${t.id}: duplicate option id ${o.id}`);
          optIds.add(o.id);
        }
      }
    }
    const edges = new Map<string, string[]>();
    for (const t of d.turns) {
      const nexts = t.speaker === "npc" ? [t.next] : t.options.map((o) => o.next);
      edges.set(t.id, nexts.filter((n): n is string => n !== null));
      for (const n of nexts) if (n !== null && !ids.has(n)) errors.push(`${d.id}/${t.id}: next ${n} does not exist`);
    }
    if (d.turns[0]?.speaker !== "npc") errors.push(`${d.id}: must start with an npc turn`);
    const visiting = new Set<string>();
    const done = new Set<string>();
    const dfs = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (done.has(id)) return false;
      visiting.add(id);
      const cyclic = (edges.get(id) ?? []).some(dfs);
      visiting.delete(id);
      done.add(id);
      return cyclic;
    };
    if (d.turns[0] && dfs(d.turns[0].id)) errors.push(`${d.id}: dialogue graph has a cycle`);
  }

  // Lesson → dialogue references
  const dialogueIds = new Set(dialogues.map((d) => d.id));
  if (opts.strict) for (const l of lessons) if (!dialogueIds.has(l.dialogueId)) errors.push(`${l.id}: dialogue ${l.dialogueId} missing`);

  if (opts.strict) {
    if (lessons.length !== 10) errors.push(`expected 10 lessons, found ${lessons.length}`);
    if (dialogues.length !== 10) errors.push(`expected 10 dialogues, found ${dialogues.length}`);
    if (exam.success) {
      const qs = exam.data.questions;
      if (qs.length < EXAM_MIN.total) errors.push(`exam: expected >= ${EXAM_MIN.total} questions, found ${qs.length}`);
      for (const s of ["listening", "translation", "tones", "speaking"] as const) {
        const n = qs.filter((q) => q.section === s).length;
        if (n < EXAM_MIN[s]) errors.push(`exam: section ${s} needs >= ${EXAM_MIN[s]}, found ${n}`);
      }
    }
  }
  return errors;
}
