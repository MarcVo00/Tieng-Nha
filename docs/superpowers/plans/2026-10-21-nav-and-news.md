# Navigation (Arène, Boutique) and « Nouveautés » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put duels and the shop one tap away in the bottom tab bar, and show the app versions with what changed.

**Architecture:** The bottom bar becomes five tabs — Apprendre, Révision, **Arène**, **Boutique**, Moi (decided with Marc on 2026-10-21; six would be cramped at 360 px). « Arène » groups the leaderboard and the duels behind a segmented control (Classement | Duels) shared by both screens; the Kim bài shop keeps its route `/arena`, renamed « Boutique d'arène » and reached from Duels. « Boutique » opens the xu shop. Versions come from `package.json` (exposed at build time) and a bundled `src/content/changelog.json`; « Moi » shows « Nouveautés · v1.5.0 » with a red dot until the newest version has been seen.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Zod 3, Vitest, Playwright.

**Spec:** this plan (agreed with Marc in chat on 2026-10-21: « des onglets … pour les duels et la boutique », « un endroit qui montre les versions »; layout proposal « Parfait »).

## Global Constraints

- No new dependency. TS strict; `@/` imports; ESLint boundaries (features never import adapters/content directly — content goes through `ContentSource`; no feature→feature imports; app-hooks never import features).
- UI strings in `src/i18n/fr.ts` (French, tutoiement, ` ` before `? ! : ;`). Tokens only; one primary action per screen. UI tasks load `vietlearn-design`.
- Tab order and labels (exact): « Apprendre » `/`, « Révision » `/review`, « Arène » `/leaderboard` (active on `/leaderboard`, `/duels`, `/arena`, `/u/:userId`), « Boutique » `/shop`, « Moi » `/me`. Keep the review due-count badge; the Arène tab shows a badge with the count of duels « à toi de jouer » (same source as the home banner); the Moi tab shows a dot when there is an unseen version.
- Segmented control « Classement | Duels » at the top of both `/leaderboard` and `/duels` (links, `aria-current`), replacing today's separate « Duels » entry on the leaderboard header. The Kim bài shop title becomes « Boutique d'arène » (route unchanged), reached from Duels; its back link goes to Duels.
- Version: `package.json` `version` = **1.5.0**; expose it with Vite `define` (`__APP_VERSION__`) typed in `src/vite-env.d.ts`.
- Changelog (`src/content/changelog.json`, schema in `src/content/schema.ts`, loaded through `ContentSource.getChangelog()`): newest first, each `{ version, date (YYYY-MM-DD), title, items: string[] }`, French, short, written for Mathias (no technical jargon). Entries (exact versions/dates/titles; items may be lightly polished):
  - 1.5.0 · 2026-10-21 · « Combats et nouveau look » — des combats animés en duel et contre Thủy Tinh ; un style papier et laque ; les héros de chaque joueur partout ; un parcours avec étoiles et lanternes ; une vitrine pour les objets rares ; onglets Arène et Boutique ; cette page Nouveautés.
  - 1.4.0 · 2026-10-20 · « Duels et arène » — défier un membre en deux manches (QCM chronométré puis oral) ; les Kim bài, gagnés seulement en duel ; la boutique d'arène (bandeau de Tây Sơn, bâton de Bình Định, tenue de lutteur).
  - 1.3.0 · 2026-10-19 · « Ton héros » — cadres et animations débloqués par les succès ; les cosmétiques « Légendes sombres » à essayer ; deux personnages à acheter.
  - 1.2.0 · 2026-10-17 · « Xu et boutique » — gagner des xu en apprenant ; recharge d'énergie et gel de série.
  - 1.1.0 · 2026-10-15 · « L'arbre et le boss » — l'arbre de leçons, le boss Thủy Tinh, l'énergie ; validation orale plus rapide ; exercices mélangés.
  - 1.0.0 · 2026-10-11 · « Première version » — 10 leçons du Sud, l'oral, les dialogues, le classement en famille.
- « Nouveautés » screen `/news` (tab route, back to Moi): versions newest first, current version marked « Ta version ». Opening it stores the latest seen version in `localStorage` (`tn-seen-version`, try/catch); the dot shows when the stored value differs from the newest changelog version.
- Perf: no new animation beyond the existing tab indicator; reduced motion respected.
- **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint && npm run verify && npm run test:e2e` green before DONE.

## Review Focus

1. Deep links and back navigation still work (`/duels`, `/arena`, `/u/:id`, duel result → back to Duels).
2. e2e that navigated via the old « Duels » header entry or « Moi → Boutique » still pass (update selectors to the new tabs).
3. The tab bar fits at 320 px (5 labels, no wrap, ≥ 44 px targets).
4. Storage blocked → no crash, dot simply shown.
5. Changelog parse failure → the « Nouveautés » row still renders (no dot) and the screen shows a calm error.

---

### Task 1: Tabs, Arène segments, Boutique d'arène

**Files:** `src/app/layouts/TabLayout.tsx`, `src/ui/TabBar.tsx` (dot support if needed), `src/ui/SegmentedNav.tsx` (new, + test), `src/features/leaderboard/LeaderboardScreen.tsx`, `src/features/duels/DuelsScreen.tsx`, `src/features/duels/ArenaScreen.tsx`, `src/i18n/fr.ts`, tests, e2e selectors.

- [ ] Failing tests: tab bar has the five tabs in order with correct hrefs; « Arène » active on `/duels`, `/arena`, `/u/x`; Arène badge = duels to play; segmented control on both screens with `aria-current`; old header « Duels » entry gone; Boutique d'arène title + back to Duels; 320 px fit (unit: no wrap classes; e2e screenshot).
- [ ] Implement; screenshots 360 + 320 px light/dark (tab bar, Classement, Duels, Boutique d'arène).
- [ ] `npm run lint && npm run verify && npm run test:e2e` green. Commit `feat(nav): Arène and Boutique tabs`.

### Task 2: Versions and « Nouveautés »

**Files:** `package.json`, `vite.config.ts`, `src/vite-env.d.ts`, `src/content/changelog.json`, `src/content/schema.ts`, `src/ports/ContentSource.ts`, `src/adapters/content/StaticContentSource.ts`, fakes, `src/features/profile/NewsScreen.tsx` (new) + `MeScreen.tsx` row, `src/app/router.tsx` (`/news`), `src/app/layouts/TabLayout.tsx` (Moi dot), `src/i18n/fr.ts`, tests.

- [ ] Failing tests: schema validates the changelog (newest first, semver, dates); `__APP_VERSION__` equals `package.json`; Moi row « Nouveautés · v1.5.0 » with dot when unseen, no dot after opening `/news`; storage throwing → no crash; changelog load failure → calm error; the screen marks « Ta version ».
- [ ] Implement; screenshots 360 px light/dark.
- [ ] `npm run lint && npm run verify && npm run test:e2e` green. Commit `feat(news): versions and what changed`.

### Task 3 (controller): ship

Review, merge to `main`, push `main` and `main:feat/v1`, refresh `demo`.
