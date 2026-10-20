# Design Polish + Fight Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the blocking boss-result bug, give the app a crafted Đông Hồ / sơn mài look instead of a generic one, and turn the boss fight and the duel replay into real, punchy fights — with no performance cost on a mid-range Android phone.

**Architecture:** The audit is the spec. Fixes first; then art (hurt/KO faces, defeated boss); then a shared fight-FX kit in `src/ui/fight/` used by the duel replay and the boss fight; then app-wide embellishments (paper/lacquer texture, section titles, hero avatars everywhere, path, shop showcase, scenes for empty states, badges).

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-design-polish-audit.md` (§0 bugs, §A tells, §B embellishments, §C fight choreography, §D perf guardrails). Design system: `docs/design-system.md`, art: `docs/art-direction.md`, motion: ADR 0010 + `src/ui/motion.ts`.

## Global Constraints

- No new dependency. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, `enum`, `@ts-ignore`, no `x!` outside tests; `@/` imports; ESLint boundaries (features/ui never import adapters/content; no feature→feature; app-hooks never import features; services pure).
- UI strings in `src/i18n/fr.ts` (French, tutoiement). Tokens only. Gold = earned rewards. One primary action per screen. UI tasks load the `vietlearn-design` skill.
- **Perf guardrails (audit §D, binding):** animate only `transform` and `opacity` (exceptions: `pathLength` on ≤ 2 paths ≤ 300 ms; theme colour transitions). Never animate `filter`, `backdrop-filter`, `box-shadow`, `clip-path`, size/position props or `background-position`. No `blur()`, no `feGaussianBlur`/`feTurbulence`. No `layout`/`layoutId` and no DOM measurement during fight beats. ≤ 8 simultaneously animated elements, ≤ 12 particles inside a single `<svg>`, ≤ 30 FX nodes unmounted after each beat. No infinite loops off-screen or during fight beats (`ProfileFx` `still`). Durations only from `motion.ts` or `FIGHT` (composed from it). Interaction path ≤ 400 ms; « Continuer » / « Passer » always active. `prefers-reduced-motion` covered by a unit test per fight screen.
- **Art:** canvas `viewBox="0 0 120 160"` for characters; flat fills, outline `#1F1A17` 2.5 px rounded, closed palette, < 6 KB per file, ids prefixed by layer, no `width`/`height`; historical/legendary figures shown with respect (defeat = a bow/salute, not humiliation).
- French typography: thin non-breaking space (` `) before `? ! : ;` and inside « ».
- **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint && npm run verify` green before DONE; `npm run test:e2e` green for tasks touching flows.

## Review Focus

1. Boss lost or won → the result screen is visible (e2e), never bounced back to `/exam`.
2. Duel replay → verdict visible without scrolling at 360×780 (e2e), total ≤ 9 s.
3. Reduced motion → no `x/y/rotate/scale` animated in fight screens (unit tests).
4. Low-end perf: no new infinite loop during fights; FX nodes unmounted (tests count nodes after a beat).
5. Dark theme legibility of every new texture/surface (screenshots).

---

### Task 1: Blocking fixes (audit §0)

**Files:** `src/features/exam/ExamRunScreen.tsx` (+ tests), `e2e/boss.spec.ts`, `src/styles/index.css`, `src/i18n/fr.ts` (+ a test), screens whose headings get programmatic focus.

- [ ] **Step 1: Failing tests**: e2e « boss lost → result screen visible » and « boss won → result visible » (seed or play; reuse `e2e/boss.spec.ts` helpers); unit test reproducing the exit-animation redirect (the run screen must not `<Navigate to="/exam">` when the location changed to `/exam/result` during its exit — freeze the location captured at mount, or only redirect while still on `/exam/run`); a `fr.ts` test: no plain space before `? ! : ;` and inside « » (must be ` `/` `).
- [ ] **Step 2: Implement**: the redirect fix; programmatically focused headings (`tabIndex={-1}`) show no gold focus ring (only keyboard `:focus-visible` on interactive controls — adjust the global rule in `index.css` to exclude `[tabindex="-1"]`); fix French typography across `fr.ts`.
- [ ] **Step 3: Run** `npm run lint && npm run verify && npm run test:e2e` — green.
- [ ] **Step 4: Commit** `fix(boss): the result screen survives the exit animation; French typography; no focus ring on programmatic focus`

### Task 2: Art — expressions and the defeated boss

**Files:** create `src/assets/characters/face/{hero,char_kiem_khach,char_phap_su}_{hurt,ko}.svg`, `src/assets/characters/boss-thuy-tinh-defeated.svg` (and `docs/art/expressions-preview.png`)

- [ ] **Step 1: Draw** for each of the 3 characters a `hurt` face (eyes squeezed shut « > < », small open mouth, a sweat drop) and a `ko` face (eyes closed in calm arcs « salut », small smile — respectful), same anchors as the idle face (the face layer only; cheeks kept). Boss Thủy Tinh defeated: same composition as `boss-thuy-tinh.svg`, eyes closed, crown slightly askew, posture bowing (a salute, not humiliation).
- [ ] **Step 2: Check** with a scratch compose script (never committed): each face on each character with and without the crown/armour at 160 px and 64 px, light/dark, grayscale; the defeated boss next to the normal one. Preview sheet `docs/art/expressions-preview.png` (< 1 MB).
- [ ] **Step 3: Commit** `feat(art): hurt and KO faces, Thủy Tinh bows`

### Task 3: Fight-FX kit + duel replay overhaul (audit §C.1–C.4, duel)

**Files:** create `src/ui/fight/{fightTiming.ts,FighterSprite.tsx,InkImpact.tsx,DamageNumber.tsx,useFightBeat.ts,KoBow.tsx,index.ts}` (+ tests); modify `src/ui/characterLayers.ts` (+ `expression` param), `src/ui/Character.tsx` (`expression` prop), `src/features/duels/DuelResultScreen.tsx`, `src/features/duels/duelReplay.ts` (grouped consecutive misses), tests, `docs/design-system.md` §6.2 (add the `FIGHT` tokens, per ADR 0010).

**Interfaces:**
- `FIGHT` exactly as audit §C.1 (composed from `duration`); `characterLayers(look, expression?: "idle" | "hurt" | "ko")` uses `face/<faceId>_<expression>.svg` when it exists, else the idle face; `Character` prop `expression`; `FighterSprite({ look, facing, expression, size })` — the character moves, the paper medallion stays on the ground; `InkImpact({ kind: "hit" | "crit" | "miss", x, y })` — one `<svg>`, ≤ 6 droplets (≤ 10 crit, ≤ 12 KO), unmounted after its beat; `DamageNumber({ value, critical })`; `useFightBeat()` drives anticipation → strike → hit-stop (held keyframe) → recoil → settle; `KoBow` rotates from the feet and drops the hat layer.
- Duel replay per audit §C.2 table and rhythm: beats ≈ 530 ms + 150 ms overlap, round banners `celebrate`, consecutive misses grouped (« Raté ×3 »), after a KO the remaining blows run ×2 or are summarised, **total ≤ 9 s**, critical = vermilion seal « Chí mạng! » (no generic bolt icon), stage `h-[19rem]` so the verdict is visible without scrolling at 360×780; `ProfileFx` `still` during the replay.

- [ ] **Step 1: Failing tests**: `characterLayers` expression fallback; replay schedule total ≤ 9 s for a full 8+3 duel (pure schedule builder tested); grouped misses; FX nodes unmounted after a beat; reduced motion: no `x/y/rotate/scale` animation, verdict immediate; e2e: verdict heading visible in the viewport at 360×780 after « Passer » and after the natural end.
- [ ] **Step 2: Implement.** Key-frame screenshots (hit, crit, miss group, KO) 360 px light/dark; a CPU-throttled (4×) Chrome trace or Playwright performance check: no long task > 50 ms during beats — report numbers.
- [ ] **Step 3: Run** `npm run lint && npm run verify && npm run test:e2e` — green.
- [ ] **Step 4: Commit** `feat(fight): shared fight FX and a punchier duel replay`

### Task 4: Boss fight stage + victory moment (audit §C.2 boss, §B6, §B9)

**Files:** `src/features/exam/ExamRunScreen.tsx`, `BossPortrait.tsx`, `bossArt.ts`, `ExamResultScreen.tsx`, `ExamIntroScreen.tsx`, `src/ui/` (a `WaterDropHp` component), tests, e2e.

- [ ] **Step 1: Failing tests**: stage strip with the player's hero (`FighterSprite`, from the wallet look) and the boss; HP shown as 15 segmented water drops (no `ProgressBar`); correct answer → hit beat, a drop detaches; wrong answer → wave toward the hero + heart breaks; next exercise never waits more than 150 ms; last hit → compact KO (defeated boss art) interruptible by tap, then the result; reduced motion variant; result screen: bow → title → one counter → certificate, loot grouped in one « Butin » line; intro: legend in a scroll cartouche, rules as 3 visual tiles (drops, hearts, no-correction brush), no bullet list.
- [ ] **Step 2: Implement** reusing `src/ui/fight`. Screenshots 360 px light/dark (stage idle, hit, KO, victory, intro).
- [ ] **Step 3: Run** `npm run lint && npm run verify && npm run test:e2e` — green.
- [ ] **Step 4: Commit** `feat(boss): a fight stage with water-drop HP, a bowing Thủy Tinh and a real victory moment`

### Task 5: Global look — texture, section titles, buttons (audit §B1, §B3, §B10)

**Files:** `src/styles/tokens.css`, `src/styles/index.css`, create `src/ui/SectionTitle.tsx` (+ tests, gallery), `src/ui/Button.tsx`, `src/ui/XpCounter.tsx` (coin/Kim bài drop-in), screens using bare section `h2` (Moi, Boutique, Arène, Duels, Classement).

- [ ] Paper-fibre texture (light) and gold-fleck lacquer (dark) as a static ≤ 2 KB data-URI background on `body` + a static warm vignette in dark; `SectionTitle` (spaced gold overline, heading, 48×6 brush stroke); lacquer shine once when the primary button becomes enabled; numbers drop in on change; disabled primary = `surface-2` + `ink-muted`. Screenshots before/after of 4 screens, light/dark. Commit `feat(ui): paper and lacquer textures, brush-stroke section titles`.

### Task 6: Hero avatars everywhere + the path (audit §B2, §B4)

**Files:** `src/domain/types.ts` (`LeaderboardRow.look`), `src/adapters/supabase/SupabaseLeaderboardRepository.ts` (select `equipped`, `lookOf`), fakes (a distinct look per fake member), `src/features/leaderboard/*`, `src/features/duels/DuelsScreen.tsx`, `src/app/layouts/TabLayout.tsx` (header avatar = my hero), `src/features/home/{PathStop.tsx,pathLayout.ts,HomeScreen.tsx}`, `src/content/tree.json` or lesson content for short taglines (content schema permitting), tests.

- [ ] People are shown as heroes (`Avatar look`) everywhere; emoji stay for badges/lessons. Path: right margin + one-line tagline, brush-stroke dashed line, 1–3 gold stars per completed lesson (perfect = 3), a Hội An lantern milestone every 3 stops, current stop 1.15× with a one-shot pulse. Screenshots 360 px light/dark. Commit `feat(ui): heroes for every player and a path that reads like a journey`.

### Task 7: Shop showcase, scenes, badges (audit §B5, §B7, §B8, §A11–A12)

**Files:** `src/features/shop/ShopScreen.tsx`, `src/features/duels/ArenaScreen.tsx`, `src/styles/tokens.css` (local `[data-theme="dark"]` surface), `src/ui/EmptyState.tsx` (`scene` variant), callers (lesson failed, empty review, duel round-2 intro, boss waiting), `src/features/profile/MeScreen.tsx`, `src/features/leaderboard/PublicProfileScreen.tsx`, `src/ui/BadgeMedal.tsx`, wardrobe/duels hub label duplicates, balance tiles.

- [ ] Rare items on a forced lacquer surface with an inner gold fillet and a vermilion « Hiếm » seal, first item full-width; empty/fail screens staged with the hero centred + a Vietnamese line; earned badges first, locked ones as dashed gold inlays + « +N à découvrir » collapsible; remove duplicated labels; balance as a compact headline. Screenshots 360 px light/dark. Commit `feat(ui): showcase for rare items, staged empty states, badge inlays`.

### Task 8 (controller): ship

Final whole-branch review (Opus) with the perf guardrails; one fix wave; merge to `main`, push `main`, `main:feat/v1`; refresh the demo (`merge main into demo`, push).
