# Deux nouveaux tirages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the « Seigneur des mers » and « Esprits de la nuit » gacha themes (12 items each, three new character bodies, a signature per legendary, combat sounds) and a three-tab banner selector in the Boutique.

**Architecture:** Art first (SVG layers registered by `src/ui/characterLayers.ts` through its glob; new bodies declared in its `CHARACTERS` defaults), then catalogue + server migration (new rows in `public.shop_items()`; gacha rules untouched; parity test), then the shop selector, then signatures registered in `src/features/shop/signatures/index.ts`, then combat cues (`WEAPON_FAMILY`, `blowCue` cues), then e2e and 1.8.0.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Web Audio (existing engine), Supabase Postgres + pgTAP, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-more-banners-design.md` (approved by Marc 2026-10-27). Also: `docs/superpowers/specs/2026-10-26-sound-and-gacha-reveal-design.md` §6.1 (signature rules), `docs/superpowers/specs/2026-10-21-gacha-design.md` (rules unchanged), `docs/art-direction.md`, ADR 0010 + audit §D.

## Global Constraints

- No new dependency; TS strict; `@/` imports; ESLint boundaries (features/ui never import adapters/content; no feature→feature; app-hooks never import features).
- UI strings in `src/i18n/fr.ts` (French, tutoiement, U+202F before `? ! : ;` and inside « »); Vietnamese words `lang="vi"`. Tokens only. UI/art tasks load `vietlearn-design`.
- Theme ids (exact): `seigneur_des_mers`, `esprits_de_la_nuit`. Tab order and short labels (exact): « Légendes sombres », « Seigneur des mers », « Esprits de la nuit ». Banner titles: « Long Vương — Le seigneur des mers », « Hồ ly — Les esprits de la nuit » (Vietnamese part `lang="vi"`).
- Item ids, French names, rarities and slots: exactly the two tables of spec §4.2.
- Six bodies: `hero`, `char_kiem_khach`, `char_phap_su`, `char_lac_long_quan`, `char_thay_phap`, `char_ho_ly` — every hat/outfit/accessory/aura (old and new) must sit right on every body.
- Art: SVG, Đông Hồ style (same outline weight, palette, anchors), each layer < 6 KB, readable at 160 px and 40 px, light/dark/grayscale.
- Gacha rules, prices (40 / 360 xu), rates, pity (per theme), refunds, omen: unchanged. Migration `20261028000000_more_banners.sql`, `set lock_timeout = '10s'` first; never edit applied migrations; shop.json ↔ server parity.
- Signatures: ~3–4 s, in the focus view, ≤ 16 animated elements, ≤ 12 particles per SVG, no loop, all nodes unmounted at the end, « Passer » cuts them, none under reduced motion, sounds stop with the scene / when hidden. 4× CPU check (0 long tasks).
- **Shell safety:** the repo path contains a space — always quote paths/variables, never `rm -rf` outside the repo or `.superpowers/`, `ls` a target before deleting.
- **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint && npm run verify` (and `npm run test:e2e` for flow tasks) green before DONE.

## Review Focus

1. A 1.7 client still open after deploy sees an unknown theme/item (recovered pull, catalogue) → no crash, nothing counted wrongly (Task 3 test: wallet ignores unknown gacha items; ShopScreen skips themes missing from `fr.shop.themes`).
2. Old items on new bodies and new items on old bodies (e.g. `hat_thuy_tinh` on `char_ho_ly`, `outfit_giap_vay_rong` on `char_phap_su`) → layers sit right, nothing floating (contact sheets in Tasks 1–2; unit test that every body has defaults).
3. Pity and « x/12 » never mix themes when switching tabs or pulling on one theme then another (Task 4 test).
4. Remembered tab with storage blocked or an unknown stored value → first tab, no crash (Task 4 test).
5. A pull containing both new legendaries' signatures, or a signature skipped mid-way → each plays on its own card, « Passer » stops sound and unmounts (Tasks 5–6 tests).

---

### Task 1: Art — Seigneur des mers

**Files:** `src/assets/characters/{base,face,outfit}/char_lac_long_quan*.svg` (body, face + `_hurt` + `_ko`, default outfit), the 11 item layers of spec §4.2 table 1 in `src/assets/characters/{accessory,hat,outfit,aura}/`, `src/ui/characterLayers.ts` (`CHARACTERS.char_lac_long_quan` defaults), `docs/art/seigneur-des-mers-sheet.png`.
- [ ] Draw the body (same size/anchors as `char_kiem_khach`) and the 11 items; dragon-sea identity (jade, coral, foam, scales) clearly distinct from Légendes sombres.
- [ ] Unit test (`src/ui/ui.test.tsx`): `characterLayers({ character: "char_lac_long_quan" })` has base/face/outfit layers; with `accessory: "acc_kiem_rong"` the accessory layer resolves.
- [ ] Contact sheet: each new item on `hero`, `char_kiem_khach`, `char_phap_su`, `char_lac_long_quan`; every existing hat/outfit/accessory/aura on `char_lac_long_quan`; 160 px + 40 px, light/dark/grayscale → `docs/art/seigneur-des-mers-sheet.png` and workspace shots. Fix any misfit.
- [ ] `npm run lint && npm run verify`. Commit `feat(art): the sea lord's pieces and Lạc Long Quân`.

### Task 2: Art — Esprits de la nuit

**Files:** bodies `char_thay_phap`, `char_ho_ly` (base, face + `_hurt` + `_ko`, default outfit; the fox's nine tails belong to her body/outfit layers, behind the body), the 10 item layers of table 2, `characterLayers.ts` defaults, `docs/art/esprits-de-la-nuit-sheet.png`.
- [ ] Draw; night identity (indigo, paper lanterns, blue foxfire, incense smoke) distinct from both other themes.
- [ ] Unit test: both bodies resolve their layers; every body in `CHARACTERS` has base, face and outfit files (Review Focus 2).
- [ ] Contact sheet: each new item on all six bodies; every existing and Task 1 hat/outfit/accessory/aura on `char_thay_phap` and `char_ho_ly`; sizes/themes as Task 1. Fix misfits.
- [ ] `npm run lint && npm run verify`. Commit `feat(art): the night spirits' pieces, the spirit hunter and the nine-tailed fox`.

### Task 3: Catalogue and server

**Files:** `supabase/migrations/20261028000000_more_banners.sql`, `supabase/tests/07_more_banners_test.sql`, `src/content/shop.json`, `src/content/shopParity.test.ts`, `src/i18n/fr.ts` (`shop.items.*` names, `shop.themes`), `src/adapters/fakes/seed/shop.ts`, `src/adapters/supabase/types.gen.ts` if affected, `src/services/wallet.test.ts`.
- [ ] pgTAP first: the 24 rows exist with their slot/theme/rarity and `price null`; `gacha_draw('seigneur_des_mers', …)` and `('esprits_de_la_nuit', …)` with fixed rolls return items of those themes only; `gacha_pull` on each new theme debits 40 / 360 and adds items; pity is tracked per theme (a pull on one theme leaves the other's counter unchanged); `legendes_sombres` draws are unchanged for the same rolls (regression); direct `item_purchased` of a new item refused.
- [ ] Migration: recreate `public.shop_items()` (and dependants, as `20261025000000_gacha.sql` did) with the 24 new rows appended; nothing else changes.
- [ ] Catalogue + names + parity; fake seed. Wallet test (Review Focus 1): a `gacha_pulled` event whose item id is not in the catalogue counts its cost/refunds as today but adds no unknown item (assert current behaviour; fix only if it crashes).
- [ ] `npx supabase db reset && npx supabase test db` green, then `npx supabase stop`; `npm run lint && npm run verify`. Commit `feat(db): the sea lord and night spirit banners`.

### Task 4: Banner selector

**Files:** `src/features/shop/ShopScreen.tsx`, `src/features/shop/GachaBanner.tsx`, `src/ui/SegmentedNav.tsx` (reuse if it fits, else a local tablist), `src/i18n/fr.ts`, `tailwind.config.*`/tokens (`altar-sea`, `altar-night` tints), `src/features/shop/XinXamOmen.tsx` (altar tint by theme), tests, `e2e/shop.spec.ts`.

**Interfaces:**
- `GachaBanner` gains optional `artLook?: Partial<Look>` overriding the legendary-on-base art; ShopScreen passes `{ character: "char_lac_long_quan", accessory: "acc_kiem_rong" }` for `seigneur_des_mers`.
- Remembered tab key: `tn-gacha-tab` in `localStorage` (try/catch; unknown value → first tab).

- [ ] Failing tests: three tabs in order with the exact short labels (`role="tab"`, `aria-selected`); switching shows that theme's banner title, its « x/12 » and its pity line only; pulling on « Seigneur des mers » leaves « Légendes sombres »'s pity line unchanged (Review Focus 3); stored tab restored; storage throwing or an unknown stored value → first tab (Review Focus 4); the omen stage carries the theme tint (`data-altar-tint`).
- [ ] Implement; 320/360 px light/dark shots of the three tabs.
- [ ] `npm run lint && npm run verify && npm run test:e2e` green (update shop e2e selectors). Commit `feat(shop): three banners to choose from`.

### Task 5: Signature — L'épée du dragon

**Files:** `src/features/shop/signatures/DragonSword.tsx` (+ test), `src/features/shop/signatures/index.ts` (register `acc_kiem_rong`), new SVGs `src/assets/gacha/ink-dragon*.svg`, `src/domain/sound.ts` (+ `sig.roar`, `sig.blade`), `src/adapters/audio/recipes.ts`.
- [ ] Failing tests: `hasSignature("acc_kiem_rong")`; flip → signature → focus with the sword on the hero; « Passer » mid-signature → recap, `stopAll`, unmounted; schedule within ~3–4 s; budget counted from the scene data (as `TalismanGuardian` does).
- [ ] Implement spec §4.4 (dragon coils around the altar with `sig.roar` — deep growl + rumble; dives into the blade; golden veins; `sig.blade` — metallic ring), following `TalismanGuardian`'s structure (pure schedule, timers not keyed on `onEnd`, hidden-safe).
- [ ] Shots of every beat 360 px light/dark; 4× CPU (0 long tasks). `npm run lint && npm run verify && npm run test:e2e`. Commit `feat(shop): the dragon sword's own reveal`.

### Task 6: Signature — La renarde à neuf queues

**Files:** `src/features/shop/signatures/NineTailFox.tsx` (+ test), registry (`char_ho_ly`), new SVGs (lanterns, foxfire tail), `src/domain/sound.ts` (+ `sig.lantern`, `sig.foxfire`), recipes.
- [ ] Failing tests as Task 5, plus a pull with both `acc_kiem_rong` and `char_ho_ly`: each signature plays on its own card (Review Focus 5).
- [ ] Implement spec §4.4 (lanterns go out one by one with `sig.lantern` breaths — spaced > 50 ms; nine blue-flame tails fan out with `sig.foxfire` cold crackle; bells → she appears).
- [ ] Shots + 4× CPU; gates. Commit `feat(shop): the nine-tailed fox's own reveal`.

### Task 7: Combat sounds

**Files:** `src/domain/blowSound.ts` (+ test), `src/domain/sound.ts` (+ `blow.acc_kiem_rong`, `blow.char_ho_ly`, `blow.char_lac_long_quan`), recipes.
- [ ] Failing tests: `WEAPON_FAMILY` maps `acc_mai_cheo`, `acc_dinh_ba`, `acc_long_den` → `staff`, `acc_quat_giay` → `fan`; `blowCue` gives `blow.acc_kiem_rong` for the sword, `blow.char_ho_ly` / `blow.char_lac_long_quan` bare-handed, `blow.fist` for `char_thay_phap` bare-handed; every new cue has a recipe (existing « every cue has a recipe » test).
- [ ] Recipes: sword = blade with a roar echo; fox = cold-fire crackle; Lạc Long Quân = crashing wave. Gates. Commit `feat(sound): the new gear sounds in fights`.

### Task 8: e2e, version, changelog

- [ ] e2e (fixed rolls): open « Esprits de la nuit », pull ×1 → recap item belongs to that theme, its « 1/12 » updates and « Légendes sombres » stays « x/12 » as before; tab remembered after reload.
- [ ] `package.json` → **1.8.0**; changelog newest-first entry `{ version: "1.8.0", date: <release day>, title: "Deux nouveaux sanctuaires" }`, 3–4 short French items for Mathias; tests pinned to 1.7.0 updated.
- [ ] `npm run lint && npm run verify && npm run test:e2e` green. Commit `test(e2e): three banners; v1.8.0`.

### Task 9 (controller): ship

Re-check prod (read-only): no row in `gacha_pulls`/`events` mentions the new ids; dry-run + push `20261028000000_more_banners.sql`; verify `shop_item('acc_kiem_rong')` is legendary, theme `seigneur_des_mers`, price null; then merge, push `main` and `main:feat/v1`, refresh `demo`, check the bundle contains « Deux nouveaux sanctuaires ».
