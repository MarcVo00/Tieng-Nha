import { existsSync, readFileSync, statSync } from "node:fs";
import { AudioPackManifestSchema } from "@/adapters/speech";
import { speechKey } from "@/services/speechKey";
import { extractTexts } from "./extract_texts.mjs";

const repo = `${process.cwd()}/`; // vitest runs from the repository root
const audioDir = process.env.VOICE_PACK_DIR ?? `${repo}public/audio`; // override to check a pack generated elsewhere
const manifestPath = `${audioDir}/manifest.json`;
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

test("texts.json lists exactly the strings the content can speak (re-run extract_texts.mjs after a content change)", () => {
  expect(readJson(`${repo}scripts/tts/texts.json`)).toEqual(extractTexts());
});

// The pack is generated separately; before that there is nothing to check.
describe.skipIf(!existsSync(manifestPath))("generated voice pack", () => {
  const manifest = () => AudioPackManifestSchema.parse(readJson(manifestPath));

  test("manifest matches the adapter schema (version 2)", () => {
    expect(AudioPackManifestSchema.safeParse(readJson(manifestPath)).success).toBe(true);
  });

  test("every text has a key, and it is the one the app computes", async () => {
    const { keys } = manifest();
    for (const text of extractTexts()) {
      expect(keys[text], text).toBe(await speechKey(text));
    }
  });

  test("every key listed for a voice has its MP3 file", () => {
    const { voices } = manifest();
    expect(voices.length).toBeGreaterThan(0);
    for (const voice of voices) {
      for (const key of voice.keys) {
        const file = `${audioDir}/${voice.id}/${key}.mp3`;
        expect(existsSync(file) && statSync(file).size > 0, file).toBe(true);
      }
    }
  });
});
