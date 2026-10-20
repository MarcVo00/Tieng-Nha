# Arena Shop (plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An « Arène » shop where Kim bài buy three Vietnamese martial cosmetics (Tây Sơn headband, Bình Định staff, hội vật wrestler outfit), tried on the hero before buying.

**Architecture:** The catalogue rows already exist in production (migration `20261022000000_duels.sql`: `hat_tay_son` hat 6, `acc_con_vo` accessory 8, `outfit_hoi_vat` outfit 10, currency `kim_bai`, theme `arene`) and the wallet already debits Kim bài. This plan adds the art layers, a server-balance read so a device never buys with Kim bài the server doesn't have, and the Arena screen reusing the try-on sheet.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Zod 3, Supabase JS 2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-duels-arena-design.md` §6–7. Art: `docs/art-direction.md` §2–4, §7. Builds on `src/features/shop/{ShopScreen,TryOnSheet}.tsx`, `src/ui/{Character,HeroMedallion,characterLayers}.ts(x)`, `src/features/duels/DuelsScreen.tsx`.

## Global Constraints

- No new dependency. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, `enum`, `@ts-ignore`, no `x!` outside tests; imports via `@/`.
- Boundaries (ESLint): `features`/`ui` never import `adapters`/`content`; no feature→feature imports; `services` pure; shared hooks `src/app/use*.ts` (`app-hook`, may not import features).
- UI strings only in `src/i18n/fr.ts` (French, tutoiement). Code/comments/commits in English. Tokens only; gold = earned rewards (Kim bài are gold); one primary action per screen. UI tasks load `vietlearn-design`.
- **Items (exact):** `hat_tay_son` slot `hat` 6 Kim bài « Bandeau de Tây Sơn »; `acc_con_vo` slot `accessory` 8 « Bâton de Bình Định »; `outfit_hoi_vat` slot `outfit` 10 « Tenue de lutteur ». Currency `kim_bai`, theme `arene`.
- **Safe Kim bài spending (ruling):** a Kim bài purchase is allowed only **online** and only if `min(local wallet kimBai, server user_stats.kim_bai) >= price` (a fresh device mirrors duel earnings but never sees purchases made on another device). Offline → « Connecte-toi pour acheter à l'arène. ». The xu shop keeps hiding Kim bài items.
- **Art:** canvas `viewBox="0 0 120 160"`, anchors head (60,70) r 22, shoulders y 92, hem y 146, hands (28,122)/(92,122), skin `#F6DDBF`; flat fills, outline `#1F1A17` 2.5 px rounded, no `filter`/gradient/embedded image, ≤ one textured zone per file, closed palette (art-direction §2), < 6 KB, ids prefixed by layer, no `width`/`height`. Dignified martial look (no bare torso). Must fit the 3 characters (`hero`, `char_kiem_khach`, `char_phap_su`) and combine with the other cosmetics.
- **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint && npm run verify` green before DONE.

## Review Focus

1. **Second device / reinstall**: local Kim bài above the server balance → purchase refused with a clear message, nothing appended. Pinned in Task 2.
2. **Offline**: Arena browsable (try-on works), buying blocked with the offline message. Pinned in Task 2.
3. **Old timestamps on iOS**: Postgres 6-digit fractions must parse everywhere (trim to 3 digits before `Date.parse`). Pinned in Task 2.
4. **Arena items never sold in the xu shop** and xu items never in the Arena. Pinned in Task 2.
5. **Headband over each hair style** (spiky, ponytail, under no hat) and staff not hiding the face. Pinned in Task 1 preview.

---

### Task 1: Art — three arena items

**Files:**
- Create: `src/assets/characters/hat/hat_tay_son.svg`, `accessory/acc_con_vo.svg`, `outfit/outfit_hoi_vat.svg`
- Create: `docs/art/arene-preview.png`

**Interfaces:** layer files on the common canvas, picked up by `characterLayers` through its glob (no code change).

- [ ] **Step 1: Draw** — **Bandeau de Tây Sơn** (hat): wide red band knotted on the forehead, two long tails floating behind, a small gold emblem at the centre; hair stays visible (it replaces the nón lá / sits over the characters' hair). **Bâton de Bình Định** (accessory): long dark-wood staff held vertical in the right hand (92,122), gold rings at both ends, taller than the hero but inside the canvas. **Tenue de lutteur du hội vật** (outfit): short sleeveless indigo vest, open, over a light undershirt (no bare torso), wide red silk belt knotted on the side with hanging tails (the single detailed zone), tight trousers.
- [ ] **Step 2: Check fit** with a throwaway compose script (scratch, never committed): 3 characters × (default, each item, the three together, the three + aura) at 160 px and 40 px, light/dark, grayscale; fix clashes.
- [ ] **Step 3: Preview sheet** `docs/art/arene-preview.png` (< 1 MB): rows = characters, columns = default, bandeau, bâton, tenue, les trois.
- [ ] **Step 4: Commit** `feat(art): arena cosmetics from Tây Sơn and the village wrestling`

### Task 2: Arena screen and safe Kim bài purchases

**Files:**
- Create: `src/features/duels/ArenaScreen.tsx` (+ tests)
- Modify: `src/ports/DuelGateway.ts` (+ `balance(): Promise<number>` — server Kim bài of the current user; `OfflineError` offline), `src/adapters/supabase/SupabaseDuelGateway.ts` (read `user_stats.kim_bai` for `auth.uid()`; also trim timestamp fractions to 3 digits before parsing), `src/adapters/fakes/FakeDuelGateway.ts` (balance = Kim bài of the local journal unless a test overrides it), `src/features/shop/TryOnSheet.tsx` (currency-aware price/label, an optional purchase guard message), `src/features/duels/DuelsScreen.tsx` (entry « Arène » with the Kim bài balance), `src/features/profile/MeScreen.tsx` (Kim bài shown next to xu), `src/app/router.tsx` (`/arena`), `src/i18n/fr.ts`, tests

**Interfaces:**
- Consumes: `activity.purchase(itemId)`, `activity.equip(slot, itemId)`, `useEquipToggle`, `HeroMedallion` (`ring`), `lookOf`, wallet `kimBai`, `fr.shop.items`, `fr.shop.themes.arene`.
- Produces: `/arena`; `fr.arena = { title: "Arène", intro, balance: (n) => ..., buy: (price: number) => \`Acheter (${price} Kim bài)\`, needOnline: "Connecte-toi pour acheter à l'arène.", notEnough: "Pas assez de Kim bài : gagne des duels !", serverBehind: "Ton solde de Kim bài se met à jour : réessaie dans un instant." }` (copy may be polished; keys fixed).

- [ ] **Step 1: Failing tests**: Arena lists exactly the 3 `kim_bai` items with try-on previews on the current look; the xu shop still hides them; buy with local 10 and server 10 → purchase + equip; local 10 / server 4 → `serverBehind`, no event; offline → `needOnline`, no event; not enough → disabled + `notEnough`; owned → Équiper/Retirer via `useEquipToggle`; adapter: `balance()` reads `kim_bai`, Postgres timestamp `2026-10-20 08:00:00.123456+00` parses; « Moi » shows the Kim bài balance; the hub links to `/arena`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** Screenshots 360 px light/dark (Arena list, try-on unowned/owned).
- [ ] **Step 4: Run** `npm run lint && npm run verify` — green.
- [ ] **Step 5: Commit** `feat(arena): Kim bài shop with try-on and server-checked purchases`

### Task 3: End-to-end

**Files:** Modify `e2e/duels.spec.ts` (or create `e2e/arena.spec.ts`), `e2e/helpers.ts` if needed.

- [ ] **Step 1:** `win Kim bài then buy the Tây Sơn headband`: onboard; seed lessons + `d01`; reach ≥ 6 Kim bài (e.g. seed `duel_settled` events with a helper consistent with the fake's balance, or play enough fake duels); open `/arena`; try on and buy « Bandeau de Tây Sơn »; the home path token has `[data-look~="hat_tay_son"]`; the Kim bài balance decreased by 6.
- [ ] **Step 2: Run** `npm run test:e2e` — all pass (report counts).
- [ ] **Step 3: Commit** `test(e2e): buy an arena cosmetic with Kim bài`

### Task 4 (controller only): production

No migration. Merge to `main`, push `main` and `main:feat/v1`; check the Netlify bundle contains « Arène ».
