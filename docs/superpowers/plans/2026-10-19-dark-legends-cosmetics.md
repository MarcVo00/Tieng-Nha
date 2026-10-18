# Dark Legends Cosmetics (lot 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hero becomes a layered character that wears four buyable cosmetics of the theme « Légendes sombres », tried on in the shop, worn on the path, in « Moi » and on the public profile.

**Architecture:** Each layer is a standalone SVG file on the common 120×160 canvas (`src/assets/characters/<slot>/<id>.svg`); a `Character` UI primitive stacks them in a fixed order, with the base hero's defaults for empty slots. The catalogue gains four cosmetics (slots `hat`, `outfit`, `accessory`, `aura`) in `shop.json` and in a new migration; the existing purchase/equip rules already handle any slot. `Avatar` gains a `look` prop that shows the hero instead of the emoji, so frames and profile effects keep working around it.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Zustand 5, Zod 3, Supabase (Postgres 15 + pgTAP), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-hero-cosmetics-design.md` (§3.1–3.5, §5, §7, §9; lot 2 only). Art rules: `docs/art-direction.md` §2–4, §7.

## Global Constraints

- No new dependency. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, `enum`, `@ts-ignore`, no `x!` outside tests; imports via `@/`.
- `src/features/**`, `src/ui/**` never import `src/adapters/**` or `src/content/**` (tests may); no feature→feature imports; `src/services/**` pure.
- UI strings only in `src/i18n/fr.ts` (French, tutoiement). Code, comments, commits in English. Tokens only; gold = earned rewards; one primary action per screen. UI tasks load `vietlearn-design`.
- **New catalogue items (app = server), theme `legendes_sombres`, kind `cosmetic`:** `hat_thuy_tinh` slot `hat` 60 · `aura_waves` slot `aura` 80 · `outfit_son_tinh` slot `outfit` 90 · `acc_thuan_thien` slot `accessory` 120. Existing items unchanged.
- **Slots:** `ItemSlot = "frame" | "profile_fx" | "hat" | "outfit" | "accessory" | "aura"`. Empty `hat`/`outfit`/`accessory` = the hero's defaults (nón lá, áo bà ba, nothing in hand); empty `aura` = nothing.
- **Layer order (bottom → top):** aura, shadow, base, face, outfit, hat, accessory. Canvas `viewBox="0 0 120 160"`; anchors: head centre (60,70) r 22, shoulders y 92, hem y 146, hands (28,122) and (92,122).
- **Art:** flat fills only, black outline `#1F1A17` 2.5 px, rounded joins, no `filter`/gradient/embedded image, one textured zone per item at most, closed palette of art-direction §2, < 6 KB per file, ids prefixed by the layer. Readable at 40 px, in dark theme (on the paper medallion), in grayscale.
- Purchase then auto-equip = two events `item_purchased` then `item_equipped`. Never edit applied migrations. Never push to production (controller asks Marc first). **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run verify` green before DONE.

## Review Focus

1. **Unknown or future ids** in `equipped` (from the server or an old client): `Character` falls back to the default layer for that slot, never a broken image. Pinned in Task 3 tests.
2. **An old client** still running when the new items exist: it cannot list them (its bundled catalogue) and the server accepts purchases only through `shop_item` — nothing to do, but the parity test must pass. Pinned in Task 1.
3. **Buy succeeds, auto-equip fails** (equip refused or throws): the item stays owned, the UI says bought and offers « Équiper ». Pinned in Task 5 test.
4. **Small sizes**: the 46 px path token and 40 px readability — the hat and aura must not be clipped by the medallion in a way that hides them. Pinned in Task 2 screenshots and Task 4 test of the token's look.
5. **Try-on of an unowned item** must never send an event. Pinned in Task 5 test.

---

### Task 1: Catalogue — four cosmetics (migration + content)

**Files:**
- Create: `supabase/migrations/20261020000000_dark_legends.sql`, `supabase/tests/03_dark_legends_test.sql`
- Modify: `src/content/shop.json`, `src/content/schema.ts`, `src/domain/types.ts` (`ItemSlot`), `src/i18n/fr.ts` (`fr.shop.items` + `fr.shop.themes`), `src/adapters/fakes/seed/shop.ts`, `src/content/shopParity.test.ts` (only if needed), `src/adapters/supabase/supabase.test.ts`

**Interfaces:**
- Produces: `ItemSlot` above; `ShopItemSchema.slot` enum with the six slots; `shop.json` items with `"theme": "legendes_sombres"` on the four new ones; `fr.shop.themes = { legendes_sombres: "Légendes sombres" }`; `fr.shop.items.<id> = { name, desc, confirmName }` for the four (names: « Couronne des marées », « Vagues sombres », « Armure de Sơn Tinh », « Thuận Thiên, l'épée du lac »).

- [ ] **Step 1: pgTAP** (`03_dark_legends_test.sql`, style of `02_`): `shop_item` returns the four rows with exact price/kind/slot; buying each with enough coins deducts the price and adds it to the inventory; buying an owned one is refused; equip `{slot:'hat', itemId:'hat_thuy_tinh'}` when owned sets `equipped.hat`; equip it into `outfit` → no effect; `rewards_backfill` no longer exists (`hasnt_function`).
- [ ] **Step 2: Run** `npx supabase db reset && npx supabase test db` — `03_` FAILS.
- [ ] **Step 3: Migration**: `set lock_timeout = '10s';` · `create or replace function public.shop_item` = previous 8 rows + the 4 new ones (same one-row-per-line format) · `drop function public.rewards_backfill();` · re-apply the same `revoke execute` on `shop_item`.
- [ ] **Step 4: Run** the DB tests — all PASS; `npx supabase stop`.
- [ ] **Step 5: Content + types** (parity test must pass): `shop.json`, schema slot enum, `ItemSlot`, fakes seed, `fr.ts`. Also add the deferred adapter test: `getPublicProfile` maps `equipped: {profile_fx:"fx_ink"}` → `fx: "fx_ink"`, `{}` → null, malformed (array, string, number) → null.
- [ ] **Step 6: Run** `npm run verify` — green.
- [ ] **Step 7: Commit** `feat(shop): dark legends cosmetics in the catalogue, drop the one-shot back-fill`

### Task 2: Art — hero layers and the four cosmetics

**Files:**
- Create: `src/assets/characters/shadow/hero.svg`, `base/hero.svg`, `face/hero.svg`, `outfit/ao_ba_ba.svg`, `hat/non_la.svg`, `hat/hat_thuy_tinh.svg`, `aura/aura_waves.svg`, `outfit/outfit_son_tinh.svg`, `accessory/acc_thuan_thien.svg` (all under `src/assets/characters/`)
- Create: `docs/art/legendes-sombres-preview.png` (composite preview, see Step 3)
- Do not delete `src/assets/characters/hero-base.svg` (Task 4 stops using it; Task 4 deletes it)

**Interfaces:**
- Produces: one full-canvas SVG per layer (`viewBox="0 0 120 160"`, no `width`/`height` attributes, transparent background), drawn so that stacking them in the layer order reproduces `hero-base.svg` exactly for the defaults.
- Descriptions (spec §5.2): **Couronne des marées** (`hat`) — Thủy Tinh's crown, indigo and black, points shaped like wave crests, sits on the head (replaces the nón lá); **Vagues sombres** (`aura`) — an arc of indigo waves rising behind the hero, the item's single textured zone (wave pattern), must stay inside the canvas; **Armure de Sơn Tinh** (`outfit`) — dark green breastplate in rock strata, mountain-shaped pauldrons, covers the same body area as the áo bà ba; **Thuận Thiên** (`accessory`) — jade blade with a vàng hoè edge and hilt, held vertical in the right hand (92,122), blade pointing up. Dark-fantasy/shonen spirit through dominant indigo/green/black and angular silhouettes, within the closed palette.

- [ ] **Step 1: Split** `hero-base.svg` into the five default layer files (shadow, base, face, outfit `ao_ba_ba`, hat `non_la`), copying its paths verbatim; the hatch pattern goes into `non_la.svg` with an id prefixed `hat-`.
- [ ] **Step 2: Draw** the four cosmetics.
- [ ] **Step 3: Verify** with a throwaway script (scratch, not committed) that composes the layers into one SVG per look and renders PNGs with Playwright: default hero; each cosmetic alone; all four together — at 160 px and 40 px, on the paper medallion `#F4E4C4`, in light and dark page backgrounds, plus a grayscale version. Save the composite sheet to `docs/art/legendes-sombres-preview.png`. Check each file < 6 KB (`wc -c`).
- [ ] **Step 4: Commit** `feat(art): hero split into layers, dark legends cosmetics`

### Task 3: `Character` primitive and `Avatar look`

**Files:**
- Create: `src/ui/Character.tsx`, `src/ui/characterLayers.ts`, `src/services/look.ts`, `src/services/look.test.ts`
- Modify: `src/ui/Avatar.tsx`, `src/ui/index.ts`, `src/ui/Gallery.tsx`, `src/ui/ui.test.tsx`, `src/domain/types.ts` (`Look`)

**Interfaces:**
- Consumes: Task 2 files.
- Produces: `type Look = Partial<Record<"hat" | "outfit" | "accessory" | "aura", string>>` in `domain/types.ts`; `lookOf(equipped: Partial<Record<ItemSlot, string>>): Look` in `src/services/look.ts` (pure, keeps only those four slots with string values); `characterLayers(look: Look): { slot: string; src: string }[]` in `src/ui/characterLayers.ts` (ordered aura→accessory, defaults for empty or unknown ids, `aura`/`accessory` omitted when empty), built from `import.meta.glob("@/assets/characters/*/*.svg", { eager: true, query: "?url", import: "default" })`; `Character({ look, size }: { look: Look; size: number })` — a `relative` box `size × size*4/3` stacking `<img alt="" draggable={false}>` absolutely, with `data-look` = the equipped ids joined by spaces (for tests); `Avatar` prop `look?: Look | undefined` — when set, the circle shows the hero (paper `bg-paper`, `Character` sized to fit and anchored so the head and hat are visible) instead of the emoji; frames and `fx` unchanged.

- [ ] **Step 1: Failing tests**: `lookOf` keeps only the four slots; `characterLayers({})` = shadow, base, face, ao_ba_ba, non_la in that order (no aura, no accessory); `characterLayers({ hat: "hat_thuy_tinh", aura: "aura_waves" })` starts with aura and has the crown instead of non_la; an unknown id (`hat: "hat_future"`) falls back to non_la; `Avatar` with `look` renders `[data-look]` and no emoji; with `look` + `frame` + `fx` keeps `data-frame` and `data-fx`.
- [ ] **Step 2: Run** `npx vitest run src/ui src/services/look.test.ts` — FAIL.
- [ ] **Step 3: Implement**; add a gallery block: default hero, each cosmetic, full set, at 160 px and in `Avatar` md/lg with a frame and an effect.
- [ ] **Step 4: Run** `npm run verify` — green.
- [ ] **Step 5: Commit** `feat(ui): layered Character and Avatar look`

### Task 4: The hero everywhere it is shown

**Files:**
- Modify: `src/features/home/HeroToken.tsx`, `src/features/home/HomeScreen.tsx`, `src/features/profile/MeScreen.tsx`, `src/features/leaderboard/PublicProfileScreen.tsx`, `src/domain/types.ts` (`PublicProfile.look`), `src/adapters/supabase/SupabaseLeaderboardRepository.ts`, fakes, `src/i18n/fr.ts`, tests (`home`, `profile`, `leaderboard`, `supabase.test.ts`)
- Delete: `src/assets/characters/hero-base.svg` (keep `docs/art/hero-base.svg`)

**Interfaces:**
- Consumes: `Character`, `Avatar look`, `lookOf`, `useAppState(s => s.wallet)`.
- Produces: `PublicProfile.look: Look` (adapter: `lookOf` of the `equipped` jsonb; any non-object → `{}`); `fr.profile.changeOutfit = "Changer de tenue"`.

- [ ] **Step 1: Failing tests**: the path token renders `Character` with the wallet's look (`[data-look~="hat_thuy_tinh"]` when equipped); « Moi » header avatar uses `look` (no emoji) and shows a « Changer de tenue » link to `/shop`; the public profile avatar uses `profile.look`; adapter maps `equipped` → `look` (incl. malformed → `{}`).
- [ ] **Step 2: Run** `npx vitest run src/features src/adapters/supabase` — FAIL.
- [ ] **Step 3: Implement**: `HeroToken` takes `look: Look` and renders `Character` inside its 46 px medallion (head and hat visible; aura may be cropped by the circle); « Moi » header: `Avatar look={lookOf(wallet.equipped)} size="lg"` (+ frame, fx as today), with the secondary link « Changer de tenue »; public profile: `Avatar look={profile.look}`. Leaderboard rows and podium unchanged (emoji). Check the 360 px layout in light and dark (screenshots in the report).
- [ ] **Step 4: Run** `npm run verify` — green.
- [ ] **Step 5: Commit** `feat(home): the equipped hero on the path, in Moi and on the public profile`

### Task 5: Shop by theme, try-on, wardrobe

**Files:**
- Create: `src/features/shop/TryOnSheet.tsx`, `src/features/profile/WardrobeSection.tsx`
- Modify: `src/features/shop/ShopScreen.tsx`, `src/features/profile/MeScreen.tsx`, `src/i18n/fr.ts`, `src/features/shop/shop.test.tsx`, `src/features/profile/profile.test.tsx`

**Interfaces:**
- Consumes: `activity.purchase(itemId)`, `activity.equip(slot, itemId)`, `Character`, `lookOf`, `fr.shop.themes`.
- Produces: `fr.shop.tryOn = { open: (name: string) => \`Essayer ${name}\`, buy: (price: number) => \`Acheter (${price} xu)\`, equip: "Équiper", unequip: "Retirer", owned: "Dans ta penderie", boughtNotEquipped: "Acheté ! Tu peux l'équiper quand tu veux." }`, `fr.wardrobe = { title: "Ma penderie", empty: "Rien pour l'instant : la boutique a de quoi t'habiller." }` (copy may be polished; keys fixed).

- [ ] **Step 1: Failing tests**:
  - Shop shows the consumables first, then a section titled `fr.shop.themes.legendes_sombres` with the four items sorted by price, each with a preview `[data-look]` = current look + that item.
  - Tapping a card opens the try-on sheet with the large preview and exactly one primary button: « Acheter (N xu) » (disabled when coins < price), or « Équiper » / « Retirer » when owned. Opening and closing the sheet sends no event.
  - Buying calls `purchase` then `equip(slot, id)`; if `equip` returns `{ok:false}` or throws, the toast is `boughtNotEquipped` and the item shows as owned.
  - « Moi » → « Ma penderie » lists owned cosmetics grouped by slot with Équiper/Retirer; empty state text when none.
- [ ] **Step 2: Run** `npx vitest run src/features` — FAIL.
- [ ] **Step 3: Implement** with the existing busy lock and refresh pattern (see `RewardsSection.tsx`); the confirm dialog for purchases stays (existing shop behaviour) inside the try-on flow.
- [ ] **Step 4: Run** `npm run verify` — green. Screenshots at 360 px light/dark of the shop section and the try-on sheet in the report.
- [ ] **Step 5: Commit** `feat(shop): dark legends section with try-on, wardrobe in Moi`

### Task 6: End-to-end

**Files:** Modify `e2e/shop.spec.ts`

- [ ] **Step 1: Add** `buy and wear the crown of the tides`: onboard; `seedLessonsCompleted(["l01","l02","l03","l04"], { perfect: true })` (60 xu); open the shop; open the crown's try-on; buy (confirm); the home path token has `[data-look~="hat_thuy_tinh"]`.
- [ ] **Step 2: Run** `npm run test:e2e` — all pass (report the count).
- [ ] **Step 3: Commit** `test(e2e): buy and wear a dark legends cosmetic`

### Task 7 (controller only): production

Ask Marc for the `db push`; dry-run (only `20261020000000_dark_legends.sql`); push; verify `shop_item('hat_thuy_tinh')` = 60; fast-forward merge to `main`, push `main` and `main:feat/v1`; check the Netlify bundle contains « Légendes sombres ».
