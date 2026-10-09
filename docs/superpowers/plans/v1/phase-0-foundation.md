# Phase 0 — Foundation (T01–T03)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read the master plan's **Global Constraints** first. These three tasks run **sequentially**.

---

### Task T01: Project scaffold, tooling and theme tokens

**Spec:** §1, §2.2, §10 · **ADR:** 0007, 0009 · **Design:** `docs/design-system.md` §2–§4

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `index.html`, `.env.example`, `.nvmrc`
- Create: `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/styles/tokens.css`, `src/styles/index.css`, `src/i18n/fr.ts`, `src/test/setup.ts`, `src/App.test.tsx`

**Interfaces:**
- Produces: npm scripts (`dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `verify`); alias `@/`; Tailwind token classes (`bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`, `text-ink`, `text-ink-muted`, `bg-primary`, `text-primary-on`, `bg-gold`, `text-gold-ink`, `bg-success`, `bg-success-soft`, `bg-error`, `bg-error-soft`, `text-info`, `text-streak`, `text-tone-{ngang|huyen|sac|hoi|nga|nang}`, `text-display|title|heading|body|body-strong|caption`, `rounded-sm|md|lg`, `shadow-card|raised`); `fr` object exported from `@/i18n/fr`; localStorage key `vl-theme` read by `index.html`.

- [ ] **Step 1: Initialise the project and install exact dependencies**

```bash
npm init -y
npm install react@^18.3 react-dom@^18.3 react-router-dom@^6.26 motion@^11 zustand@^5 dexie@^4 @supabase/supabase-js@^2.45 zod@^3.23 @fontsource/be-vietnam-pro
npm install -D vite@^5.4 @vitejs/plugin-react@^4 typescript@~5.6 @types/react@^18.3 @types/react-dom@^18.3 @types/node@^20 tailwindcss@^3.4 postcss@^8 autoprefixer@^10 vite-plugin-pwa@^0.20 vitest@^2.1 @vitest/coverage-v8@^2.1 jsdom@^25 @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 fake-indexeddb@^6 @playwright/test@^1.48 tsx@^4 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 eslint-plugin-boundaries@^4 eslint-plugin-i18next@^6 globals@^15 prettier@^3
echo 20 > .nvmrc
```

- [ ] **Step 2: Write `package.json` scripts and metadata** (keep the dependency blocks npm generated; set these fields)

```json
{
  "name": "vietlearn",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "test": "vitest run && tsx scripts/validate-content.ts",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm run lint && npm test && npm run build"
  }
}
```
Note: `scripts/validate-content.ts` is created in T02. Until then, temporarily create `scripts/validate-content.ts` containing only `console.log("content validation: not implemented yet (T02)");` so `npm test` runs.

- [ ] **Step 3: TypeScript configs**

`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
```
`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "scripts"]
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022", "lib": ["ES2022"], "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true, "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts", "playwright.config.ts", "e2e"]
}
```

- [ ] **Step 4: Vite and Vitest configs**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
```
`vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
      coverage: { provider: "v8", include: ["src/services/**"], thresholds: { lines: 90 } },
    },
  }),
);
```
`src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
```

- [ ] **Step 5: Theme tokens CSS** — `src/styles/tokens.css`, values copied **exactly** from `docs/design-system.md` §2:

```css
:root {
  --color-bg: #F6F0E4; --color-surface: #FFFBF3; --color-surface-2: #EFE6D4; --color-line: #DDD1BC;
  --color-ink: #1F1A17; --color-ink-muted: #5E544B;
  --color-primary: #A3201C; --color-primary-hover: #861A17; --color-on-primary: #FFF8EE;
  --color-gold: #C8962E; --color-gold-ink: #8A6416;
  --color-success: #276B54; --color-success-soft: #DCEBE2;
  --color-error: #B4410F; --color-error-soft: #F7E0D2;
  --color-info: #2C4A7A; --color-streak: #D9531E;
  --tone-ngang: #4A5560; --tone-huyen: #3D5A99; --tone-sac: #9A5B00; --tone-hoi: #7A4B9A; --tone-nga: #1E6E78; --tone-nang: #6B4A2F;
  --radius-sm: 10px; --radius-md: 16px; --radius-lg: 28px;
  --shadow-card: 0 1px 0 var(--color-line), 0 6px 16px -8px rgb(80 40 20 / 0.18);
  --shadow-raised: 0 2px 0 var(--color-line), 0 14px 30px -12px rgb(80 40 20 / 0.28);
  color-scheme: light;
}
:root.dark {
  --color-bg: #15110F; --color-surface: #1F1916; --color-surface-2: #2A221E; --color-line: #3A302A;
  --color-ink: #F3EADB; --color-ink-muted: #B5A895;
  --color-primary: #E0574A; --color-primary-hover: #EA6D61; --color-on-primary: #1A0F0D;
  --color-gold: #E3B34F; --color-gold-ink: #E3B34F;
  --color-success: #5DBB93; --color-success-soft: #1E3229;
  --color-error: #F08A4B; --color-error-soft: #3A2418;
  --color-info: #8FB0E0; --color-streak: #F07A3C;
  --tone-ngang: #B8C2CC; --tone-huyen: #8FB0E0; --tone-sac: #E8A54B; --tone-hoi: #C9A3E6; --tone-nga: #6CC4CF; --tone-nang: #C9A27E;
  --shadow-card: 0 1px 0 var(--color-line), 0 6px 16px -8px rgb(0 0 0 / 0.5);
  --shadow-raised: 0 2px 0 var(--color-line), 0 14px 30px -12px rgb(0 0 0 / 0.5);
  color-scheme: dark;
}
```
`src/styles/index.css`:
```css
@import "@fontsource/be-vietnam-pro/400.css";
@import "@fontsource/be-vietnam-pro/500.css";
@import "@fontsource/be-vietnam-pro/600.css";
@import "@fontsource/be-vietnam-pro/700.css";
@import "@fontsource/be-vietnam-pro/800.css";
@import "./tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

html { background: var(--color-bg); color: var(--color-ink); transition: background-color 200ms, color 200ms; -webkit-tap-highlight-color: transparent; }
body { font-family: "Be Vietnam Pro", system-ui, sans-serif; min-height: 100dvh; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
:focus-visible { outline: 3px solid var(--color-gold); outline-offset: 2px; }
.tabular { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Tailwind config (default palette REPLACED, not extended)** — `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: "var(--color-bg)",
      surface: "var(--color-surface)",
      "surface-2": "var(--color-surface-2)",
      line: "var(--color-line)",
      ink: { DEFAULT: "var(--color-ink)", muted: "var(--color-ink-muted)" },
      primary: { DEFAULT: "var(--color-primary)", hover: "var(--color-primary-hover)", on: "var(--color-on-primary)" },
      gold: { DEFAULT: "var(--color-gold)", ink: "var(--color-gold-ink)" },
      success: { DEFAULT: "var(--color-success)", soft: "var(--color-success-soft)" },
      error: { DEFAULT: "var(--color-error)", soft: "var(--color-error-soft)" },
      info: "var(--color-info)",
      streak: "var(--color-streak)",
      tone: {
        ngang: "var(--tone-ngang)", huyen: "var(--tone-huyen)", sac: "var(--tone-sac)",
        hoi: "var(--tone-hoi)", nga: "var(--tone-nga)", nang: "var(--tone-nang)",
      },
    },
    fontFamily: { sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"] },
    fontSize: {
      display: ["2.5rem", { lineHeight: "3rem", fontWeight: "800", letterSpacing: "-0.02em" }],
      title: ["1.75rem", { lineHeight: "2.25rem", fontWeight: "800" }],
      heading: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "700" }],
      body: ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
      "body-strong": ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
      caption: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
    },
    borderRadius: { none: "0", sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", full: "9999px" },
    boxShadow: { none: "none", card: "var(--shadow-card)", raised: "var(--shadow-raised)" },
    extend: {},
  },
  plugins: [],
} satisfies Config;
```
`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 7: `index.html` with no-flash theme script**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#F6F0E4" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>VietLearn</title>
    <script>
      (function () {
        try {
          var t = localStorage.getItem("vl-theme") || "system";
          var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
          if (dark) document.documentElement.classList.add("dark");
          document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#15110F" : "#F6F0E4");
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: i18n file and placeholder app**

`src/i18n/fr.ts`:
```ts
// All user-facing French strings. Each feature appends its own block: `// --- <feature> ---`.
export const fr = {
  app: {
    name: "VietLearn",
    loading: "Chargement…",
  },
} as const;

export type Fr = typeof fr;
```
`src/App.tsx`:
```tsx
import { fr } from "@/i18n/fr";

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
      <h1 className="text-title text-primary">{fr.app.name}</h1>
    </main>
  );
}
```
`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { App } from "@/App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 9: Write the smoke test, run it**

`src/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

test("renders the app name", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "VietLearn" })).toBeInTheDocument();
});
```
Run: `npx vitest run src/App.test.tsx` → Expected: 1 passed.

- [ ] **Step 10: ESLint flat config with architecture boundaries** — `eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import boundaries from "eslint-plugin-boundaries";
import i18next from "eslint-plugin-i18next";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "coverage", "node_modules", "playwright-report", "src/adapters/supabase/types.gen.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, boundaries },
    settings: {
      "import/resolver": { typescript: true },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "di", pattern: "src/app/{ServicesProvider.tsx,services.ts,appState.ts}", mode: "file" },
        { type: "app", pattern: "src/app/**" },
        { type: "root", pattern: "src/{main,App}.tsx", mode: "file" },
        { type: "feature", pattern: "src/features/*", capture: ["name"] },
        { type: "exercise-registry", pattern: "src/exercises/{registry.ts,types.ts,ExerciseHost.tsx,ExerciseHost.test.tsx}", mode: "file" },
        { type: "exercise", pattern: "src/exercises/*", capture: ["name"] },
        { type: "ui", pattern: "src/ui/**" },
        { type: "services", pattern: "src/services/**" },
        { type: "ports", pattern: "src/ports/**" },
        { type: "domain", pattern: "src/domain/**" },
        { type: "adapters", pattern: "src/adapters/*", capture: ["name"] },
        { type: "content", pattern: "src/content/**" },
        { type: "i18n", pattern: "src/i18n/**" },
        { type: "styles", pattern: "src/styles/**" },
        { type: "test", pattern: "src/test/**" },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": ["error", { patterns: [{ group: ["../../*"], message: "Use the @/ alias." }] }],
      "no-restricted-syntax": ["error", { selector: "TSEnumDeclaration", message: "Use string literal unions, not enums." }],
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "root", allow: ["app", "styles", "i18n", "ui"] },
          { from: "di", allow: ["di", "ports", "domain", "services", "content"] },
          { from: "app", allow: ["di", "app", "feature", "exercise-registry", "exercise", "ui", "services", "ports", "domain", "adapters", "content", "i18n", "styles"] },
          { from: "feature", allow: [["feature", { name: "${from.name}" }], "di", "exercise-registry", "ui", "services", "ports", "domain", "i18n"] },
          { from: "exercise-registry", allow: ["exercise", "exercise-registry", "ui", "services", "ports", "domain", "content", "i18n"] },
          { from: "exercise", allow: [["exercise", { name: "${from.name}" }], "di", "exercise-registry", "ui", "services", "ports", "domain", "content", "i18n"] },
          { from: "ui", allow: ["ui", "domain", "i18n"] },
          { from: "services", allow: ["services", "ports", "domain", "content"] },
          { from: "ports", allow: ["ports", "domain"] },
          { from: "domain", allow: ["domain", "content"] },
          { from: "adapters", allow: [["adapters", { name: "${from.name}" }], "di", "services", "ports", "domain", "content"] },
          { from: "content", allow: ["content"] },
          { from: "test", allow: ["di", "app", "feature", "exercise-registry", "exercise", "ui", "services", "ports", "domain", "adapters", "content", "i18n"] },
        ],
      }],
    },
  },
  {
    files: ["src/features/**/*.tsx", "src/ui/**/*.tsx", "src/exercises/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    plugins: { i18next },
    rules: { "i18next/no-literal-string": ["error", { mode: "jsx-text-only" }] },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**", "e2e/**"],
    rules: { "boundaries/element-types": "off", "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
```
Notes: `domain` may import `content` because domain types are `z.infer` of content schemas. The `di` element (`ServicesProvider.tsx`, `services.ts`, `appState.ts`) is the only part of `src/app/` that features may import. The `exercise-registry` element (`registry.ts`, `types.ts`, `ExerciseHost.tsx`) is the shared exercise engine used by lessons, review and exam. If `boundaries` reports an unknown-resolver warning, install nothing new — instead remove the `import/resolver` setting and rely on the alias being resolved by `eslint-plugin-boundaries`' default node resolver plus `tsconfig` paths; verify with Step 11.

- [ ] **Step 11: Prove the boundary rule works**, then delete the probe

Create `src/ui/probe.ts` with `import "@/services/nothing";` and an empty `src/services/nothing.ts` (`export {};`).
Run: `npx eslint src/ui/probe.ts` → Expected: an error from `boundaries/element-types` (ui → services not allowed).
Delete both probe files. Run `npm run lint` → Expected: no errors.

- [ ] **Step 12: Prettier, env example**

`.prettierrc.json`: `{ "printWidth": 110, "singleQuote": false, "trailingComma": "all" }`
`.prettierignore`: `dist\ncoverage\nnode_modules\nsrc/content/**/*.json\nsrc/adapters/supabase/types.gen.ts`
`.env.example`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace-with-local-anon-key
VITE_WELCOME_MESSAGE=Joyeux anniversaire ! 🎂
VITE_USE_FAKES=true
VITE_FAKE_SPEECH=false
```

- [ ] **Step 13: Verify and commit**

Run: `npm run verify` → Expected: all steps pass, `dist/` produced.
Run: `npm run dev`, open the URL: cream background, red "VietLearn" in Be Vietnam Pro. In devtools run `document.documentElement.classList.add('dark')` → background turns `#15110F`.

```bash
git add -A
git commit -m "chore: scaffold Vite React TS project with tokens, lint boundaries and test setup"
```

**Acceptance criteria:**
- `npm run verify` passes.
- `bg-white` / `text-gray-500` produce no CSS (default palette gone): `npx tailwindcss -i src/styles/index.css --content src/App.tsx | grep -c "gray-500"` → 0.
- Boundary probe produced an error before deletion.

---

### Task T02: Domain types, content schemas, badges and content validator

**Spec:** §3, §4.1, §4.5 · **ADR:** 0002, 0003, 0004 · **Guide:** `docs/content-guide.md` §1, §2, §5–§7

**Files:**
- Create: `src/content/schema.ts`, `src/content/schema.test.ts`, `src/content/badges.json`
- Create: `src/content/lessons/.gitkeep`, `src/content/dialogues/.gitkeep`
- Create: `src/domain/types.ts`, `src/domain/errors.ts`, `src/domain/tones.ts`, `src/domain/tones.test.ts`
- Create: `scripts/validate-content.ts`, `scripts/contentChecks.ts`, `scripts/contentChecks.test.ts`
- Create: `src/test/fixtures/lessonFixture.ts`, `src/test/fixtures/dialogueFixture.ts`, `src/test/fixtures/examFixture.ts`

**Interfaces:**
- Produces (all exported):
  - `@/content/schema`: `ToneSchema`, `VocabIdSchema`, `LessonIdSchema`, `DialogueIdSchema`, `VocabItemSchema`, `ListenChooseSchema`, `TranslateChooseSchema`, `TonePickSchema`, `WordOrderSchema`, `SpeakSchema`, `ExerciseSchema` (discriminated union on `type`), `LessonSchema`, `TurnSchema`, `DialogueSchema`, `ExamSectionSchema`, `ExamQuestionSchema`, `ExamPoolSchema`, `BadgeRuleSchema`, `BadgeDefSchema`, `BadgesFileSchema`.
  - `@/domain/types`: `Tone`, `VocabId`, `LessonId`, `DialogueId`, `VocabItem`, `Exercise`, `ExerciseType`, `ListenChoose`, `TranslateChoose`, `TonePick`, `WordOrder`, `Speak`, `Lesson`, `LessonSummary`, `Turn`, `NpcTurn`, `UserTurn`, `Dialogue`, `ExamSection`, `ExamQuestion`, `BadgeRule`, `BadgeDef`, `AppEventType`, `AppEvent`, `NewEvent`, `VocabProgress`, `LeitnerBox`, `Capabilities`, `Settings`, `ThemePref`, `Session`, `LeaderboardRow`, `PublicProfile`, `ConversationState`, `ProgressSnapshot`.
  - `@/domain/errors`: `InvalidInviteError`, `PseudoTakenError`, `ExamLimitError`, `OfflineError`, `ContentNotFoundError`, `NotAuthenticatedError`.
  - `@/domain/tones`: `TONES: readonly Tone[]`, `TONE_MARKS: Record<Tone, string>` (combining char or `""`), `toneOfSyllable(syllable: string): Tone`.
  - `scripts/contentChecks.ts`: `checkContent(input: ContentBundle, opts: { strict: boolean }): string[]` (list of error messages; empty = OK).

- [ ] **Step 1: Write failing tests for tone detection** — `src/domain/tones.test.ts`

```ts
import { toneOfSyllable } from "@/domain/tones";

test.each([
  ["ma", "ngang"], ["mà", "huyen"], ["má", "sac"], ["mả", "hoi"], ["mã", "nga"], ["mạ", "nang"],
  ["đá", "sac"], ["sữa", "nga"], ["phở", "hoi"], ["cà", "huyen"], ["ơi", "ngang"], ["được", "nang"], ["Việt", "nang"],
])("toneOfSyllable(%s) = %s", (syl, tone) => {
  expect(toneOfSyllable(syl)).toBe(tone);
});
```
Run: `npx vitest run src/domain/tones.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/domain/tones.ts`** (decompose to NFD only to *detect* the combining tone mark; never to strip letters)

```ts
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

export function toneOfSyllable(syllable: string): Tone {
  const decomposed = syllable.normalize("NFD");
  for (const tone of TONES) {
    const mark = TONE_MARKS[tone];
    if (mark && decomposed.includes(mark)) return tone;
  }
  return "ngang";
}
```
Note: `Tone` is defined here and re-exported by `domain/types.ts`; `ToneSchema` in `content/schema.ts` must use the same literals.
Run the test → Expected: PASS.

- [ ] **Step 3: Write `src/content/schema.ts`**

```ts
import { z } from "zod";

const isNfc = (s: string) => s === s.normalize("NFC");
export const ViTextSchema = z.string().min(1).refine(isNfc, { message: "Vietnamese text must be Unicode NFC" });

export const ToneSchema = z.enum(["ngang", "huyen", "sac", "hoi", "nga", "nang"]);
export const VocabIdSchema = z.string().regex(/^v_[a-z0-9_]+$/);
export const LessonIdSchema = z.string().regex(/^l\d{2}$/);
export const DialogueIdSchema = z.string().regex(/^d\d{2}$/);
const ExerciseIdSchema = z.string().regex(/^[a-z0-9_]+$/);

export const VocabItemSchema = z
  .object({
    id: VocabIdSchema,
    vi: ViTextSchema,
    fr: z.string().min(1),
    note: z.string().min(1).optional(),
    audio: z.string().min(1).optional(),
    dialect: z.literal("south"),
    deprecated: z.boolean().optional(),
  })
  .strict();

const base = { id: ExerciseIdSchema, deprecated: z.boolean().optional() };

export const ListenChooseSchema = z
  .object({ ...base, type: z.literal("listen_choose"), vocabId: VocabIdSchema, choices: z.array(VocabIdSchema).length(4) })
  .strict();
export const TranslateChooseSchema = z
  .object({
    ...base,
    type: z.literal("translate_choose"),
    promptFr: z.string().min(1),
    answerVi: ViTextSchema,
    distractorsVi: z.array(ViTextSchema).length(3),
  })
  .strict();
export const TonePickSchema = z
  .object({ ...base, type: z.literal("tone_pick"), syllable: ViTextSchema, answerTone: ToneSchema })
  .strict();
export const WordOrderSchema = z
  .object({
    ...base,
    type: z.literal("word_order"),
    fr: z.string().min(1),
    tokensVi: z.array(ViTextSchema).min(2).max(10),
    extraTokens: z.array(ViTextSchema).max(3).optional(),
  })
  .strict();
export const SpeakSchema = z
  .object({ ...base, type: z.literal("speak"), vi: ViTextSchema, fr: z.string().min(1), vocabIds: z.array(VocabIdSchema) })
  .strict();

export const ExerciseSchema = z.discriminatedUnion("type", [
  ListenChooseSchema,
  TranslateChooseSchema,
  TonePickSchema,
  WordOrderSchema,
  SpeakSchema,
]);

export const LessonSchema = z
  .object({
    id: LessonIdSchema,
    contentVersion: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    emoji: z.string().min(1),
    dialogueId: DialogueIdSchema,
    vocab: z.array(VocabItemSchema).min(12).max(18),
    exercises: z.array(ExerciseSchema).min(8).max(12),
  })
  .strict();

const TurnIdSchema = z.string().regex(/^t\d+$/);
export const NpcTurnSchema = z
  .object({ id: TurnIdSchema, speaker: z.literal("npc"), vi: ViTextSchema, fr: z.string().min(1), audio: z.string().optional(), next: TurnIdSchema.nullable() })
  .strict();
export const UserOptionSchema = z
  .object({ id: z.string().regex(/^o\d+$/), vi: ViTextSchema, fr: z.string().min(1), next: TurnIdSchema.nullable() })
  .strict();
export const UserTurnSchema = z
  .object({ id: TurnIdSchema, speaker: z.literal("user"), options: z.array(UserOptionSchema).min(2).max(3) })
  .strict();
export const TurnSchema = z.discriminatedUnion("speaker", [NpcTurnSchema, UserTurnSchema]);

export const DialogueSchema = z
  .object({
    id: DialogueIdSchema,
    contentVersion: z.number().int().min(1),
    title: z.string().min(1),
    scene: z.string().min(1),
    turns: z.array(TurnSchema).min(4).max(8),
  })
  .strict();

export const ExamSectionSchema = z.enum(["listening", "translation", "tones", "speaking"]);
export const ExamQuestionSchema = z
  .object({ id: z.string().regex(/^exam_q\d{3}$/), section: ExamSectionSchema, exercise: ExerciseSchema })
  .strict();
export const ExamPoolSchema = z.object({ contentVersion: z.number().int().min(1), questions: z.array(ExamQuestionSchema) }).strict();

export const BadgeRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lessons_done"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("streak"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("perfect_lesson") }).strict(),
  z.object({ kind: z.literal("vocab_reviewed"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("dialogues_done"), gte: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal("exam_score"), gte: z.number().int().min(1).max(100) }).strict(),
]);
export const BadgeDefSchema = z
  .object({ id: z.string().regex(/^[a-z0-9_]+$/), title: z.string().min(1), description: z.string().min(1), icon: z.string().min(1), rule: BadgeRuleSchema })
  .strict();
export const BadgesFileSchema = z.object({ badges: z.array(BadgeDefSchema).min(1) }).strict();
```

- [ ] **Step 4: Domain types** — `src/domain/types.ts`

```ts
import type { z } from "zod";
import type {
  VocabItemSchema, ExerciseSchema, ListenChooseSchema, TranslateChooseSchema, TonePickSchema, WordOrderSchema,
  SpeakSchema, LessonSchema, TurnSchema, NpcTurnSchema, UserTurnSchema, DialogueSchema, ExamSectionSchema,
  ExamQuestionSchema, BadgeRuleSchema, BadgeDefSchema,
} from "@/content/schema";

export type { Tone } from "@/domain/tones";
export type VocabId = string;
export type LessonId = string;
export type DialogueId = string;

export type VocabItem = z.infer<typeof VocabItemSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type ExerciseType = Exercise["type"];
export type ListenChoose = z.infer<typeof ListenChooseSchema>;
export type TranslateChoose = z.infer<typeof TranslateChooseSchema>;
export type TonePick = z.infer<typeof TonePickSchema>;
export type WordOrder = z.infer<typeof WordOrderSchema>;
export type Speak = z.infer<typeof SpeakSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonSummary = Pick<Lesson, "id" | "title" | "description" | "emoji" | "dialogueId"> & { order: number };
export type Turn = z.infer<typeof TurnSchema>;
export type NpcTurn = z.infer<typeof NpcTurnSchema>;
export type UserTurn = z.infer<typeof UserTurnSchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type ExamSection = z.infer<typeof ExamSectionSchema>;
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;
export type BadgeRule = z.infer<typeof BadgeRuleSchema>;
export type BadgeDef = z.infer<typeof BadgeDefSchema>;

export type AppEventType =
  | "lesson_completed"
  | "dialogue_completed"
  | "review_session_completed"
  | "exam_finished"
  | "badge_unlocked";

/** Payload shapes by event type (stored as JSON). */
export type EventPayload = {
  lesson_completed: { mistakes: number; durationMs: number; perfect: boolean };
  dialogue_completed: { durationMs: number };
  review_session_completed: { correctCount: number; total: number };
  exam_finished: { score: number; attemptId: string; noSpeaking: boolean };
  badge_unlocked: Record<string, never>;
};

export type AppEvent = {
  clientId: string; // uuid v4, idempotency key
  schemaVersion: 1;
  type: AppEventType;
  refId: string;
  xp: number;
  payload: Record<string, unknown>;
  createdAt: string; // ISO 8601 UTC
};
export type NewEvent = Omit<AppEvent, "clientId" | "createdAt" | "schemaVersion">;

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type VocabProgress = {
  vocabId: VocabId;
  box: LeitnerBox;
  dueAt: string; // ISO
  correct: number;
  wrong: number;
  lastSeenAt: string; // ISO
};

export type Capabilities = { tts: boolean; stt: boolean; recorder: boolean };
export type ThemePref = "system" | "light" | "dark";
export type Settings = {
  theme: ThemePref;
  voiceRate: "normal" | "slow";
  capabilities: Capabilities | null; // null = device test not done yet
  onboardingDone: boolean;
};

export type Session = { userId: string; email: string };

export type LeaderboardRow = {
  userId: string;
  pseudo: string;
  avatarEmoji: string;
  xp: number; // xp_week or xp_total depending on period
  streak: number;
  lessonsDone: number;
  isMe: boolean;
};

export type PublicProfile = {
  userId: string;
  pseudo: string;
  avatarEmoji: string;
  xpTotal: number;
  xpWeek: number;
  streak: number;
  lessonsDone: LessonId[];
  dialoguesDone: DialogueId[];
  badges: string[];
  examBest: number | null;
};

export type ConversationEntry = { turnId: string; speaker: "npc" | "user"; vi: string; fr: string };
export type ConversationState = {
  dialogueId: DialogueId;
  history: ConversationEntry[];
  currentTurnId: string | null; // null = finished
  awaitingUser: boolean; // true when currentTurnId is a user turn
  misunderstood: boolean; // last speech input matched no option
  finished: boolean;
};

/** Local projection of the event log (services/progress.ts). */
export type ProgressSnapshot = {
  xpTotal: number;
  xpWeek: number;
  xpToday: number;
  streak: number;
  lessonsDone: LessonId[];
  perfectLessons: LessonId[];
  dialoguesDone: DialogueId[];
  vocabReviewed: number;
  examBest: number | null;
  badges: string[];
  activeDays: string[]; // YYYY-MM-DD, Europe/Paris, sorted asc
};
```

- [ ] **Step 5: Errors** — `src/domain/errors.ts`

```ts
export class DomainError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = new.target.name;
  }
}
export class InvalidInviteError extends DomainError { constructor() { super("invalid_invite"); } }
export class PseudoTakenError extends DomainError { constructor() { super("pseudo_taken"); } }
export class ExamLimitError extends DomainError { constructor() { super("exam_limit"); } }
export class OfflineError extends DomainError { constructor() { super("offline"); } }
export class NotAuthenticatedError extends DomainError { constructor() { super("not_authenticated"); } }
export class ContentNotFoundError extends DomainError {
  constructor(public readonly refId: string) { super("content_not_found", `Content not found: ${refId}`); }
}
```

- [ ] **Step 6: Badges file** — `src/content/badges.json` (exactly these 12)

```json
{
  "badges": [
    { "id": "first_lesson", "title": "Premier pas", "description": "Termine ta première leçon.", "icon": "🌱", "rule": { "kind": "lessons_done", "gte": 1 } },
    { "id": "five_lessons", "title": "Bon élève", "description": "Termine 5 leçons.", "icon": "📗", "rule": { "kind": "lessons_done", "gte": 5 } },
    { "id": "ten_lessons", "title": "Toutes les leçons", "description": "Termine les 10 leçons.", "icon": "🎓", "rule": { "kind": "lessons_done", "gte": 10 } },
    { "id": "streak_3", "title": "Lancé·e", "description": "3 jours d'affilée.", "icon": "🔥", "rule": { "kind": "streak", "gte": 3 } },
    { "id": "streak_7", "title": "Une semaine", "description": "7 jours d'affilée.", "icon": "🏮", "rule": { "kind": "streak", "gte": 7 } },
    { "id": "streak_30", "title": "Inarrêtable", "description": "30 jours d'affilée.", "icon": "🐉", "rule": { "kind": "streak", "gte": 30 } },
    { "id": "perfect_lesson", "title": "Sans faute", "description": "Termine une leçon sans aucune erreur.", "icon": "⭐", "rule": { "kind": "perfect_lesson" } },
    { "id": "vocab_100", "title": "Mémoire d'éléphant", "description": "Révise 100 mots correctement.", "icon": "🐘", "rule": { "kind": "vocab_reviewed", "gte": 100 } },
    { "id": "first_dialogue", "title": "Première conversation", "description": "Termine ton premier dialogue.", "icon": "💬", "rule": { "kind": "dialogues_done", "gte": 1 } },
    { "id": "all_dialogues", "title": "Bavard·e", "description": "Termine les 10 dialogues.", "icon": "🗣️", "rule": { "kind": "dialogues_done", "gte": 10 } },
    { "id": "exam_passed", "title": "Diplômé·e", "description": "Obtiens au moins 70 au test final.", "icon": "📜", "rule": { "kind": "exam_score", "gte": 70 } },
    { "id": "exam_excellent", "title": "Excellence", "description": "Obtiens au moins 90 au test final.", "icon": "🏆", "rule": { "kind": "exam_score", "gte": 90 } }
  ]
}
```

- [ ] **Step 7: Test fixtures** — valid minimal content used by many later tests.

`src/test/fixtures/lessonFixture.ts`:
```ts
import type { Lesson } from "@/domain/types";

const vocab = [
  ["v_ca_phe", "cà phê", "café"], ["v_ca_phe_sua_da", "cà phê sữa đá", "café au lait glacé"],
  ["v_ca_phe_den", "cà phê đen", "café noir"], ["v_tra_da", "trà đá", "thé glacé"], ["v_ly", "ly", "verre"],
  ["v_da", "đá", "glace"], ["v_duong", "đường", "sucre"], ["v_cho_tui", "cho tui", "donne-moi"],
  ["v_tinh_tien", "tính tiền", "l'addition"], ["v_ngon", "ngon", "bon"], ["v_nuoc", "nước", "eau"], ["v_sua", "sữa", "lait"],
] as const;

export const lessonFixture: Lesson = {
  id: "l05",
  contentVersion: 1,
  title: "Au café",
  description: "Commander un café glacé comme à Sài Gòn.",
  emoji: "☕",
  dialogueId: "d05",
  vocab: vocab.map(([id, vi, fr]) => ({ id, vi, fr, dialect: "south" as const })),
  exercises: [
    { id: "l05_e01", type: "listen_choose", vocabId: "v_ca_phe_sua_da", choices: ["v_ca_phe_sua_da", "v_ca_phe_den", "v_tra_da", "v_ly"] },
    { id: "l05_e02", type: "tone_pick", syllable: "đá", answerTone: "sac" },
    { id: "l05_e03", type: "translate_choose", promptFr: "Un café noir, s'il te plaît.", answerVi: "Cho tui một ly cà phê đen.", distractorsVi: ["Cho tui một ly trà đá.", "Cho tui một ly cà phê sữa đá.", "Tính tiền."] },
    { id: "l05_e04", type: "word_order", fr: "Un café au lait glacé pour moi.", tokensVi: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"], extraTokens: ["đen"] },
    { id: "l05_e05", type: "speak", vi: "Cho tui một ly trà đá.", fr: "Un thé glacé pour moi.", vocabIds: ["v_cho_tui", "v_ly", "v_tra_da"] },
    { id: "l05_e06", type: "listen_choose", vocabId: "v_tra_da", choices: ["v_tra_da", "v_ca_phe", "v_nuoc", "v_sua"] },
    { id: "l05_e07", type: "translate_choose", promptFr: "L'addition !", answerVi: "Tính tiền!", distractorsVi: ["Ngon quá!", "Cho tui nước.", "Cà phê đen."] },
    { id: "l05_e08", type: "speak", vi: "Ngon quá!", fr: "C'est trop bon !", vocabIds: ["v_ngon"] },
  ],
};
```
`src/test/fixtures/dialogueFixture.ts` — the full `d05` JSON from `docs/content-guide.md` §7 typed as `Dialogue` (export `dialogueFixture`).
`src/test/fixtures/examFixture.ts`:
```ts
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
```

- [ ] **Step 8: Write failing tests for the content checks** — `scripts/contentChecks.test.ts`

```ts
import { checkContent, type ContentBundle } from "./contentChecks";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";
import { examPoolFixture } from "@/test/fixtures/examFixture";
import badges from "@/content/badges.json";

const ok: ContentBundle = {
  lessons: [lessonFixture],
  dialogues: [dialogueFixture],
  exam: { contentVersion: 1, questions: examPoolFixture },
  badges,
};

test("valid bundle has no errors (non-strict)", () => {
  expect(checkContent(ok, { strict: false })).toEqual([]);
});

test("detects unknown vocabId in listen_choose", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[0] = { id: "x1", type: "listen_choose", vocabId: "v_nope", choices: ["v_nope", "v_ly", "v_da", "v_ca_phe"] };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/v_nope/);
});

test("detects listen_choose whose answer is not among choices", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[0] = { id: "x1", type: "listen_choose", vocabId: "v_ly", choices: ["v_da", "v_ca_phe", "v_tra_da", "v_sua"] };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/not among choices/);
});

test("detects tone mismatch", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.exercises[1] = { id: "x2", type: "tone_pick", syllable: "đá", answerTone: "huyen" };
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/tone/);
});

test("detects NFD text", () => {
  const bad = structuredClone(ok);
  bad.lessons[0]!.vocab[0]!.vi = "cà phê".normalize("NFD");
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/NFC/);
});

test("detects dialogue with dangling next", () => {
  const bad = structuredClone(ok);
  const t = bad.dialogues[0]!.turns[0]!;
  if (t.speaker === "npc") t.next = "t99";
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/t99/);
});

test("detects duplicate ids across lessons", () => {
  const bad = structuredClone(ok);
  bad.lessons.push({ ...structuredClone(lessonFixture), id: "l06" });
  expect(checkContent(bad, { strict: false }).join("\n")).toMatch(/duplicate/i);
});

test("strict mode requires 10 lessons, 10 dialogues and exam quotas", () => {
  const errors = checkContent(ok, { strict: true }).join("\n");
  expect(errors).toMatch(/10 lessons/);
  expect(errors).toMatch(/10 dialogues/);
});
```
Run: `npx vitest run scripts/contentChecks.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 9: Implement `scripts/contentChecks.ts`**

```ts
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
    if (prev && prev !== where) errors.push(`duplicate id "${id}" in ${where} (already in ${prev})`);
    else seen.set(id, where);
  };
  for (const l of lessons) {
    claim(l.id, l.id);
    l.vocab.forEach((v) => claim(v.id, `${l.id}.vocab`));
    l.exercises.forEach((e) => claim(e.id, `${l.id}.exercises`));
  }
  dialogues.forEach((d) => claim(d.id, d.id));

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
    const ids = new Set(d.turns.map((t) => t.id));
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
```
Run the test → Expected: PASS (8 tests). If a fixture fails the schema (e.g. vocab count < 12), fix the **fixture**, not the schema.

- [ ] **Step 10: CLI wrapper** — `scripts/validate-content.ts` (replaces the T01 stub)

```ts
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
  { lessons: readDir("lessons"), dialogues: readDir("dialogues"), exam: readFile("exam.json"), badges: readFile("badges.json") },
  { strict },
);
if (errors.length) {
  console.error(`✗ Content validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Content valid${strict ? " (strict)" : ""}`);
```
Note: strict mode is switched on in CI by T34 once all content exists.

- [ ] **Step 11: Schema unit test** — `src/content/schema.test.ts`

```ts
import { LessonSchema, ExerciseSchema, DialogueSchema } from "@/content/schema";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";

test("fixture lesson is valid", () => expect(LessonSchema.safeParse(lessonFixture).success).toBe(true));
test("fixture dialogue is valid", () => expect(DialogueSchema.safeParse(dialogueFixture).success).toBe(true));
test("unknown exercise type is rejected", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "dance" }).success).toBe(false));
test("extra keys are rejected (strict)", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "tone_pick", syllable: "má", answerTone: "sac", extra: 1 }).success).toBe(false));
```

- [ ] **Step 12: Verify and commit**

Run: `npm run verify` → Expected: PASS, and the output ends with `✓ Content valid`.
```bash
git add -A
git commit -m "feat(content): add domain types, Zod content schemas, badges and content validator"
```

**Acceptance criteria:** all tests above pass; `npx tsx scripts/validate-content.ts --strict` fails with "expected 10 lessons" (content arrives in phase 4); no `any`.

---

### Task T03: Ports, fakes, exercise contract, env, flags and service container

**Spec:** §2.3, §12 · **ADR:** 0001, 0002, 0008

**Files:**
- Create: `src/ports/ContentSource.ts`, `ProgressRepository.ts`, `EventSink.ts`, `Outbox.ts`, `LeaderboardRepository.ts`, `AuthService.ts`, `ExamGateway.ts`, `Speech.ts`, `ConversationEngine.ts`, `ContentReporter.ts`, `index.ts`
- Create: `src/exercises/types.ts`
- Create: `src/adapters/fakes/InMemoryContentSource.ts`, `InMemoryProgressRepository.ts`, `InMemoryOutbox.ts`, `FakeEventSink.ts`, `FakeLeaderboardRepository.ts`, `FakeAuthService.ts`, `FakeExamGateway.ts`, `FakeSpeech.ts`, `FakeContentReporter.ts`, `index.ts`, `fakes.test.ts`
- Create: `src/adapters/fakes/createFakeServices.ts`, `src/adapters/fakes/seed/lesson.ts`, `seed/dialogue.ts`, `seed/exam.ts`
- Modify: `src/test/fixtures/lessonFixture.ts`, `dialogueFixture.ts`, `examFixture.ts` (become re-exports)
- Create: `src/domain/config.ts`, `src/app/env.ts`, `src/app/env.test.ts`, `src/app/flags.ts`, `src/app/services.ts`, `src/app/ServicesProvider.tsx`, `src/app/container.ts`
- Create (temporary stubs): `src/services/activity.ts`, `src/services/sync.ts`
- Create: `src/test/renderWithServices.tsx`

**Interfaces:**
- Consumes: all domain types from T02.
- Produces:
  - Ports exactly as below (later tasks implement them; **do not change signatures**).
  - `Services` type (`@/app/services`), `ServicesProvider` and `useServices(): Services` (`@/app/ServicesProvider`) — importable from features/exercises (the `di` element).
  - `Env`, `Flags` types (`@/domain/config`); `parseEnv` (`@/app/env`); `flags` (`@/app/flags`); `createServices(env)` (`@/app/container`).
  - `createFakeServices(overrides?: Partial<Services>): Services` (`@/adapters/fakes`) — used by every component test.
  - `renderWithServices(ui, { services?, route? })` (`@/test/renderWithServices`).
  - `ExercisePlugin`, `ExerciseProps`, `GradeResult`, `GradeContext`, `ExerciseServices` (`@/exercises/types`).

- [ ] **Step 1: Write the ports** (one file each, re-exported by `src/ports/index.ts`)

```ts
// src/ports/ContentSource.ts
import type { BadgeDef, Dialogue, DialogueId, ExamQuestion, Lesson, LessonId, LessonSummary, VocabId, VocabItem } from "@/domain/types";
export interface ContentSource {
  listLessons(): Promise<LessonSummary[]>; // ordered l01..l10
  getLesson(id: LessonId): Promise<Lesson>; // throws ContentNotFoundError
  getDialogue(id: DialogueId): Promise<Dialogue>; // throws ContentNotFoundError
  getExamPool(): Promise<ExamQuestion[]>;
  getBadges(): Promise<BadgeDef[]>;
  getVocabIndex(): Promise<ReadonlyMap<VocabId, VocabItem>>; // every vocab of every lesson
}
```
```ts
// src/ports/ProgressRepository.ts
import type { AppEvent, NewEvent, Settings, VocabId, VocabProgress, LeaderboardRow } from "@/domain/types";
export interface ProgressRepository {
  appendEvent(e: NewEvent, nowIso: string): Promise<AppEvent>; // assigns clientId (crypto.randomUUID()), createdAt = nowIso, schemaVersion 1
  listEvents(): Promise<AppEvent[]>; // ordered by createdAt asc
  getVocabProgress(id: VocabId): Promise<VocabProgress | undefined>;
  upsertVocabProgress(p: VocabProgress): Promise<void>;
  listDueVocab(nowIso: string, limit: number): Promise<VocabProgress[]>; // dueAt <= now, ordered by dueAt asc
  countDueVocab(nowIso: string): Promise<number>;
  getSettings(): Promise<Settings>; // returns DEFAULT_SETTINGS if none saved
  saveSettings(s: Settings): Promise<void>;
  getCachedLeaderboard(period: "week" | "all"): Promise<{ rows: LeaderboardRow[]; fetchedAt: string } | undefined>;
  cacheLeaderboard(period: "week" | "all", rows: LeaderboardRow[], fetchedAt: string): Promise<void>;
  clearAll(): Promise<void>; // used on account deletion / sign out
}
export const DEFAULT_SETTINGS = { theme: "system", voiceRate: "normal", capabilities: null, onboardingDone: false } as const;
```
```ts
// src/ports/EventSink.ts
import type { AppEvent } from "@/domain/types";
export interface EventSink {
  /** Inserts events idempotently (on conflict client_id do nothing). Returns clientIds now stored server-side. Throws OfflineError when unreachable. */
  push(events: AppEvent[]): Promise<{ accepted: string[] }>;
}
```
```ts
// src/ports/Outbox.ts
import type { AppEvent } from "@/domain/types";
export interface Outbox {
  enqueue(e: AppEvent): Promise<void>;
  peek(n: number): Promise<AppEvent[]>; // oldest first
  ack(clientIds: string[]): Promise<void>;
  size(): Promise<number>;
}
```
```ts
// src/ports/LeaderboardRepository.ts
import type { LeaderboardRow, PublicProfile } from "@/domain/types";
export interface LeaderboardRepository {
  list(period: "week" | "all"): Promise<LeaderboardRow[]>; // sorted desc by xp; throws OfflineError
  getPublicProfile(userId: string): Promise<PublicProfile>; // throws OfflineError / ContentNotFoundError
}
```
```ts
// src/ports/AuthService.ts
import type { Session } from "@/domain/types";
export interface AuthService {
  getSession(): Promise<Session | null>;
  onChange(cb: (s: Session | null) => void): () => void; // returns unsubscribe
  requestOtp(email: string): Promise<void>;
  verifyOtp(email: string, token: string): Promise<Session>; // throws Error("invalid_otp")
  hasProfile(): Promise<boolean>;
  joinGroup(inviteCode: string, pseudo: string, avatarEmoji: string): Promise<void>; // InvalidInviteError | PseudoTakenError
  getMyProfile(): Promise<{ pseudo: string; avatarEmoji: string } | null>;
  updateProfile(p: { pseudo: string; avatarEmoji: string }): Promise<void>; // PseudoTakenError
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}
```
```ts
// src/ports/ExamGateway.ts
export interface ExamGateway {
  startAttempt(): Promise<{ attemptId: string; remainingToday: number }>; // ExamLimitError | OfflineError
  submitAttempt(attemptId: string, score: number): Promise<void>;
}
```
```ts
// src/ports/Speech.ts
export type SpeakOptions = { rate?: number; audioUrl?: string };
export interface SpeechSynthesizer {
  isAvailable(): boolean; // a vi-VN voice exists (or audioUrl playback possible)
  speak(text: string, opts?: SpeakOptions): Promise<void>; // resolves when finished
  cancel(): void;
}
export type RecognitionErrorCode = "no-speech" | "not-allowed" | "aborted" | "timeout" | "unsupported" | "network";
export class RecognitionError extends Error {
  constructor(public readonly code: RecognitionErrorCode) { super(code); this.name = "RecognitionError"; }
}
export interface SpeechRecognizer {
  isAvailable(): boolean;
  listen(opts: { lang: "vi-VN"; timeoutMs: number }): Promise<string[]>; // alternatives, best first; throws RecognitionError
  abort(): void;
}
export interface VoiceRecorder {
  isAvailable(): boolean;
  record(maxMs: number, signal?: AbortSignal): Promise<Blob>; // stops at maxMs or on abort
}
```
```ts
// src/ports/ConversationEngine.ts
import type { ConversationState, DialogueId } from "@/domain/types";
export type ConversationInput = { kind: "speech"; alternatives: string[] } | { kind: "choice"; optionId: string };
export interface ConversationEngine {
  start(dialogueId: DialogueId): Promise<ConversationState>;
  answer(state: ConversationState, input: ConversationInput): Promise<ConversationState>;
}
```
```ts
// src/ports/ContentReporter.ts
export interface ContentReporter {
  report(r: { refId: string; message: string; contentVersion?: number }): Promise<void>; // queues locally if offline
}
```

- [ ] **Step 2: Exercise plugin contract** — `src/exercises/types.ts`

```ts
import type { FC } from "react";
import type { z } from "zod";
import type { Capabilities, Exercise, VocabId, VocabItem } from "@/domain/types";
import type { SpeechRecognizer, SpeechSynthesizer, VoiceRecorder } from "@/ports";

export type ExerciseServices = { tts: SpeechSynthesizer; stt: SpeechRecognizer; recorder: VoiceRecorder };
export type GradeContext = { vocabIndex: ReadonlyMap<VocabId, VocabItem> };

export type GradeResult = {
  correct: boolean;
  score: number; // 0..1
  expected: string; // correct answer as displayable Vietnamese text
  vocabIds: VocabId[]; // words whose Leitner state this answer updates
  selfAssessed?: boolean; // speak via recorder fallback
  skipped?: boolean; // speak with mic denied: neither right nor wrong
  detail?: unknown; // plugin-specific (e.g. syllable diff for speak)
};

export type ExerciseProps<E extends Exercise> = {
  exercise: E;
  disabled: boolean; // true after the answer was submitted
  onAnswer: (answer: unknown) => void;
  services: ExerciseServices;
  capabilities: Capabilities;
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  voiceRate: number; // 1 normal, 0.6 slow
  seed: number; // deterministic shuffling of choices
  onCapabilityLost?: (c: "stt" | "recorder") => void; // e.g. microphone permission denied at runtime
};

export type ExercisePlugin<E extends Exercise = Exercise> = {
  type: E["type"];
  schema: z.ZodType<E>;
  Component: FC<ExerciseProps<E>>;
  grade(exercise: E, answer: unknown, ctx: GradeContext): GradeResult;
  /** Optional extra content rendered inside the feedback sheet (e.g. syllable diff for speak). */
  Feedback?: FC<{ exercise: E; result: GradeResult }>;
};
```

- [ ] **Step 3: Write failing tests for the fakes** — `src/adapters/fakes/fakes.test.ts`

```ts
import { InMemoryProgressRepository, InMemoryOutbox, FakeEventSink, FakeAuthService, FakeExamGateway } from "@/adapters/fakes";
import { ExamLimitError, InvalidInviteError } from "@/domain/errors";

const now = "2026-10-10T08:00:00.000Z";

test("progress repo appends events with uuid and timestamp", async () => {
  const repo = new InMemoryProgressRepository();
  const e = await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, now);
  expect(e.clientId).toMatch(/^[0-9a-f-]{36}$/);
  expect(e.createdAt).toBe(now);
  expect(await repo.listEvents()).toHaveLength(1);
});

test("due vocab is filtered and sorted", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsertVocabProgress({ vocabId: "v_b", box: 1, dueAt: "2026-10-09T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  await repo.upsertVocabProgress({ vocabId: "v_a", box: 1, dueAt: "2026-10-08T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  await repo.upsertVocabProgress({ vocabId: "v_c", box: 1, dueAt: "2026-10-20T00:00:00.000Z", correct: 0, wrong: 0, lastSeenAt: now });
  expect((await repo.listDueVocab(now, 10)).map((p) => p.vocabId)).toEqual(["v_a", "v_b"]);
  expect(await repo.countDueVocab(now)).toBe(2);
});

test("outbox peek/ack", async () => {
  const ob = new InMemoryOutbox();
  const repo = new InMemoryProgressRepository();
  const e = await repo.appendEvent({ type: "lesson_completed", refId: "l01", xp: 10, payload: {} }, now);
  await ob.enqueue(e);
  expect(await ob.size()).toBe(1);
  await ob.ack([e.clientId]);
  expect(await ob.size()).toBe(0);
});

test("fake sink can simulate offline", async () => {
  const sink = new FakeEventSink();
  sink.online = false;
  await expect(sink.push([])).rejects.toThrow("offline");
});

test("fake auth rejects bad invite and accepts OTP 123456", async () => {
  const auth = new FakeAuthService();
  await auth.requestOtp("a@b.c");
  await expect(auth.verifyOtp("a@b.c", "000000")).rejects.toThrow("invalid_otp");
  await auth.verifyOtp("a@b.c", "123456");
  await expect(auth.joinGroup("WRONG", "Marc", "🐉")).rejects.toBeInstanceOf(InvalidInviteError);
  await auth.joinGroup("TEST-CODE", "Marc", "🐉");
  expect(await auth.hasProfile()).toBe(true);
});

test("fake exam gateway limits to 3 attempts", async () => {
  const g = new FakeExamGateway();
  await g.startAttempt(); await g.startAttempt();
  expect((await g.startAttempt()).remainingToday).toBe(0);
  await expect(g.startAttempt()).rejects.toBeInstanceOf(ExamLimitError);
});
```
Run: `npx vitest run src/adapters/fakes` → Expected: FAIL.

- [ ] **Step 4: Implement the fakes** — behaviour contract (implement exactly):

| Fake | Behaviour |
|---|---|
| `InMemoryContentSource(lessons: Lesson[], dialogues: Dialogue[], exam: ExamQuestion[], badges: BadgeDef[])` | serves the given arrays; `listLessons` sorted by id with `order` = index + 1; unknown id → `ContentNotFoundError`; `getVocabIndex` builds a Map from all lessons' vocab |
| `InMemoryProgressRepository` | arrays/maps in memory; `appendEvent` uses `crypto.randomUUID()`; `getSettings` returns `{ ...DEFAULT_SETTINGS }` until saved |
| `InMemoryOutbox` | array; `peek` returns oldest first; `ack` removes by clientId |
| `FakeEventSink` | public `online = true`, public `received: AppEvent[]`; when offline throws `OfflineError`; dedupes by clientId; returns all pushed ids as accepted |
| `FakeLeaderboardRepository(getMyEvents: () => Promise<AppEvent[]>, me: { userId, pseudo, avatarEmoji })` | returns 4 bot players (`Bà Ngoại 🐢` 120 XP, `Chú Tư 🛵` 85, `Bé Na 🌸` 40, `Anh Hai 🐯` 15, streaks 5/2/1/0, lessons 3/2/1/1) plus "me" whose xp = sum of my events' xp (week = events since Monday Paris — use a simple `Date` comparison on ISO strings computed by the caller-provided clock `now: () => string`, default `() => new Date().toISOString()`); sorted desc; `online` flag like the sink |
| `FakeAuthService` | OTP is always `123456`; valid invite code `TEST-CODE`; pseudo `Taken` → `PseudoTakenError`; keeps session in memory; `onChange` notifies subscribers |
| `FakeExamGateway(clock?)` | 3 attempts per instance-day; `attemptId` = `crypto.randomUUID()`; `online` flag |
| `FakeSpeechSynthesizer` | `available = true`; `spoken: string[]` records texts; `speak` resolves after `delayMs` (default 0) |
| `FakeSpeechRecognizer` | `available = true`; `queue: Array<string[] \| RecognitionError>`; `listen` shifts the queue (throws if error; returns `["xin chào"]` if empty) |
| `FakeVoiceRecorder` | `available = true`; returns `new Blob(["fake"], { type: "audio/webm" })` |
| `FakeContentReporter` | `reports` array |

`src/adapters/fakes/index.ts` exports all classes plus `createFakeServices` (Step 7). Run tests → PASS.

- [ ] **Step 5: Config types, env parsing and flags**

`src/domain/config.ts`:
```ts
export type Env = {
  VITE_SUPABASE_URL?: string | undefined;
  VITE_SUPABASE_ANON_KEY?: string | undefined;
  VITE_WELCOME_MESSAGE: string;
  VITE_USE_FAKES: boolean;
  VITE_FAKE_SPEECH: boolean;
};
export type Flags = { aiConversation: boolean; streakFreeze: boolean; humanAudio: boolean };
```
`src/app/env.ts`:
```ts
import { z } from "zod";
import type { Env } from "@/domain/config";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
const EnvSchema = z
  .object({
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(10).optional(),
    VITE_WELCOME_MESSAGE: z.string().default(""),
    VITE_USE_FAKES: bool,
    VITE_FAKE_SPEECH: bool,
  })
  .superRefine((e, ctx) => {
    if (!e.VITE_USE_FAKES && (!e.VITE_SUPABASE_URL || !e.VITE_SUPABASE_ANON_KEY))
      ctx.addIssue({ code: "custom", message: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required unless VITE_USE_FAKES=true" });
  });

export function parseEnv(raw: Record<string, unknown>): Env {
  return EnvSchema.parse(raw);
}
```
`src/app/env.test.ts`:
```ts
import { parseEnv } from "@/app/env";
test("fakes mode needs no supabase keys", () => expect(parseEnv({ VITE_USE_FAKES: "true" }).VITE_USE_FAKES).toBe(true));
test("real mode requires supabase keys", () => expect(() => parseEnv({ VITE_USE_FAKES: "false" })).toThrow(/required/));
```
`src/app/flags.ts`:
```ts
import type { Flags } from "@/domain/config";
export const flags: Flags = { aiConversation: false, streakFreeze: false, humanAudio: false };
```
Run: `npx vitest run src/app/env.test.ts` → PASS.

- [ ] **Step 6: Services type and provider (the `di` boundary element)**

These two files form the `di` element of the ESLint boundaries config (T01): features, exercises, adapters and tests may import them; they may only import `ports`, `domain`, `services`.

`src/app/services.ts`:
```ts
import type { Env, Flags } from "@/domain/config";
import type { Capabilities } from "@/domain/types";
import type {
  AuthService, ContentReporter, ContentSource, ConversationEngine, EventSink, ExamGateway, LeaderboardRepository,
  Outbox, ProgressRepository, SpeechRecognizer, SpeechSynthesizer, VoiceRecorder,
} from "@/ports";
import type { ActivityService } from "@/services/activity";
import type { SyncService } from "@/services/sync";

export type Services = {
  env: Env;
  flags: Flags;
  clock: () => string; // ISO "now"
  content: ContentSource;
  progress: ProgressRepository;
  outbox: Outbox;
  sink: EventSink;
  leaderboard: LeaderboardRepository;
  auth: AuthService;
  exam: ExamGateway;
  tts: SpeechSynthesizer;
  stt: SpeechRecognizer;
  recorder: VoiceRecorder;
  detectCapabilities: () => Promise<Capabilities>; // real implementation in T12 (waits for TTS voices)
  conversation: ConversationEngine;
  reporter: ContentReporter;
  activity: ActivityService; // real implementation in T07
  sync: SyncService; // real implementation in T10
};
```
`src/app/ServicesProvider.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from "react";
import type { Services } from "@/app/services";

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}
```
Temporary stubs so `Services` compiles. T07 and T10 replace these files entirely, keeping the exported names `ActivityService`, `createActivityService`, `SyncService`, `createSyncService`:
```ts
// src/services/activity.ts — stub, replaced in T07
export type ActivityService = Record<string, never>;
export function createActivityService(): ActivityService {
  return {};
}
```
```ts
// src/services/sync.ts — stub, replaced in T10
export type SyncService = {
  start(): void;
  stop(): void;
  flush(): Promise<{ sent: number }>;
  onSizeChange(cb: (n: number) => void): () => void;
};
export function createSyncService(): SyncService {
  return { start() {}, stop() {}, async flush() { return { sent: 0 }; }, onSizeChange() { return () => {}; } };
}
```

- [ ] **Step 7: Seed content for fakes, fake services factory, container**

Production code must never import from `src/test/`. Move the T02 fixtures into the fakes adapter:
- `src/test/fixtures/lessonFixture.ts` → `src/adapters/fakes/seed/lesson.ts` (export `lessonFixture`)
- `src/test/fixtures/dialogueFixture.ts` → `src/adapters/fakes/seed/dialogue.ts` (export `dialogueFixture`)
- `src/test/fixtures/examFixture.ts` → `src/adapters/fakes/seed/exam.ts` (export `examPoolFixture`; its import of `lessonFixture` now points to `@/adapters/fakes/seed/lesson`)
- Replace each `src/test/fixtures/*.ts` with a one-line re-export, e.g. `export { lessonFixture } from "@/adapters/fakes/seed/lesson";`, so T02 tests keep working unchanged.

`src/adapters/fakes/createFakeServices.ts`:
```ts
import type { Services } from "@/app/services";
import badgesFile from "@/content/badges.json";
import { BadgesFileSchema } from "@/content/schema";
import { lessonFixture } from "@/adapters/fakes/seed/lesson";
import { dialogueFixture } from "@/adapters/fakes/seed/dialogue";
import { examPoolFixture } from "@/adapters/fakes/seed/exam";
import { InMemoryContentSource } from "@/adapters/fakes/InMemoryContentSource";
import { InMemoryProgressRepository } from "@/adapters/fakes/InMemoryProgressRepository";
import { InMemoryOutbox } from "@/adapters/fakes/InMemoryOutbox";
import { FakeEventSink } from "@/adapters/fakes/FakeEventSink";
import { FakeAuthService } from "@/adapters/fakes/FakeAuthService";
import { FakeLeaderboardRepository } from "@/adapters/fakes/FakeLeaderboardRepository";
import { FakeExamGateway } from "@/adapters/fakes/FakeExamGateway";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes/FakeSpeech";
import { FakeContentReporter } from "@/adapters/fakes/FakeContentReporter";
import { createActivityService } from "@/services/activity";
import { createSyncService } from "@/services/sync";

export function createFakeServices(overrides: Partial<Services> = {}): Services {
  // Dependent fakes are built from the overridden instances so callers can inject e.g. a Dexie-backed progress repo.
  const clock = overrides.clock ?? (() => new Date().toISOString());
  const progress = overrides.progress ?? new InMemoryProgressRepository();
  const outbox = overrides.outbox ?? new InMemoryOutbox();
  const sink = overrides.sink ?? new FakeEventSink();
  const content =
    overrides.content ??
    new InMemoryContentSource([lessonFixture], [dialogueFixture], examPoolFixture, BadgesFileSchema.parse(badgesFile).badges);
  const base: Services = {
    env: { VITE_WELCOME_MESSAGE: "", VITE_USE_FAKES: true, VITE_FAKE_SPEECH: true },
    flags: { aiConversation: false, streakFreeze: false, humanAudio: false },
    clock,
    content,
    progress,
    outbox,
    sink,
    leaderboard: new FakeLeaderboardRepository(() => progress.listEvents(), { userId: "me", pseudo: "Moi", avatarEmoji: "🐉" }, clock),
    auth: new FakeAuthService(),
    exam: new FakeExamGateway(clock),
    tts: new FakeSpeechSynthesizer(),
    stt: new FakeSpeechRecognizer(),
    recorder: new FakeVoiceRecorder(),
    detectCapabilities: async () => ({ tts: true, stt: true, recorder: true }),
    conversation: {
      start: async () => {
        throw new Error("Conversation engine is wired in T13");
      },
      answer: async (state) => state,
    },
    reporter: new FakeContentReporter(),
    activity: createActivityService(),
    sync: createSyncService(),
  };
  return { ...base, ...overrides };
}
```
T07 (activity), T10 (sync) and T13 (conversation) each edit this file to plug in their real service; they list it in their **Files**.

`src/adapters/fakes/index.ts` re-exports every fake class and `createFakeServices`.

`src/app/container.ts`:
```ts
import type { Env } from "@/domain/config";
import type { Services } from "@/app/services";
import { createFakeServices } from "@/adapters/fakes";

/** Composition root. Real adapters are wired in T15; until then everything is fake. */
export function createServices(env: Env): Services {
  return createFakeServices({ env });
}
```

- [ ] **Step 8: Test helper** — `src/test/renderWithServices.tsx`

```tsx
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { createFakeServices } from "@/adapters/fakes";

export function renderWithServices(
  ui: ReactElement,
  opts: { services?: Partial<Services>; route?: string } & Omit<RenderOptions, "wrapper"> = {},
) {
  const services = createFakeServices(opts.services);
  const result = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[opts.route ?? "/"]}>{ui}</MemoryRouter>
    </ServicesProvider>,
    opts,
  );
  return { ...result, services };
}
```

- [ ] **Step 9: Verify and commit**

Run: `npm run verify` → Expected: PASS.
```bash
git add -A
git commit -m "feat(core): add ports, exercise plugin contract, fakes and service container"
```

**Acceptance criteria:** fakes and env tests pass; a probe file `src/features/probe/x.ts` importing `@/app/ServicesProvider` lints clean while one importing `@/adapters/fakes` errors (delete the probe afterwards); nothing under `src/` except tests imports `src/test/`.
