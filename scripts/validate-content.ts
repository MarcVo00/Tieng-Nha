import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { checkContent } from "./contentChecks";

const root = join(process.cwd(), "src", "content");
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;
const readDir = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => json(join(dir, f))) : [];
const readOr = (path: string, fallback: unknown) => (existsSync(path) ? json(path) : fallback);
const readOptional = (path: string) => (existsSync(path) ? json(path) : undefined);

const strict = process.argv.includes("--strict") || process.env.CONTENT_STRICT === "1";
// Every language gets the integrity checks (references, tree, id prefixes, exercise types, boss sheets and pool size).
// Strict adds the Vietnamese course's own counts (10 lessons, 10 dialogues, exam quotas per section, tones included).
const languages = [
  { id: "vi", strict },
  { id: "tl", strict: false },
] as const;

const errors: string[] = [];
for (const language of languages) {
  const dir = join(root, language.id);
  const found = checkContent(
    {
      lessons: readDir(join(dir, "lessons")),
      dialogues: readDir(join(dir, "dialogues")),
      exam: readOr(join(dir, "exam.json"), { contentVersion: 1, questions: [] }),
      badges: readOr(join(root, "badges.json"), { contentVersion: 1, questions: [] }),
      bosses: readOptional(join(dir, "bosses.json")),
      shop: readOptional(join(root, "shop.json")),
      tree: readOptional(join(dir, "tree.json")),
    },
    { strict: language.strict, language: language.id },
  );
  errors.push(...found.map((e) => `[${language.id}] ${e}`));
}
if (errors.length) {
  console.error(`✗ Content validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Content valid${strict ? " (strict)" : ""}`);
