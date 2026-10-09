# Phase 5 — E2E, CI, deployment, device QA (T33–T36)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read **Global Constraints** first.
> T35 and T36 require Marc (accounts, real devices). The agent prepares everything and gives Marc an exact checklist.

---

### Task T33: End-to-end tests (Playwright, fakes)

**Spec:** §10 · **Depends on:** all of phase 3 and 4

**Files:** Create `playwright.config.ts`, `e2e/helpers.ts`, `e2e/onboarding-lesson.spec.ts`, `e2e/offline-sync.spec.ts`, `e2e/exam-locked.spec.ts`

- [ ] **Step 1: Config** — `playwright.config.ts`
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", locale: "fr-FR", timezoneId: "Europe/Paris" },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_FAKES: "true", VITE_FAKE_SPEECH: "true", VITE_WELCOME_MESSAGE: "Joyeux anniversaire !" },
    timeout: 180_000,
  },
});
```
Install browsers once: `npx playwright install --with-deps chromium webkit`.

- [ ] **Step 2: Helper** — `e2e/helpers.ts`: `onboard(page)` performs welcome → invite `TEST-CODE` + `test@example.com` → OTP `123456` → pseudo `Marc` + first emoji → device step "Continuer" → install step "Plus tard"; then expects URL `/`.

- [ ] **Step 3: Specs**
  - `onboarding-lesson.spec.ts`: `onboard`; the first lesson stop "Les 6 tons & bonjour" is available; open it; go through the vocab deck (click "Suivant" until "C'est parti !"). Answer the exercises without knowing the right answers (no test-only hooks in production UI): write a helper `playThrough(page)` that loops — if a "Vérifier" button exists, click the first choice / first tone button / every bank tile in displayed order, then "Vérifier"; if a mic button exists, click it (the fake recognizer returns "xin chào"); then click "Continuer" — until the done screen ("Bien joué" / "Giỏi quá") or the failed panel ("Plus de vies") is visible. Assert one of them is visible. Then open `/leaderboard` and assert "Marc" is listed.
  - `offline-sync.spec.ts`: `onboard`; `context.setOffline(true)`; complete the vocab deck and exercises of lesson 1 the same way until done or failed (if failed, click "Réessayer" once more — the loop helper handles both); assert the app still navigates (offline PWA); `context.setOffline(false)`; reload; assert no error screen.
  - `exam-locked.spec.ts`: `onboard`; open `/exam`; assert the locked message "0/10".

- [ ] **Step 4: Run** `npm run test:e2e` → all pass on both projects. **Commit:** `test(e2e): add Playwright flows for onboarding, lesson, offline and exam lock`

---

### Task T34: CI, Lighthouse, Netlify config, Supabase keep-alive

**Spec:** §5.5, §10 · **ADR:** 0009 · **Depends on:** T33

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/keepalive.yml`, `lighthouserc.json`, `netlify.toml`, `public/_redirects`; Modify `package.json` (script `"test"` uses strict content: `vitest run && tsx scripts/validate-content.ts --strict`)

- [ ] **Step 1: `ci.yml`**
```yaml
name: CI
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run verify
        env: { VITE_USE_FAKES: "true" }
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run test:e2e
      - run: npx --yes @lhci/cli@0.14 autorun
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase db start
      - run: supabase test db
```
- [ ] **Step 2: `lighthouserc.json`**
```json
{
  "ci": {
    "collect": { "startServerCommand": "npm run preview", "url": ["http://localhost:4173/welcome"], "numberOfRuns": 1, "settings": { "preset": "desktop" } },
    "assert": { "assertions": {
      "categories:performance": ["error", { "minScore": 0.85 }],
      "categories:accessibility": ["error", { "minScore": 0.95 }],
      "categories:best-practices": ["warn", { "minScore": 0.9 }],
      "installable-manifest": "error",
      "service-worker": "warn"
    } }
  }
}
```
(Lighthouse 12 removed the PWA category; `installable-manifest` remains the meaningful check.)
- [ ] **Step 3: `keepalive.yml`**
```yaml
name: Supabase keep-alive
on:
  schedule: [{ cron: "0 6 */3 * *" }]
  workflow_dispatch: {}
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS "${{ secrets.SUPABASE_URL }}/rest/v1/groups?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" -o /dev/null
```
(An anonymous call returns `[]` because of RLS — it still counts as activity.)
- [ ] **Step 4: Netlify** — `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "20"
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```
`public/_redirects`: `/*    /index.html   200` (SPA routing).
- [ ] **Step 5:** push a branch, confirm both CI jobs pass. **Commit:** `ci: add CI, Lighthouse, keep-alive and Netlify config`

---

### Task T35: Production deployment runbook (with Marc)

**Spec:** §5, §12 · **Depends on:** T34

**Files:** Create `docs/deploy.md` (the runbook below, completed with real URLs once known — never write keys in it).

The agent writes `docs/deploy.md` with these exact steps and walks Marc through them; actions that need Marc's accounts are performed **by Marc**:

1. **GitHub**: create a private repo `vietlearn`; `git remote add origin …`; `git push -u origin main`.
2. **Supabase prod**: create project `vietlearn-prod` (region Europe West / Paris or Frankfurt). Then locally:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   In the dashboard SQL editor, create the real group (Marc chooses the code and shares it with the family):
   ```sql
   insert into public.groups (name, invite_code) values ('Famille', '<CODE-CHOISI>');
   ```
3. **Auth settings (dashboard)**: Authentication → Providers → Email: enable, "Confirm email" off, OTP length 6. Email templates "Magic Link" **and** "Confirm signup": paste `supabase/templates/otp.html` (must contain `{{ .Token }}`). URL configuration: Site URL = Netlify URL; add it to Redirect URLs.
4. **E-mail sending limit**: Supabase's built-in mailer only sends a few e-mails per hour — enough to test, risky when the whole family signs up on the birthday. Recommended (free): create a Brevo or Resend account, then Authentication → SMTP Settings with their SMTP credentials (sender e.g. `vietlearn@<domain or provider sandbox>`). If skipped, onboard people a few at a time.
5. **Netlify**: "Add new site → Import from GitHub" → repo; build settings come from `netlify.toml`. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API → anon public), `VITE_WELCOME_MESSAGE` (the birthday message), `VITE_USE_FAKES=false`, `VITE_FAKE_SPEECH=false`. Deploy. Optionally rename the site (`vietlearn-<name>.netlify.app`).
6. **GitHub secrets** for keep-alive: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
7. **Smoke test**: open the Netlify URL on a computer, onboard with Marc's e-mail and the real invite code, finish lesson 1, check the leaderboard row appears in Supabase (`select * from leaderboard`).

**Acceptance:** `docs/deploy.md` committed; production URL reachable; smoke test done by Marc. **Commit:** `docs: add deployment runbook`

---

### Task T36: Real-device QA and gift readiness (with Marc)

**Depends on:** T35

**Files:** Create `docs/qa-checklist.md` (checklist below with a column per device), fix-up commits for any bug found (each bug → a new small task with a failing test first).

Checklist (Marc runs it on the birthday person's likely device + one other):

| # | Check | iPhone (Safari → installed) | Android (Chrome → installed) | PC (Chrome) |
|---|---|---|---|---|
| 1 | Install from the onboarding instructions; icon and name correct | | | |
| 2 | OTP e-mail received within 1 min; code works inside the installed app | | | |
| 3 | Device test: Vietnamese voice present (else follow the help text and re-test) | | | |
| 4 | Speech recognition: speak "Xin chào" → recognised (or fallback recorder offered) | | | |
| 5 | Lesson 1 complete; XP, streak and badge toast shown; transitions smooth | | | |
| 6 | Flight mode: lesson 2 playable; back online → sync indicator clears | | | |
| 7 | Second account (another family member) appears in the leaderboard; podium correct | | | |
| 8 | Dialogue d01 by voice and by tap | | | |
| 9 | Dark mode (system) readable; diacritics never clipped | | | |
| 10 | New deploy → "Nouvelle version disponible" banner → update works | | | |
| 11 | Exam locked before 10 lessons (temporarily test the full exam on a test account by finishing lessons, or skip) | | | |
| 12 | Certificate PNG download works (if exam passed) | | | |

Gift prep: choose the invite code; set `VITE_WELCOME_MESSAGE`; pre-create the group; optionally print a card with the URL + QR code + invite code.

**Acceptance:** all rows ✓ on at least iPhone or Android + PC, or documented known issues accepted by Marc. **Commit:** `docs: add QA checklist results`
