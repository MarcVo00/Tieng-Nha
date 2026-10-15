# Xu (pièces) + boutique — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une monnaie (« xu ») gagnée en jouant et une boutique (recharge d'énergie, gel de série, trois cadres d'avatar visibles au classement), calculées à l'identique par l'appli et par le serveur.

**Architecture:** Comme l'XP : le journal d'événements est la source de vérité. Deux nouveaux événements **synchronisés** (`item_purchased`, `item_equipped`). Une migration Supabase étend `apply_event` (barème de xu, achats, équipement, gel de série) et recrédite les xu des événements passés ; le classement expose le cadre équipé. Côté appli, un module pur `services/wallet.ts` rejoue exactement les mêmes règles ; l'énergie et la série en tiennent compte. Une page Boutique, l'affichage des xu gagnés et les cadres complètent l'interface.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 (tokens), motion 11, Zustand 5, Zod 3, Vitest, Playwright, Supabase (Postgres 15, pgTAP).

**Spec:** [`docs/superpowers/specs/2026-10-14-progression-boss-energy-design.md`](../specs/2026-10-14-progression-boss-energy-design.md) §5, §6 (étape 4 du §8). Écarts assumés, décidés au plan : (1) **rattrapage** des xu pour les événements antérieurs à la migration ; (2) pas de colonne `boss_wins` : « 1re victoire » = meilleur score précédent < 70 ; (3) le gel de série couvre **un jour manqué par gel** ; (4) la recharge d'énergie est appliquée côté appli seulement (l'énergie est locale).

## Global Constraints

- Aucune nouvelle dépendance ; architecture hexagonale (features/ui n'importent jamais `src/adapters/**` ; pas d'import feature→feature ; `src/services/**` pur, sans React/DOM/`Date.now`/`Math.random`).
- Textes d'interface uniquement dans `src/i18n/fr.ts` (français, tutoiement) ; code/commentaires/commits en anglais.
- Couleurs uniquement via tokens Tailwind ; animations `transform`/`opacity` avec `src/ui/motion.ts` ; l'or reste réservé aux récompenses (les xu en sont une).
- **Barème (identique serveur/appli)** : `lesson_completed` +10, +5 de plus si `payload.perfect === true` ; `dialogue_completed` +5 ; `review_session_completed` +3 ; `badge_unlocked` +10 ; `exam_finished` avec `payload.score >= 70` : +50 si le meilleur score **précédent** était < 70 ou absent, sinon +20 ; autres événements : 0. Pas de plafond.
- **Catalogue (identique serveur/appli)** : `energy_refill` 30 xu (consommable) ; `streak_freeze` 50 xu (consommable, 2 max en stock) ; `frame_bronze` 40, `frame_jade` 80, `frame_son_mai` 150 (cosmétiques, slot `frame`).
- **Achat** `item_purchased { itemId }` : refusé **sans effet** (jamais d'exception) si objet inconnu, solde < prix, cosmétique déjà possédé, ou `streak_freeze` avec 2 gels en stock. Sinon : solde −prix ; `streak_freeze` → stock +1 ; cosmétique → inventaire ; `energy_refill` → énergie au maximum (appli).
- **Équipement** `item_equipped { slot, itemId | null }` : accepté si `itemId` est `null` (retirer) ou possédé **et** de ce slot ; sinon sans effet.
- **Gel de série** : à une nouvelle journée active après `g` jours manqués (`g ≥ 1`), si le stock ≥ `g`, on consomme `g` gels et la série continue (+1) ; sinon elle repart à 1.
- Le prix vient toujours du catalogue, jamais du client. Un trigger ne lève jamais d'exception pour une règle métier.
- Migration : **nouveau fichier** (ne jamais modifier `20261010000000_init.sql`) ; testée avec pgTAP en local (`npx supabase start` / `npx supabase test db`, Docker requis) ; **appliquée en production par le contrôleur** (Task 8), pas par les sous-agents.
- Commits signés uniquement par l'utilisateur : jamais de `Co-Authored-By`, jamais de mention de Claude/IA. `npm run verify` vert avant chaque commit.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261015000000_coins_shop.sql` | **new** — types d'événements, colonnes, catalogue SQL, `apply_event`, rattrapage, vue `leaderboard` |
| `supabase/tests/01_coins_shop_test.sql` | **new** — pgTAP |
| `src/content/shop.json`, `src/content/schema.ts` | catalogue + schéma |
| `src/domain/types.ts` | `ShopItem`, `Wallet`, événements, `LeaderboardRow.frame` |
| `src/ports/ContentSource.ts` + adaptateurs + fakes | `getShop()` |
| `src/services/wallet.ts` | **new** — `COINS`, `walletAt(events, shop)` |
| `src/services/streak.ts`, `src/services/progress.ts` | série avec gels |
| `src/services/energy.ts` | recharge achetée |
| `src/services/activity.ts` | `getWallet`, `purchase`, `equip`, `coinsGained` |
| `src/app/appState.ts` | `wallet` |
| `src/adapters/supabase/*` (+ `types.gen.ts`) | colonnes/vue, `frame` au classement |
| `src/ui/Avatar.tsx`, `src/styles/tokens.css`, `tailwind.config.ts`, `docs/design-system.md` | cadres |
| `src/features/shop/*` | **new** — page Boutique |
| écrans de fin (leçon, dialogue, révision, boss), `MeScreen`, `EnergyIndicator`, classement, profil public | affichage |
| `src/app/router.tsx` | route `/shop` |
| `e2e/shop.spec.ts` | **new** |

---

### Task 1: Database migration + pgTAP tests

**Files:**
- Create: `supabase/migrations/20261015000000_coins_shop.sql`, `supabase/tests/01_coins_shop_test.sql`

**Interfaces:**
- Produces (server): `events.type` accepts `item_purchased`, `item_equipped`; `user_stats` gains `coins int not null default 0`, `inventory text[] not null default '{}'`, `equipped jsonb not null default '{}'`, `streak_freezes int not null default 0`; function `public.shop_item(p_id text) returns table(price int, kind text, slot text)`; view `leaderboard` gains `coins` and `equipped_frame text` (= `equipped->>'frame'`).

- [ ] **Step 1: Read** `supabase/migrations/20261010000000_init.sql` fully (trigger `apply_event`, view, grants) and `supabase/tests/00_schema_test.sql` (fixtures, `pg_temp.login`, style).

- [ ] **Step 2: Write the migration.** Required content, in this order:

```sql
-- Coins and shop (spec Progression V2 §5–6). Never edit after it is applied to prod: add a new migration.

-- 1. New synced event types (session_started stays local-only and is never sent).
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked',
  'item_purchased','item_equipped'));

-- 2. Wallet columns.
alter table public.user_stats
  add column coins int not null default 0,
  add column inventory text[] not null default '{}',
  add column equipped jsonb not null default '{}',
  add column streak_freezes int not null default 0;

-- 3. Catalogue (must match src/content/shop.json).
create or replace function public.shop_item(p_id text) returns table(price int, kind text, slot text)
language sql immutable as $$
  select v.price, v.kind, v.slot from (values
    ('energy_refill', 30, 'consumable', null::text),
    ('streak_freeze', 50, 'consumable', null::text),
    ('frame_bronze', 40, 'cosmetic', 'frame'),
    ('frame_jade', 80, 'cosmetic', 'frame'),
    ('frame_son_mai', 150, 'cosmetic', 'frame')
  ) as v(id, price, kind, slot) where v.id = p_id
$$;

-- 4. Coin earning rule for one event, given the best exam score BEFORE it (null = none).
create or replace function public.coins_for_event(p_type text, p_payload jsonb, p_best_before int) returns int
language sql immutable as $$
  select case p_type
    when 'lesson_completed' then 10 + case when (p_payload->>'perfect') = 'true' then 5 else 0 end
    when 'dialogue_completed' then 5
    when 'review_session_completed' then 3
    when 'badge_unlocked' then 10
    when 'exam_finished' then case
      -- never raise inside the trigger: a non-numeric score counts as 0
      when (case when p_payload->>'score' ~ '^[0-9]+(\.[0-9]+)?$' then (p_payload->>'score')::numeric else 0 end) < 70 then 0
      when coalesce(p_best_before, 0) < 70 then 50
      else 20 end
    else 0 end
$$;
```

  Then `create or replace function public.apply_event()` = the **complete** body of the current one (copy it from the init migration) with these additions, keeping every existing behaviour:
  - Before the existing `exam_finished` branch, remember `v_best_before := s.exam_best`.
  - Coins: for `exam_finished`, credit `coins_for_event(...)` **only when the attempt was found** (same `found` branch that credits XP); for the other earning types, `s.coins := s.coins + public.coins_for_event(new.type, new.payload, v_best_before)`.
  - `item_purchased`: `select * into v_item from public.shop_item(new.payload->>'itemId')`; accept only if found, `s.coins >= v_item.price`, not (`kind = 'cosmetic'` and already in `s.inventory`), not (`itemId = 'streak_freeze'` and `s.streak_freezes >= 2`). On accept: `s.coins := s.coins - v_item.price`; `streak_freeze` → `s.streak_freezes + 1`; cosmetic → `array_append(s.inventory, itemId)`. Otherwise nothing.
  - `item_equipped`: `v_slot := new.payload->>'slot'`, `v_id := new.payload->>'itemId'` (JSON null → SQL null). If `v_id is null` → `s.equipped := s.equipped - v_slot`; elsif `v_id = any(s.inventory)` and `(select slot from public.shop_item(v_id)) = v_slot` → `s.equipped := jsonb_set(s.equipped, array[v_slot], to_jsonb(v_id))`.
  - Streak block (activity types only, unchanged list): replace `s.streak := case when s.last_active_day = v_day - 1 then s.streak + 1 else 1 end;` by
    ```sql
    if s.last_active_day = v_day - 1 then s.streak := s.streak + 1;
    elsif s.last_active_day is not null and (v_day - s.last_active_day - 1) <= s.streak_freezes then
      s.streak_freezes := s.streak_freezes - (v_day - s.last_active_day - 1);
      s.streak := s.streak + 1;
    else s.streak := 1;
    end if;
    ```
  - The final `update public.user_stats set …` also writes `coins`, `inventory`, `equipped`, `streak_freezes`.

  Then the **back-fill** (credits events stored before this migration, in time order, with the same rule):

```sql
update public.user_stats us set coins = coalesce(b.total, 0)
from (
  select user_id, sum(public.coins_for_event(type, payload, best_before)) as total
  from (
    select e.user_id, e.type, e.payload,
      max(case when e.type = 'exam_finished' and e.payload->>'score' ~ '^[0-9]+(\.[0-9]+)?$' then (e.payload->>'score')::numeric end)
        over (partition by e.user_id order by e.client_created_at, e.id rows between unbounded preceding and 1 preceding)::int as best_before
    from public.events e
  ) x
  group by user_id
) b
where b.user_id = us.user_id;
```

  (The back-fill credits past exam wins without checking the attempt; acceptable approximation — the trigger checks attempts from now on.)

  Finally recreate the view (same columns as before **plus** `us.coins, us.equipped->>'frame' as equipped_frame` at the end, `with (security_invoker = true)`), using `create or replace view`.

- [ ] **Step 3: Write** `supabase/tests/01_coins_shop_test.sql` (same fixture style as `00_schema_test.sql`: `begin; … select plan(N); … select * from finish(); rollback;`). Cover, with exact expected values:
  1. a perfect lesson credits 15 xu, a non-perfect lesson 10, a dialogue 5, a review 3, a badge 10;
  2. a won exam (valid attempt, score 85) credits 50 the first time, 20 the second time; a lost exam (score 40) 0; an exam event with a forged attempt id credits 0;
  3. buying `frame_bronze` with enough coins: coins −40, inventory contains it; buying it again: no change; buying with too few coins: no change; an unknown item: no change;
  4. `streak_freeze`: 2 purchases accepted, the 3rd refused (stock stays 2, coins unchanged);
  5. equipping an owned frame sets `equipped->>'frame'`; equipping an unowned one does nothing; `itemId: null` removes it; the leaderboard view shows `equipped_frame`;
  6. streak with a freeze: active day D, freeze bought, next active day D+2 → streak 2 and `streak_freezes` 0; without freezes a gap resets to 1;
  7. back-fill: run the back-fill `update` statement again on fixture events inserted with the trigger disabled (`alter table public.events disable trigger events_apply` inside the test transaction, insert, re-enable, then execute the same `update` as the migration) and check the total;
  8. a client cannot write `coins` directly (`update public.user_stats set coins = 9999` → 42501).
  Set day-dependent events through `client_created_at` (as the init tests do for streak/week).

- [ ] **Step 4: Run locally** (Docker Desktop must be running; if `docker info` fails, report BLOCKED): `npx supabase start` then `npx supabase db reset` (applies both migrations) then `npx supabase test db`. Expected: both test files pass (`00_schema_test.sql` still 38/38). Then `npx supabase stop`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261015000000_coins_shop.sql supabase/tests/01_coins_shop_test.sql
git commit -m "feat(db): coins, shop purchases, equipment and streak freezes in apply_event"
```

---

### Task 2: Shop content, event types, port, Supabase types

**Files:**
- Create: `src/content/shop.json`
- Modify: `src/content/schema.ts`, `src/domain/types.ts`, `src/ports/ContentSource.ts`, `src/adapters/content/StaticContentSource.ts` (+ its test), `src/adapters/fakes/InMemoryContentSource.ts`, `src/adapters/fakes/createFakeServices.ts`, `src/adapters/fakes/seed/` (a `shopFixture` = the JSON items), `src/adapters/supabase/types.gen.ts`, `scripts/contentChecks.ts`, `scripts/validate-content.ts`, `scripts/contentChecks.test.ts`

**Interfaces:**
- Produces:
  - `src/content/shop.json`:

```json
{
  "contentVersion": 1,
  "items": [
    { "id": "energy_refill", "kind": "consumable", "slot": null, "price": 30 },
    { "id": "streak_freeze", "kind": "consumable", "slot": null, "price": 50, "maxStock": 2 },
    { "id": "frame_bronze", "kind": "cosmetic", "slot": "frame", "price": 40 },
    { "id": "frame_jade", "kind": "cosmetic", "slot": "frame", "price": 80 },
    { "id": "frame_son_mai", "kind": "cosmetic", "slot": "frame", "price": 150 }
  ]
}
```
  - `ShopItemSchema = z.object({ id: z.string().regex(/^[a-z0-9_]+$/), kind: z.enum(["consumable", "cosmetic"]), slot: z.enum(["frame"]).nullable(), price: z.number().int().min(1), maxStock: z.number().int().min(1).optional() }).strict()`, `ShopFileSchema = { contentVersion, items: ShopItem[] (min 1) }`; types `ShopItem`, `Shop = ShopItem[]`, `ItemSlot = "frame"` (the slot enum grows later with the character: `hat`, `outfit`…).
  - `AppEventType` gains `"item_purchased" | "item_equipped"`; `EventPayload.item_purchased = { itemId: string }`, `EventPayload.item_equipped = { slot: ItemSlot; itemId: string | null }`.
  - `ContentSource.getShop(): Promise<ShopItem[]>` (StaticContentSource: eager glob of `/src/content/shop.json` like `badges.json`; InMemoryContentSource: new constructor parameter, fakes pass `shopFixture`).
  - `LeaderboardRow` gains `frame: string | null`.
  - `types.gen.ts`: add the four `user_stats` columns and the two `leaderboard` view columns (`coins`, `equipped_frame`), matching the existing generated style (hand-edit; Supabase type generation needs the linked DB).
  - Content checks: `shop` optional in `ContentBundle`, required in strict mode (`shop: missing`); ids unique (`claim`); cosmetics must have a slot, consumables must not (`shop: X slot mismatch`). Add tests for both errors.

- [ ] Steps: failing content-check tests → schema/types/port/adapters/fakes → `npm run verify` green → commit `feat(shop): add the shop catalogue, purchase/equip events and the content port`.

---

### Task 3: `services/wallet.ts` + streak freezes + bought energy refills (pure, TDD)

**Files:**
- Create: `src/services/wallet.ts`, `src/services/wallet.test.ts`
- Modify: `src/services/streak.ts` (+ test), `src/services/progress.ts` (+ test), `src/services/energy.ts` (+ test)

**Interfaces:**
- Produces:
  - `COINS = { lesson: 10, perfectBonus: 5, dialogue: 5, review: 3, badge: 10, firstBossWin: 50, bossWin: 20, bossPass: 70 } as const`
  - `type Wallet = { coins: number; inventory: string[]; equipped: Partial<Record<ItemSlot, string>>; freezes: number; refills: string[] /* ISO times of accepted energy_refill */; freezeDays: string[] /* Paris day of each accepted streak_freeze */ }` (in `@/domain/types`)
  - `walletAt(events: readonly AppEvent[], shop: readonly ShopItem[]): Wallet` — replays events in time order with exactly the Global Constraints rules (earning incl. "best score before" for exams, purchase acceptance, equipment). It does **not** consume freezes (that is the streak's job): `freezes` here = accepted `streak_freeze` purchases; `freezeDays` lists their Paris days (`parisDay` from `@/services/time`).
  - `computeStreak(activeDays, today, freezeDays: readonly string[] = [])` — replays active days in order with a freeze stock (a freeze bought on day F is available for gaps after F): consecutive day → +1; gap `g` ≤ stock → stock −g, +1; else 1. Current value at `today`: if the last active day is today or yesterday → the streak; else if the days missed up to yesterday ≤ remaining stock → the streak (still alive); else 0. Existing behaviour unchanged when `freezeDays` is empty.
  - `computeProgress(events, nowIso)` passes the freeze days (from the `item_purchased` events with `itemId: "streak_freeze"`; it cannot know acceptance without the shop, so accept the plan-level simplification: `progress.ts` receives an optional `freezeDays` argument and `activity` passes `walletAt(...).freezeDays`).
  - `energyAt(events, nowIso, refills: readonly string[] = [])` — at each refill time, energy becomes `max` (timer stops).
- [ ] Steps: TDD — write `wallet.test.ts` covering every rule of the Global Constraints (each earning type; first vs later boss win; purchase refused for each reason; freeze cap 2; equip owned/unowned/wrong slot/null), streak tests (freeze bridges 1 and 2 missed days; 3 missed days with 2 freezes resets; freeze bought after the gap does not count), energy refill test; RED → implement → GREEN → `npm run verify` → commit `feat(shop): add the pure wallet rules, streak freezes and bought energy refills`.

---

### Task 4: Activity service + app state

**Files:**
- Modify: `src/services/activity.ts` (+ test), `src/app/appState.ts`

**Interfaces:**
- Produces:
  - `ActivityService.getWallet(): Promise<Wallet>`
  - `ActivityService.purchase(itemId: string): Promise<{ ok: boolean; wallet: Wallet }>` — checks acceptance with the same rules **before** appending (refuse without appending); on accept appends a synced `item_purchased` (through the outbox, like every synced event), returns the new wallet. Unknown item → `{ ok: false }`.
  - `ActivityService.equip(slot: ItemSlot, itemId: string | null): Promise<{ ok: boolean; wallet: Wallet }>` — same pattern with `item_equipped`.
  - `ActivityResult.coinsGained: number` on every `complete*` / `finishExam` (wallet after − before).
  - `getEnergy` / `startSession` / snapshot use the wallet's `refills` / `freezeDays`.
  - `useAppState` gains `wallet: Wallet | null`, loaded by `useRefreshProgress`.
- [ ] Steps: failing tests (purchase accepted/refused, synced through outbox, energy refill restores 5, freeze extends streak in the snapshot, coinsGained on a perfect lesson = 15) → implement → `npm run verify` → commit `feat(shop): buy and equip through the activity service`.

---

### Task 5: Frames on avatars + leaderboard data

**Files:**
- Modify: `src/styles/tokens.css`, `tailwind.config.ts`, `docs/design-system.md`, `src/ui/Avatar.tsx` (+ test), `src/adapters/supabase/SupabaseLeaderboardRepository.ts` (+ test), `src/adapters/fakes/FakeLeaderboardRepository.ts`, leaderboard row/podium, public profile, `src/app/layouts/TabLayout.tsx`, `MeScreen`

**Interfaces:**
- Tokens: `--frame-bronze` (light `#9A6A3A`, dark `#C79563`), `--frame-jade` (light `#2E7D6B`, dark `#5DBB9E`), `--frame-son-mai` = gold (`var(--color-gold)`); Tailwind colors `frame.bronze`, `frame.jade`, `frame.sonmai`; documented in the design system.
- `Avatar` gains `frame?: string | null` — known frame ids render a 3 px ring in their colour (son mài: gold ring + 1 px ink inner line), unknown/null → unchanged; `aria-hidden` stays.
- Leaderboard: select `equipped_frame`, map to `LeaderboardRow.frame`; fake repo: `frame` of "me" from the local wallet, bots `null`. Rows, podium, public profile and the header avatar (own `wallet.equipped.frame`) pass `frame` to `Avatar`.
- [ ] Steps: tests (Avatar ring per frame; repository maps `equipped_frame`) → implement (load `vietlearn-design`) → check 360 px light/dark → `npm run verify` → commit `feat(shop): show equipped avatar frames on the leaderboard and profiles`.

---

### Task 6: Boutique page + coins in the UI

**Files:**
- Create: `src/features/shop/ShopScreen.tsx`, `src/features/shop/index.ts`, `src/features/shop/shop.test.tsx`
- Modify: `src/app/router.tsx`, `src/features/profile/MeScreen.tsx`, `src/app/EnergyIndicator.tsx`, done screens (`LessonDoneScreen`, dialogue done, `ReviewRunScreen` done, `ExamResultScreen`), `src/i18n/fr.ts`

**Interfaces / UX:**
- Route `/shop` inside the tab layout (lazy like the others). Entry: a « Boutique » button on the Moi screen, under the stats, showing the balance.
- Page hero = the balance (`fr.shop.balance(n)`: « 120 xu », coin glyph, gold). Sections: « Pour jouer » (recharge d'énergie, gel de série with stock « 1/2 ») and « Cadres » (three frame cards with a preview `Avatar` using the player's emoji and the frame). Each card: name, price, one button: « Acheter (40 xu) » / « Équiper » / « Équipé ✓ » (tap again to remove) / disabled « Pas assez de xu » / « Stock plein » / « Énergie déjà pleine ». Purchases ask for confirmation with the existing `ConfirmDialog` (« Acheter le cadre jade pour 80 xu ? »). After success: toast « Acheté ! » and refresh.
- Texts `fr.shop`: title « Boutique », items names/descriptions (« Recharge d'énergie » — « Remet ton énergie à 5 ⚡. » ; « Gel de série » — « Protège ta série un jour où tu ne joues pas. Utilisé automatiquement. » ; « Cadre bronze » / « Cadre jade » / « Cadre laque dorée » — « Visible au classement. »), buttons and states above, `gained: (n) => \`+${n} xu\``.
- Energy sheet: a « Recharger (30 xu) » button when energy < max and balance ≥ 30 (purchase with confirmation), else hidden.
- Done screens (lesson, dialogue, review, boss): show `fr.shop.gained(result.coinsGained)` beside the XP when > 0.
- [ ] Steps: tests (balance shown; buy frame with confirm → balance −40 and button becomes « Équiper »; equip → « Équipé ✓ »; insufficient coins disabled; freeze stock full; energy refill from the sheet sets 5; done screen shows +15 xu after a perfect lesson) → implement (load `vietlearn-design`; hero = balance; gold only for coins/rewards) → `npm run verify` → commit `feat(shop): add the shop page, coin rewards on done screens and the energy refill`.

---

### Task 7: E2E + docs

- Create `e2e/shop.spec.ts`: onboard; seed coins by inserting local `lesson_completed` events with `perfect: true` into IndexedDB (`tieng-nha` / `events`, as `e2e/boss.spec.ts` does) — 4 events = 60 xu; open Moi → Boutique; buy « Cadre bronze » (confirm); equip it; check the balance 20 xu and « Équipé ✓ ».
- Spec: header line « Étape 4 (xu, boutique) **implémentée** le <date> — plan [`2026-10-15-coins-shop.md`](../plans/2026-10-15-coins-shop.md) » and a short note listing the four deviations of this plan; `docs/README.md` row for this plan.
- `npm run verify` + `npm run test:e2e` green → commit `test(shop): e2e for buying and equipping a frame; document the coins step`.

---

### Task 8 (controller only): apply the migration to production

Not dispatched to a subagent. After the final review is clean and **before** merging the client code to `main` (the new client selects `equipped_frame`):
1. `npx -y supabase@2.121.0 db push --linked --dry-run` → shows only `20261015000000_coins_shop.sql`.
2. `npx -y supabase@2.121.0 db push --linked` (the CLI uses the stored account login; no password).
3. Verify with a read-only query through the CLI (`npx -y supabase@2.121.0 db dump --linked --schema public --data-only=false` is not needed — use `migration list --linked` to confirm the migration is applied).
4. Then merge `feat/coins-shop` into `main` and push.
