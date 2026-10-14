import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { checkContent } from "./contentChecks";

const root = join(process.cwd(), "src", "content");
const readDir = (dir: string) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir)).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(root, dir, f), "utf8")) as unknown)
    : [];
const readFile = (f: string) => (existsSync(join(root, f)) ? (JSON.parse(readFileSync(join(root, f), "utf8")) as unknown) : { contentVersion: 1, questions: [] });

const strict = process.argv.includes("--strict") || process.env.CONTENT_STRICT === "1";
const errors = checkContent(
  { lessons: readDir("lessons"), dialogues: readDir("dialogues"), exam: readFile("exam.json"), badges: readFile("badges.json"),
    tree: existsSync(join(root, "tree.json")) ? (JSON.parse(readFileSync(join(root, "tree.json"), "utf8")) as unknown) : undefined,
  },
  { strict },
);
if (errors.length) {
  console.error(`✗ Content validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Content valid${strict ? " (strict)" : ""}`);
