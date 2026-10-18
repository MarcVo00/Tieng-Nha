# Achievement Rewards (lot 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frames leave the shop and become badge rewards; three profile animations (`profile_fx`) are added as badge rewards; « Moi » gets a « Cadres et animations » section; past frame purchases are refunded.

**Architecture:** The shop catalogue becomes an item catalogue where `price: null` means "reward, never for sale". Badges gain an optional `reward` item id. The app's wallet replay (`walletAt`) and the server trigger (`apply_event`) apply the same rules, so old frame purchases are refused on replay (refund) and the reward lands in the inventory on the first `badge_unlocked`. A parity test pins `shop.json`/`badges.json` to the SQL catalogue.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Zustand 5, Zod 3, Dexie 4, Supabase (Postgres 15 + pgTAP), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-hero-cosmetics-design.md` (§1, §3, §4, §9; lot 1 only). Context: `docs/superpowers/specs/2026-10-14-progression-boss-energy-design.md` §5–6, `docs/art-direction.md`, `docs/design-system.md`.

## Global Constraints

- No new dependency. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, `enum`, `@ts-ignore`, no `x!` outside tests; imports via `@/`.
- `src/features/**` and `src/ui/**` never import `src/adapters/**` (tests may); no feature→feature imports; `src/services/**` pure (no React/DOM/`Date.now`/`Math.random`).
- UI strings only in `src/i18n/fr.ts` (French, tutoiement). Code, comments, commit messages in English.
- Tokens only; gold = earned rewards; one primary action per screen. UI tasks load the `vietlearn-design` skill.
- Animations: `transform` and `opacity` only, durations from `src/ui/motion.ts`; `prefers-reduced-motion` → static.
- **Catalogue after this lot (app and server identical):** `energy_refill` 30 consumable; `streak_freeze` 50 consumable maxStock 2; `frame_bronze`, `frame_jade`, `frame_son_mai`: cosmetic, slot `frame`, **price null**; `fx_ink`, `fx_lightning`, `fx_embers`: cosmetic, slot `profile_fx`, **price null**.
- **Rewards:** `streak_7`→`frame_bronze`; `ten_lessons`→`frame_jade`; `exam_passed`→`frame_son_mai`; `perfect_5` (new: 5 distinct perfect lessons)→`fx_ink`; `exam_excellent`→`fx_lightning`; `streak_30`→`fx_embers`.
- **Rules (app = server):** purchase refused without effect if item unknown, price null, coins < price, cosmetic owned, or streak_freeze with 2 in stock. First `badge_unlocked` per badge id: +10 xu and its reward is added to the inventory if absent. `item_equipped {slot, itemId|null}` accepted if itemId null, or owned at that moment AND same slot. Inventory is a set.
- A trigger NEVER raises for a business rule or a malformed payload. Never edit applied migrations (`20261010000000_init.sql`, `20261015000000_coins_shop.sql`).
- Never push to the production database (the controller does it, after asking Marc). **Commits: configured identity only (Marc); never `Co-Authored-By`, never a Claude/AI mention.** Never `--no-verify`, never push.
- `npm run verify` green before reporting DONE.

## Review Focus

1. **Replay order cases** (spec §3.4 reference case): bought + equipped a frame, then earned its badge → refunded, owned, NOT equipped; badge before the purchase → purchase refused, later equip accepted. Pinned in Task 3 tests and Task 1 pgTAP with the same expectations.
2. **Old client still running** after deploy: it may still send `item_purchased` for a frame → server refuses (price null), app replay refuses too; no coin loss. Pinned in Task 1 pgTAP ("purchase of a reward item has no effect").
3. **Unknown ids from the server** (`equipped.profile_fx` = an id this app version does not know) → avatar renders without effect, no crash. Pinned in Task 4 test.
4. **Reduced motion**: profile effects must render static, not disappear. Pinned in Task 4 test.
5. **A badge unlocked twice** (two devices) → reward once, coins once. Pinned in Task 3 test and Task 1 pgTAP.

---

### Task 1: Migration — reward catalogue, badge rewards, refund back-fill

**Files:**
- Create: `supabase/migrations/20261019000000_achievement_rewards.sql`
- Create: `supabase/tests/02_achievement_rewards_test.sql`
- Modify: `src/adapters/supabase/types.gen.ts` (leaderboard view: add `equipped: Json | null` at the end of the Row)

**Interfaces:**
- Produces (SQL): `public.shop_item(p_id text) returns table(price int, kind text, slot text)` — full catalogue, `price` null for rewards; `public.badge_reward(p_badge text) returns text` (null when none); view `public.leaderboard` gains a last column `equipped jsonb`.
- The VALUES rows of both functions use the exact one-row-per-line format of the previous migration, e.g. `('frame_bronze', null::int, 'cosmetic', 'frame'),` and `('streak_7', 'frame_bronze'),` (Task 2's parity test parses them).

- [ ] **Step 1: Write pgTAP tests** in `02_achievement_rewards_test.sql` (copy the setup helpers style of `01_coins_shop_test.sql`). Required cases:
  - `shop_item('frame_jade')` returns price null, kind cosmetic, slot frame; `shop_item('fx_embers')` slot `profile_fx`; energy_refill still 30.
  - `badge_reward('streak_7') = 'frame_bronze'`, `badge_reward('perfect_5') = 'fx_ink'`, `badge_reward('first_lesson') is null`.
  - Purchase of `frame_bronze` with 500 coins → coins unchanged, inventory unchanged.
  - First `badge_unlocked streak_7` → coins +10 and inventory contains `frame_bronze`; second identical event → coins and inventory unchanged.
  - Equip `{slot:'frame', itemId:'frame_bronze'}` after the badge → equipped.frame set; equip `{slot:'profile_fx', itemId:'frame_bronze'}` → no effect; equip `fx_ink` not owned → no effect; equip `{slot:'profile_fx', itemId:null}` → key removed.
  - Malformed payloads (`itemId` number, missing `slot`) → no error, no effect.
  - Back-fill, tested through the function `public.rewards_backfill()` (Step 3): inside the test, `alter table public.events disable trigger user` (name the actual trigger), insert the historical events with explicit `client_created_at`, set the `user_stats` row by hand to the state the OLD rules produced, re-enable the trigger, call `select public.rewards_backfill()`, assert. Cases:
    (a) events purchase frame_bronze → equip frame_bronze → badge streak_7; stats coins 0 (60 earned − 40 is irrelevant: set coins 0), inventory `{frame_bronze}`, badges `{streak_7}`, equipped `{"frame":"frame_bronze"}` ⇒ coins 40, inventory `{frame_bronze}`, equipped `{}`.
    (b) events badge streak_7 → purchase frame_bronze → equip frame_bronze; same stats ⇒ coins 40, inventory `{frame_bronze}`, equipped `{"frame":"frame_bronze"}`.
    (c) events purchase → equip, no badge; inventory `{frame_bronze}`, equipped frame_bronze ⇒ coins 40, inventory `{}`, equipped `{}`.
    (d) badges `{exam_excellent}`, no purchase, coins 7 ⇒ coins 7, inventory `{fx_lightning}`.
  - `select equipped from public.leaderboard` works and returns the jsonb.

- [ ] **Step 2: Run** `npx supabase db reset && npx supabase test db` — Expected: the new file FAILS (functions missing); `00_` and `01_` still pass.

- [ ] **Step 3: Write the migration.** Order:
  1. `set lock_timeout = '10s';`
  2. `create or replace function public.shop_item` with all 8 rows (price `null::int` for the 6 rewards).
  3. `create function public.badge_reward(p_badge text) returns text language sql immutable set search_path = ''` with the 6 rows.
  4. `revoke execute` on both from `public, anon, authenticated`.
  5. `create or replace function public.apply_event()` = the 20261015 body with exactly three changes: purchase requires `v_item.price is not null`; in the badge branch, when the badge is new, `v_id := public.badge_reward(new.ref_id); if v_id is not null and not (v_id = any(s.inventory)) then s.inventory := array_append(s.inventory, v_id); end if;`; equip unchanged (it already checks slot via `shop_item`).
  6. `create function public.rewards_backfill() returns void` (security definer, `search_path = ''`, execute revoked) doing, for every `user_stats` row: coins += 40/80/150 for each of `frame_bronze`/`frame_jade`/`frame_son_mai` in inventory (old prices, hard-coded with a comment); inventory := (inventory minus the three frames) ∪ rewards of `badges`; `equipped.frame` := result of replaying that user's `item_equipped` events with `payload->>'slot' = 'frame'` in `client_created_at, id` order, where an event counts only if `itemId` is null or the item is a reward whose `badge_unlocked` event (by `badge_reward`) has an earlier `(client_created_at, id)`; the last counted event wins; absent → key removed. Keep `equipped.profile_fx` untouched (nobody has one yet).
  7. `select public.rewards_backfill();`
  8. `create or replace view public.leaderboard with (security_invoker = true)` = previous definition + `, us.equipped` as the last column.

- [ ] **Step 4: Run** `npx supabase db reset && npx supabase test db` — Expected: all files PASS. Then `npx supabase stop`.

- [ ] **Step 5: Update `types.gen.ts`** (leaderboard Row: `equipped: Json | null` last) and run `npm run verify` — green.

- [ ] **Step 6: Commit** `feat(db): badge rewards, reward-only frames and profile effects, refund back-fill`

### Task 2: Content, schema and types

**Files:**
- Modify: `src/content/schema.ts`, `src/content/shop.json`, `src/content/badges.json`, `src/domain/types.ts`, `src/i18n/fr.ts`, `src/adapters/fakes/seed/shop.ts`, `src/content/shopParity.test.ts`, `scripts/contentChecks.ts` (+ its test) only if it validates shop/badges
- Fix compile errors where `price` was assumed a number: `src/app/EnergyIndicator.tsx`, `src/features/shop/ShopScreen.tsx` (only enough to compile; Task 5 changes the shop UI)

**Interfaces:**
- Produces: `ItemSlot = "frame" | "profile_fx"`; `ShopItem.price: number | null`; `ShopItem.theme?: string`; `BadgeDef.reward?: string`; badge rule `{ kind: "perfect_lessons"; gte: number }`; `PublicProfile.fx: string | null` (equipped profile effect); `fr.shop.items.fx_ink|fx_lightning|fx_embers` `{ name, desc, confirmName }`.

- [ ] **Step 1: Extend `shopParity.test.ts`** (TDD): (a) helper `latestMigrationDefining(fnName)` = newest file in `supabase/migrations` (sorted by name, descending) whose text contains `function public.${fnName}`; (b) shop rows parsed from it equal `shop.json` items `{id, price, kind, slot}` (regex must accept `null::int` as price → `null`); (c) `badge_reward` rows `(badge, item)` equal the `{id, reward}` pairs of `badges.json` that have a reward; (d) every `reward` names an item with `price === null`, and every `price === null` item is the reward of exactly one badge.
- [ ] **Step 2: Run** `npx vitest run src/content/shopParity.test.ts` — Expected: FAIL.
- [ ] **Step 3: Update schemas**: `ShopItemSchema.price` → `z.number().int().min(1).nullable()`, `slot` enum `["frame","profile_fx"]`, optional `theme: z.string().regex(/^[a-z0-9_]+$/)`; `BadgeDefSchema` optional `reward: z.string().regex(/^[a-z0-9_]+$/)`; add rule `perfect_lessons {gte ≥ 1}`.
- [ ] **Step 4: Update content**: `shop.json` = the 8 items of Global Constraints (frames price null; fx items `kind: "cosmetic"`, `slot: "profile_fx"`, `price: null`); `badges.json`: add `reward` to the 5 existing badges and add `{ "id": "perfect_5", "title": "Main de maître", "description": "Réussis 5 leçons différentes sans aucune erreur.", "icon": "🖌️", "rule": { "kind": "perfect_lessons", "gte": 5 }, "reward": "fx_ink" }` after `perfect_lesson`. `fr.shop.items`: `fx_ink` « Volutes d'encre », `fx_lightning` « Éclairs », `fx_embers` « Braises » (desc: « Animation de profil. »); frame descs → « Cadre de profil, visible au classement. ».
- [ ] **Step 5: Types and seeds**: `ItemSlot`, `PublicProfile.fx` (fakes return null; `SupabaseLeaderboardRepository.getPublicProfile` selects `equipped` and maps `fx` = `equipped.profile_fx` when a string, else null — unknown shape → null). Fake shop seed mirrors `shop.json`. Make the app compile (`price ?? 0` is NOT acceptable in purchase paths: filter `price !== null` where items are listed for sale).
- [ ] **Step 6: Run** `npm run verify` — green (parity test passes against Task 1's migration).
- [ ] **Step 7: Commit** `feat(content): reward-only frames and profile effects, perfect_5 badge, badge rewards`

### Task 3: Wallet and badge rules

**Files:**
- Modify: `src/services/wallet.ts`, `src/services/wallet.test.ts`, `src/services/badges.ts`, `src/services/badges.test.ts` (create if absent), `src/services/activity.ts`, `src/services/activity.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `walletAt(events: readonly AppEvent[], shop: readonly ShopItem[], badges: readonly BadgeDef[]): Wallet` (new third parameter); `purchasable(...)` returns null when `item.price === null`; `rewardItem(badges: readonly BadgeDef[], badgeId: string): string | null`. `activity.getWallet()` loads badges via `content.getBadges()` and passes them.

- [ ] **Step 1: Write failing tests** in `wallet.test.ts`:
  - `purchase of a reward-priced item is refused` (coins 500 → unchanged, inventory empty).
  - `first badge_unlocked adds its reward once` (two `streak_7` events → coins 10, inventory `["frame_bronze"]`).
  - Reference case A (spec §3.4): 3 perfect lessons (45 xu) → purchase frame_bronze → equip frame_bronze → badge streak_7 ⇒ coins 55, inventory `["frame_bronze"]`, `equipped` `{}`.
  - Reference case B: badge streak_7 → purchase frame_bronze → equip ⇒ coins 10 + lesson coins, inventory `["frame_bronze"]`, equipped `{ frame: "frame_bronze" }`.
  - Reference case C: purchase + equip, no badge ⇒ no deduction, inventory `[]`, equipped `{}`.
  - `equip profile_fx only for an owned fx item` (fx_ink after perfect_5 badge ✓; frame item in profile_fx slot ✗; null removes).
  - In `badges.test.ts`: `perfect_lessons counts distinct perfect lessons` (4 → not unlocked, 5 → unlocked).
- [ ] **Step 2: Run** `npx vitest run src/services` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement**: `purchasable` null-price guard; `walletAt` applies `rewardItem` on the first `badge_unlocked` per id (set semantics); `badges.ts` `perfect_lessons` → `s.perfectLessons.length >= rule.gte` (`perfectLessons` already holds distinct ids — check `progress.ts`, dedupe if not); `activity` passes badges everywhere `walletAt` is called (`purchase`, `equip`, `coinsGained`).
- [ ] **Step 4: Run** `npm run verify` — green.
- [ ] **Step 5: Commit** `feat(wallet): badge rewards in the replay, reward items never for sale`

### Task 4: UI primitives — profile effects and reward caption

**Files:**
- Create: `src/ui/ProfileFx.tsx`
- Modify: `src/ui/Avatar.tsx`, `src/ui/BadgeMedal.tsx`, `src/ui/index.ts`, `src/ui/Gallery.tsx`, `src/ui/ui.test.tsx`

**Interfaces:**
- Produces: `Avatar` prop `fx?: string | null | undefined` (known `fx_*` id → wraps the avatar in `<ProfileFx id>`; unknown/null → unchanged, no wrapper); `ProfileFx({ id, children }: { id: "fx_ink" | "fx_lightning" | "fx_embers"; children: ReactNode })`; `BadgeMedal` prop `reward?: string` (already-localised caption shown under the title, gold ink, e.g. « + Cadre jade »).
- Effect design (spec §4.1): `fx_ink` 3 ink swirls (`#1F1A17` 40 % + vermillon `#B23A2A`) slowly rotating around the medallion; `fx_lightning` 2–3 short bolts (`#D9A93A` + `#F4E4C4`) flashing in turn around the frame; `fx_embers` 6–8 embers (`#B23A2A`, `#D9A93A`) rising and fading behind. Inline SVG, `aria-hidden`, no `filter`/gradient, `pointer-events: none`, sized relative to the avatar (works for `md` and `lg`). These pigment hexes are character colours (art-direction §2): add them as Tailwind/CSS tokens if the token rule requires it (follow how `frame-*` tokens were added).

- [ ] **Step 1: Write failing tests** in `ui.test.tsx`: `Avatar with fx_embers renders the effect layer` (`data-fx="fx_embers"`); `Avatar with an unknown fx renders no effect layer`; `ProfileFx under reduced motion renders static` (mock `matchMedia('(prefers-reduced-motion: reduce)')` → no element with an animation, the SVG still present — follow the reduced-motion pattern already used in `src/ui`); `BadgeMedal shows the reward caption`.
- [ ] **Step 2: Run** `npx vitest run src/ui` — FAIL.
- [ ] **Step 3: Implement** with motion 11 (`useReducedMotion`) and the `src/ui/motion.ts` durations; add the three effects to `/__ui` Gallery (light and dark).
- [ ] **Step 4: Run** `npm run verify` — green. Screenshot the gallery in both themes (dev server `vietlearn-dev-fakes`, route `/__ui`) and attach paths in the report; check readability at `md` size.
- [ ] **Step 5: Commit** `feat(ui): profile effects (ink, lightning, embers) and badge reward caption`

### Task 5: Features — « Cadres et animations », shop, done screens, public profile

**Files:**
- Create: `src/features/profile/RewardsSection.tsx`
- Modify: `src/features/profile/MeScreen.tsx`, `src/features/shop/ShopScreen.tsx`, `src/features/lessons/LessonDoneScreen.tsx`, `src/features/conversation/DialogueScreen.tsx`, `src/features/review/ReviewRunScreen.tsx`, `src/features/exam/ExamResultScreen.tsx`, `src/features/leaderboard/PublicProfileScreen.tsx`, `src/i18n/fr.ts`, and their tests (`profile`, `shop`, `lessons`, `conversation`, `review`, `exam`, `leaderboard`)

**Interfaces:**
- Consumes: `activity.equip(slot, itemId)`, `useAppState(s => s.wallet)`, `content.getBadges()`, `content.getShop()`, `Avatar fx`, `BadgeMedal reward`, `PublicProfile.fx`.
- Produces: `fr.rewards = { title: "Cadres et animations", hint: "Les cadres et animations se gagnent avec les succès.", lockedBy: (badgeTitle: string, badgeDesc: string) => \`Débloqué par « ${badgeTitle} » : ${badgeDesc}\`, gained: (name: string) => \`+ ${name}\`, equip: "Équiper", unequip: "Retirer", equipped: "Équipé", error: "Impossible de changer pour le moment. Réessaie." }` (exact copy may be polished; keys fixed).

- [ ] **Step 1: Write failing tests**:
  - Profile: `rewards section lists 6 rewards, owned ones equippable` (wallet inventory `["frame_jade"]` → jade card has « Équiper », 5 cards show their `lockedBy` text); `equipping a frame calls activity.equip("frame", id)` and the avatar header shows it; `one frame and one effect at a time` (equipping another frame replaces).
  - Shop: `reward items are not for sale` (no frame/fx card, `fr.rewards.hint` visible with a link to « Moi »).
  - Done screens (one test each in lessons, conversation, review, exam): a new badge with a reward shows `fr.rewards.gained(<item name>)`.
  - Public profile: `fx` from the repository renders the effect (`data-fx`).
- [ ] **Step 2: Run** `npx vitest run src/features` — FAIL.
- [ ] **Step 3: Implement**:
  - `RewardsSection` in « Moi », placed after the badges section: grid of the 6 reward items (order: frames by badge difficulty bronze → jade → sơn mài, then ink → lightning → embers); each card previews the player's `Avatar` with that frame/effect (locked: muted + lock icon + `lockedBy`); tapping an owned card toggles equip/unequip through `activity.equip`, button disabled while busy, `fr.rewards.error` toast on failure; then `useRefreshProgress()`.
  - « Moi » header avatar gets `fx={wallet.equipped.profile_fx}` (size lg).
  - Shop: list only items with `price !== null`; remove the frames section; add the hint line linking to `/me`.
  - Done screens: pass `reward={b.reward ? fr.rewards.gained(fr.shop.items[b.reward]?.name ?? "") : undefined}` (omit when the name is unknown).
  - Public profile: `<Avatar … fx={profile.fx} />`.
- [ ] **Step 4: Run** `npm run verify` — green. Complete `.claude/skills/vietlearn-design/references/review-checklist.md` in the report, with screenshots of « Moi » (light + dark, 375 px).
- [ ] **Step 5: Commit** `feat(profile): frames and profile effects unlocked by achievements`

### Task 6: End-to-end

**Files:**
- Modify: `e2e/shop.spec.ts`, `e2e/helpers.ts`

**Interfaces:**
- Produces: `seedBadges(page: Page, ids: string[]): Promise<void>` in `helpers.ts` (appends `badge_unlocked` events with the same IndexedDB seeding approach as `seedLessonsCompleted`).

- [ ] **Step 1: Replace** the frame-purchase test with: `a badge reward frame can be equipped from Moi` — onboard, `seedBadges(["streak_7"])`, reload, open « Moi », bronze card → « Équiper », header avatar has `data-frame="frame_bronze"`. Add `the shop no longer sells frames` — open the shop, no `fr.shop.items.frame_bronze.name`, `fr.rewards.hint` visible.
- [ ] **Step 2: Run** `npm run test:e2e` — all pass (report the count).
- [ ] **Step 3: Commit** `test(e2e): equip a badge reward frame; frames are not for sale`

### Task 7 (controller only): production

1. Ask Marc in chat for the `db push`; wait for yes.
2. `npx -y supabase@2.121.0 db query --linked` — count `item_purchased` for frames (expected 0 on 2026-10-18; if > 0, compare one user's server wallet with the app replay after push).
3. `npx -y supabase@2.121.0 db push --linked --dry-run` (only `20261019000000_achievement_rewards.sql`), then the real push, then `migration list --linked`.
4. Fast-forward merge to `main`, push `main` and `main:feat/v1`, delete the branch; check the Netlify bundle contains `Cadres et animations`.
