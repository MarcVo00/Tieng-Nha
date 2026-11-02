/* global console, process */
// Collects every Vietnamese and Tagalog string the app may speak into scripts/tts/texts.json.
// Run from the repo root: node scripts/tts/extract_texts.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Must stay identical to normalizeSpeechText in src/services/speechKey.ts and generate_audio.py. */
const normalizeSpeechText = (s) => s.normalize("NFC").trim();

// Spoken by the app outside the lesson content (settings voice preview, device test), per language.
const EXTRA_TEXTS = { vi: ["Chào bạn!"], tl: ["Kumusta!"] };
const LANGUAGES = ["vi", "tl"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));

/** Sorted unique list of every string the app may speak in one language, read from `<contentDir>/<language>/{lessons,dialogues,exam.json}`. */
function extractLanguage(contentDir, language) {
  const dir = join(contentDir, language);
  const texts = new Set(EXTRA_TEXTS[language].map(normalizeSpeechText));
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

  for (const file of jsonFiles(join(dir, "lessons"))) {
    const lesson = readJson(file);
    for (const v of lesson.vocab ?? []) add(v.vi);
    for (const ex of lesson.exercises ?? []) addExercise(ex);
  }

  for (const file of jsonFiles(join(dir, "dialogues"))) {
    for (const turn of readJson(file).turns ?? []) {
      if (turn.speaker === "npc") add(turn.vi);
      for (const option of turn.options ?? []) add(option.vi);
    }
  }

  for (const q of readJson(join(dir, "exam.json")).questions ?? []) addExercise(q.exercise);

  return [...texts].sort();
}

/** Every string the app may speak, per language: `{ vi: string[], tl: string[] }`. */
export function extractTexts(contentDir = join(root, "src", "content")) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, extractLanguage(contentDir, language)]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const texts = extractTexts();
  writeFileSync(join(root, "scripts", "tts", "texts.json"), `${JSON.stringify(texts, null, 2)}\n`, "utf8");
  console.log(`${texts.vi.length} vi + ${texts.tl.length} tl texts -> scripts/tts/texts.json`);
}
