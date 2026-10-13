/* global console */
// Collects every Vietnamese string the app may speak into scripts/tts/texts.json.
// Run from the repo root: node scripts/tts/extract_texts.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const content = join(root, "src", "content");

/** Must stay identical to normalizeSpeechText in src/services/speechKey.ts and generate_audio.py. */
const normalizeSpeechText = (s) => s.normalize("NFC").trim();

// Spoken by the app outside the lesson content (settings voice preview, device test).
const EXTRA_TEXTS = ["Xin chào bạn!", "Xin chào!"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));

const texts = new Set(EXTRA_TEXTS.map(normalizeSpeechText));
const add = (s) => {
  if (typeof s === "string" && normalizeSpeechText(s) !== "") texts.add(normalizeSpeechText(s));
};

function addExercise(ex) {
  add(ex.vi);
  add(ex.answerVi);
  for (const d of ex.distractorsVi ?? []) add(d);
  add(ex.syllable);
  if (Array.isArray(ex.tokensVi)) add(ex.tokensVi.join(" "));
}

for (const file of jsonFiles(join(content, "lessons"))) {
  const lesson = readJson(file);
  for (const v of lesson.vocab ?? []) add(v.vi);
  for (const ex of lesson.exercises ?? []) addExercise(ex);
}

for (const file of jsonFiles(join(content, "dialogues"))) {
  for (const turn of readJson(file).turns ?? []) {
    if (turn.speaker === "npc") add(turn.vi);
    for (const option of turn.options ?? []) add(option.vi);
  }
}

for (const q of readJson(join(content, "exam.json")).questions ?? []) addExercise(q.exercise);

const sorted = [...texts].sort();
writeFileSync(join(root, "scripts", "tts", "texts.json"), `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`${sorted.length} texts -> scripts/tts/texts.json`);
