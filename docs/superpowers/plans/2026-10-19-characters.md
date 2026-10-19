# Characters (lot 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two buyable characters (« La lame errante », « La gardienne des talismans », 200 xu each) replace the starting hero's body, face and default clothes; every « Légendes sombres » cosmetic still fits on them.

**Architecture:** A new slot `character` in the catalogue (migration + `shop.json`). `characterLayers` reads the equipped character and uses that character's own base, face, default outfit and optional default hat; cosmetics in `hat`/`outfit`/`accessory`/`aura` override the defaults exactly as for the starting hero. The shop gets a « Personnages » section (before the themes) using the existing try-on sheet; « Ma penderie » lists owned characters plus the starting hero.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, Zod 3, Supabase (Postgres 15 + pgTAP), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-hero-cosmetics-design.md` §6 (and §3.2, §5.1 for the layer model). Art rules: `docs/art-direction.md` §2–4, §7. Builds on lot 2 (`src/ui/characterLayers.ts`, `src/services/look.ts`, `src/features/shop/TryOnSheet.tsx`, `src/features/profile/WardrobeSection.tsx`).

## Global Constraints

- No new dependency. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, `enum`, `@ts-ignore`, no `x!` outside tests; imports via `@/`.
- Boundaries (ESLint): `features`/`ui` never import `adapters` or `content`; no feature→feature imports; `services` pure; shared hooks live in `src/app/use*.ts` (element `app-hook`).
- UI strings only in `src/i18n/fr.ts` (French, tutoiement). Code, comments, commits in English. Tokens only; gold = earned rewards / owned; one primary action per screen. UI tasks load `vietlearn-design`.
- **New catalogue items (app = server):** `char_kiem_khach` and `char_phap_su`, kind `cosmetic`, slot `character`, price **200**, no theme. Existing items unchanged.
- **Slots:** `ItemSlot` gains `"character"`; `Look` gains `character?: string`. Empty `character` = the starting hero (`hero`).
- **Character defaults:** `hero` → base `hero`, face `hero`, outfit `ao_ba_ba`, hat `non_la`. `char_kiem_khach` → base, face, outfit `char_kiem_khach`, no default hat (spiky hair + vermilion headband are part of the base). `char_phap_su` → base, face, outfit `char_phap_su`, no default hat (long tied hair in the base; talisman strips are part of the outfit). Shadow is shared (`shadow/hero.svg`).
- **Layer order (bottom → top):** aura, shadow, base, face, outfit, hat, accessory. Canvas `viewBox="0 0 120 160"`, anchors: head centre (60,70) r 22, shoulders y 92, hem y 146, hands (28,122) and (92,122); skin `#F6DDBF` (the sword layer draws its fist in this skin tone).
- **Art:** flat fills, outline `#1F1A17` 2.5 px rounded, no `filter`/gradient/embedded image, ≤ one textured zone per file, closed palette (art-direction §2), < 6 KB per file, ids prefixed by the layer, no `width`/`height`. Shonen / dark-fantasy feel within the Đông Hồ style. Readable at 40 px, dark theme on the paper medallion, grayscale.
- Never edit applied migrations. Never push to production (controller asks Marc). **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint` and `npm run verify` green before DONE.

## Review Focus

1. **Every cosmetic on every character** (crown over spiky or long hair, armour over each body, sword in each right hand, aura behind each silhouette) — 3 characters × 4 items + all-four: pinned by the Task 2 preview sheet.
2. **Unknown character id** (future or malformed) → the starting hero, never a headless figure. Pinned in Task 3 tests.
3. **Switching character keeps cosmetics equipped**, and « Héros de départ » (unequip character) works offline. Pinned in Task 4 tests.
4. **A character with no default hat** must not fall back to the nón lá. Pinned in Task 3 tests.
5. **Old clients** (lot 2 app) receiving `equipped.character` from the server or replay: the lot 2 `lookOf` ignores unknown slots, so they show the starting hero — no crash. Nothing to build; Task 3 keeps `lookOf` tolerant.

---

### Task 1: Catalogue — two characters

**Files:**
- Create: `supabase/migrations/20261021000000_characters.sql`, `supabase/tests/04_characters_test.sql`
- Modify: `src/content/shop.json`, `src/content/schema.ts`, `src/domain/types.ts` (`ItemSlot`, `Look`), `src/i18n/fr.ts` (`fr.shop.items`, `fr.shop.characters`), `src/adapters/fakes/seed/shop.ts`

**Interfaces:**
- Produces: `ItemSlot` + `"character"`; `Look.character?: string`; `fr.shop.items.char_kiem_khach = { name: "La lame errante", desc, confirmName }`, `fr.shop.items.char_phap_su = { name: "La gardienne des talismans", desc, confirmName }`; `fr.shop.characters = { title: "Personnages", starter: "Héros de départ" }`.

- [ ] **Step 1: pgTAP** (`04_characters_test.sql`, style of `03_`): `shop_item` returns both rows (200, cosmetic, character); buying deducts 200 and adds to the inventory; equip `{slot:'character', itemId:'char_kiem_khach'}` when owned sets `equipped.character`; into `hat` → no effect; `itemId: null` removes it; low-coins refusal.
- [ ] **Step 2: Run** `npx supabase db reset && npx supabase test db` — `04_` FAILS.
- [ ] **Step 3: Migration**: `set lock_timeout = '10s';` · `create or replace function public.shop_item` = the 12 rows of `20261020000000_dark_legends.sql` verbatim + the 2 new rows (one row per line) · same `revoke execute`.
- [ ] **Step 4: Run** the DB tests — PASS; `npx supabase stop`.
- [ ] **Step 5: Content + types**: schema slot enum + `character`, `shop.json`, fakes seed, `fr.ts`. The parity test must pass.
- [ ] **Step 6: Run** `npm run lint && npm run verify` — green.
- [ ] **Step 7: Commit** `feat(shop): two buyable characters in the catalogue`

### Task 2: Art — the two characters

**Files:**
- Create: `src/assets/characters/base/char_kiem_khach.svg`, `face/char_kiem_khach.svg`, `outfit/char_kiem_khach.svg`, `base/char_phap_su.svg`, `face/char_phap_su.svg`, `outfit/char_phap_su.svg`
- Modify: `docs/art/legendes-sombres-preview.png` (re-render, see Step 3)

**Interfaces:**
- Produces: six layer files on the common canvas and anchors, stacking with `shadow/hero.svg` in the layer order.
- Descriptions (spec §6): **La lame errante** — young swordsman, vermilion headband on the forehead, black spiky shonen hair, tight indigo outfit, a discreet scar on the cheek (face layer), determined brows. **La gardienne des talismans** — young woman, long black hair tied high (ponytail falling behind the shoulders, drawn in the base so cosmetics sit over it), black-and-vermilion tunic, yellow (vàng hoè) talisman strips floating from the sleeves/belt (the outfit's single textured or detailed zone), calm determined face. Both keep the head circle at (60,70) r 22 and the hands at (28,122)/(92,122) in skin `#F6DDBF` so the crown, armour, sword and aura fit.

- [ ] **Step 1: Draw** the six files.
- [ ] **Step 2: Check fit** with a throwaway compose script (scratch, outside `src/`, never committed) rendering PNGs with Playwright: for each of the 3 characters (hero, kiem_khach, phap_su): default; + each of the 4 cosmetics; + all four — at 160 px and 40 px, on the paper medallion, light and dark page, plus grayscale. Fix any clash (crown floating above spiky hair, ponytail poking through the armour, sword hiding the face).
- [ ] **Step 3: Re-render** `docs/art/legendes-sombres-preview.png` as one sheet: rows = characters, columns = default, crown, aura, armour, sword, all four (light theme, 160 px; a 40 px strip under each row). Keep it under 1 MB.
- [ ] **Step 4: Commit** `feat(art): the wandering blade and the talisman keeper`

### Task 3: `characterLayers` with characters

**Files:**
- Modify: `src/ui/characterLayers.ts`, `src/services/look.ts`, `src/ui/Gallery.tsx`, `src/ui/ui.test.tsx`, `src/services/look.test.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 2 files.
- Produces: `characterLayers(look)` honours `look.character` with the defaults table of Global Constraints (unknown character → `hero`; a character without default hat → no hat layer unless a hat cosmetic is equipped); `lookOf` keeps `character`; `CHARACTER_SLOTS` / `characterSlotOf` include `"character"`; `Character`'s `data-look` lists the character id too.

- [ ] **Step 1: Failing tests**: `characterLayers({ character: "char_kiem_khach" })` = shadow, base/char_kiem_khach, face/char_kiem_khach, outfit/char_kiem_khach — and NO hat layer; with `hat: "hat_thuy_tinh"` the crown is added; with `outfit: "outfit_son_tinh"` the armour replaces the character's outfit; `character: "char_future"` → exactly the starting hero's layers; `lookOf({ character: "char_phap_su", frame: "frame_jade" })` = `{ character: "char_phap_su" }`; `characterSlotOf({ slot: "character" })` = `"character"`.
- [ ] **Step 2: Run** `npx vitest run src/ui src/services/look.test.ts` — FAIL.
- [ ] **Step 3: Implement**; gallery block: the 3 characters default + all four cosmetics.
- [ ] **Step 4: Run** `npm run lint && npm run verify` — green.
- [ ] **Step 5: Commit** `feat(ui): characters in the layered hero`

### Task 4: Shop « Personnages », wardrobe, e2e

**Files:**
- Modify: `src/features/shop/ShopScreen.tsx`, `src/features/shop/TryOnSheet.tsx` (only if needed), `src/features/profile/WardrobeSection.tsx`, `src/i18n/fr.ts`, `src/features/shop/shop.test.tsx`, `src/features/profile/profile.test.tsx`, `e2e/shop.spec.ts`

**Interfaces:**
- Consumes: `characterSlotOf`, `lookOf`, `HeroMedallion` (`ring` prop), `useEquipToggle`, `fr.shop.characters`.

- [ ] **Step 1: Failing tests**:
  - Shop order: consumables, then « Personnages » (both characters, preview = current look with that character, keeping equipped cosmetics), then « Légendes sombres ».
  - The try-on of a character works like a cosmetic (buy 200 in-sheet → purchase + equip `character`).
  - « Ma penderie » shows a « Personnages » group with « Héros de départ » (always present, selecting it sends `equip("character", null)`) plus owned characters; the equipped one is marked; switching keeps the other slots equipped.
  - e2e `buy and play as the wandering blade`: onboard; seed enough xu (e.g. `seedLessonsCompleted` with 10 perfect lessons → 150 xu, plus `seedBadges` for badges worth 10 each to reach ≥ 200 — compute and assert the balance first); buy « La lame errante »; the home token has `[data-look~="char_kiem_khach"]`; then « Héros de départ » from « Ma penderie » restores the starting hero.
- [ ] **Step 2: Run** `npx vitest run src/features` — FAIL.
- [ ] **Step 3: Implement**. Screenshots at 360 px light/dark: shop « Personnages », try-on of each character, wardrobe.
- [ ] **Step 4: Run** `npm run lint && npm run verify && npm run test:e2e` — green (report counts).
- [ ] **Step 5: Commit** `feat(shop): characters section, starter hero in the wardrobe`

### Task 5 (controller only): production

Ask Marc for the `db push`; dry-run (only `20261021000000_characters.sql`); push; verify `shop_item('char_phap_su')` = 200 / `character`; fast-forward merge to `main`, push `main` and `main:feat/v1`; check the Netlify bundle contains « La lame errante ».
