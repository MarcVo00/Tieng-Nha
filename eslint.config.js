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
      "import/resolver": { typescript: { project: "./tsconfig.app.json" } },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "di", pattern: "src/app/{ServicesProvider.tsx,services.ts,appState.ts}", mode: "file" },
        { type: "app-hook", pattern: "src/app/use*.ts", mode: "file" },
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
          { from: "root", allow: ["root", "app", "di", "styles", "i18n", "ui"] },
          { from: "di", allow: ["di", "ports", "domain", "services", "content"] },
          { from: "app-hook", allow: ["app-hook", "di", "domain", "services", "ports", "ui", "i18n"] },
          { from: "app", allow: ["di", "app", "app-hook", "feature", "exercise-registry", "exercise", "ui", "services", "ports", "domain", "adapters", "content", "i18n", "styles"] },
          { from: "feature", allow: [["feature", { name: "${from.name}" }], "di", "app-hook", "exercise-registry", "ui", "services", "ports", "domain", "i18n"] },
          { from: "exercise-registry", allow: ["exercise", "exercise-registry", "ui", "services", "ports", "domain", "content", "i18n"] },
          { from: "exercise", allow: [["exercise", { name: "${from.name}" }], "di", "exercise-registry", "ui", "services", "ports", "domain", "content", "i18n"] },
          { from: "ui", allow: ["ui", "domain", "i18n"] },
          { from: "services", allow: ["services", "ports", "domain", "content"] },
          { from: "ports", allow: ["ports", "domain"] },
          { from: "domain", allow: ["domain", "content"] },
          { from: "adapters", allow: [["adapters", { name: "${from.name}" }], "di", "services", "ports", "domain", "content"] },
          // The fake service bundle composes the scripted conversation engine over the fake content.
          { from: [["adapters", { name: "fakes" }]], allow: [["adapters", { name: "conversation" }]] },
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
