# Sons et nouvelle révélation du gacha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Tiếng Nhà synthesized Vietnamese-flavoured sound effects (lessons, fights by equipment, arena, gacha) and replace the « Xin xăm » stick-picking reveal with a rarity crescendo, face-down cards and per-legendary signature scenes.

**Architecture:** A `SoundPlayer` port (domain cue catalogue) implemented by a Web Audio adapter that synthesizes each cue from a small recipe (no files), plus a recording fake. The container wraps the speech synthesizer to know when the voice is speaking, so the adapter skips/softens cues then. An app component unlocks the audio context on the first gesture and mirrors the `sound` setting. Features call `services.sound.play(cue)`. The gacha reveal stays a pure reducer (`gachaReveal.ts`, rewritten) driving `XinXamScene`; signatures are components registered by item id.

**Tech Stack:** Vite 5, React 18, TS strict, Tailwind 3.4 tokens, motion 11, Web Audio API (no new dependency), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-sound-and-gacha-reveal-design.md` (approved by Marc 2026-10-26). Also: `docs/superpowers/specs/2026-10-21-gacha-design.md` (server rules unchanged), ADR 0010 + `docs/superpowers/specs/2026-10-20-design-polish-audit.md` §D (motion budgets), `docs/art-direction.md`.

## Global Constraints

- No new dependency. TS strict, no `any`/`enum`/`@ts-ignore`, `@/` imports. ESLint boundaries: features/ui never import adapters/content; no feature→feature; app-hooks never import features; services pure (no `Date.now`/`Math.random`, inject them).
- UI strings in `src/i18n/fr.ts` (French, tutoiement, U+202F before `? ! : ;` and inside « »); Vietnamese words `lang="vi"`. Tokens only. UI tasks load the `vietlearn-design` skill.
- Sound: Web Audio only, synthesized; timbre « bloc de bois (mõ), gong, clochettes, cordes pincées façon đàn tranh ». Audio context created/resumed only from a user gesture; no Web Audio → silent, never throws. « Sons » setting default **on**. While the Vietnamese voice is speaking, a cue is skipped or played much lower — it never cuts the voice. Same cue not replayed within **50 ms**; at most **6** voices sounding at once (oldest dropped). iPhone silent switch: no special handling (effects behave like the voice).
- Motion (audit §D): transform/opacity only, no blur/filter animation, ≤ 8 animated elements and ≤ 12 particles per SVG, no infinite loop; « Passer » always visible; reduced motion → recap directly. **Signature exception:** ≤ 16 animated elements, ≤ 12 particles per SVG, no loop, all nodes unmounted at the end. 4× CPU check (0 long tasks, frame gaps reported) for every reveal task.
- Gacha: results come from the server before any animation; touching a card only changes reveal order; skip / « Tout découvrir » / reduced motion / recovered pull show exactly the same draw. Reveal-all order: lowest rarity first, highest last (stable by original index within a rarity). Card targets ≥ 44 px (aim ≥ 120 px tall).
- Delivery order (spec §1), each shippable alone: Tasks 1–2 (engine + lessons), 3–4 (gacha), 5 (signature), 6 (fights + arena), 7 (release).
- **Shell safety:** the repo path contains a space — always quote paths/variables, never `rm -rf` outside the repo or `.superpowers/`, `ls` a target before deleting.
- **Commits: Marc only; never `Co-Authored-By`, never a Claude/AI mention.** `npm run lint && npm run verify` (and `npm run test:e2e` for flow tasks) green before DONE.

## Review Focus

1. A cue fired before any user gesture (iOS: context locked) or with no `AudioContext` → nothing plays, no error, and later cues play once a gesture unlocked it (Task 1 test « locked then unlocked »).
2. The voice is speaking (lesson word, dialogue) when « bonne réponse » fires → the voice is not cut and the cue is skipped/softened (Task 1 test « voice busy »; Task 2 e2e asserts the fake recorded `answer.correct` only after speech ended or with `soft: true`).
3. Rapid cues (ten cards flipped by « Tout découvrir », fast answers) → no pile-up: 50 ms dedupe and 6-voice cap (Task 1 tests).
4. Settings saved before 1.7 (no `sound` key) → sounds on; turning « Sons » off survives a reload and silences everything, including the gacha omen (Task 1 Dexie test + Task 2 e2e).
5. Interrupted reveal (« Passer » during the omen or during a signature, app backgrounded mid-reveal) → audio stops with the scene (no orphan gong), the recap shows the same items (Task 3 and Task 5 tests: `stopAll` called on unmount/skip).

---

### Task 1: Sound engine, setting and unlock

**Files:**
- Create: `src/domain/sound.ts`, `src/ports/SoundPlayer.ts`, `src/adapters/audio/WebAudioSoundPlayer.ts`, `src/adapters/audio/recipes.ts`, `src/adapters/audio/index.ts`, `src/adapters/fakes/FakeSoundPlayer.ts`, `src/app/SoundSync.tsx`, `src/app/speakingTracker.ts`; ADR `docs/adr/0012-sound-effects.md`.
- Modify: `src/ports/index.ts`, `src/app/services.ts`, `src/app/container.ts`, `src/adapters/fakes/createFakeServices.ts`, `src/adapters/fakes/index.ts`, `src/domain/types.ts` (`Settings.sound: boolean`), `DEFAULT_SETTINGS` (wherever defined), `src/adapters/dexie/DexieProgressRepository.ts` (default merge already handles a missing key — add the test), `src/app/Root.tsx` (mount `<SoundSync />`), `src/features/profile/SettingsSection.tsx` (« Sons » switch), `src/i18n/fr.ts`, `docs/README.md` (ADR index).
- Test: `src/adapters/audio/WebAudioSoundPlayer.test.ts`, `src/app/speakingTracker.test.ts`, `src/app/SoundSync.test.tsx`, `src/adapters/dexie/dexie.test.ts`, `src/features/profile/profile.test.tsx`.

**Interfaces:**
- Produces (`src/domain/sound.ts`):
  ```ts
  export const SOUND_CUES = [
    "answer.correct", "answer.wrong", "lesson.won", "lesson.lost", "heart.lost",
    "gacha.shake", "gacha.omen.common", "gacha.omen.rare", "gacha.omen.epic", "gacha.omen.legendary",
    "gacha.flip.common", "gacha.flip.rare", "gacha.flip.epic", "gacha.flip.legendary",
    "sig.wind", "sig.brush", "sig.gong",
    "blow.blade", "blow.staff", "blow.fan", "blow.fist", "blow.acc_thuan_thien", "blow.char_phap_su", "blow.char_kiem_khach",
    "fight.hurt", "fight.miss", "arena.start", "arena.victory", "arena.defeat", "arena.coins",
  ] as const;
  export type SoundCue = (typeof SOUND_CUES)[number];
  export type PlayOptions = { strong?: boolean }; // strong: louder, sharper attack (critical hit)
  ```
- Produces (`src/ports/SoundPlayer.ts`):
  ```ts
  export interface SoundPlayer {
    play(cue: SoundCue, opts?: PlayOptions): void; // never throws; no-op when disabled, locked or unsupported
    stopAll(): void;            // fades out everything sounding (≤ 80 ms)
    unlock(): void;             // call from a user gesture: creates/resumes the AudioContext
    setEnabled(on: boolean): void;
  }
  ```
- Produces: `Services.sound: SoundPlayer`; `FakeSoundPlayer` with `played: { cue: SoundCue; strong: boolean; soft: boolean }[]` and `stopped: number`, exposed on `window.__sounds` in fakes mode for e2e (same pattern as other e2e hooks in `e2e/helpers.ts`).
- Produces (`src/app/speakingTracker.ts`): `trackSpeaking(tts: SpeechSynthesizer): SpeechSynthesizer & { isSpeaking(): boolean }` — counts in-flight `speak` calls (decrement on resolve/reject/`cancel`).
- `WebAudioSoundPlayer` constructor: `new WebAudioSoundPlayer({ isVoiceBusy: () => boolean, now?: () => number, createContext?: () => AudioContext | null })`.

- [ ] **Step 1: Failing tests** (`WebAudioSoundPlayer.test.ts`, with a minimal fake `AudioContext` that records created nodes/starts):
  - `locked then unlocked`: `play("answer.correct")` before `unlock()` starts nothing; after `unlock()`, `play` starts ≥ 1 source.
  - `no Web Audio`: `createContext` returns `null` → `unlock()` and `play()` don't throw, start nothing.
  - `disabled`: `setEnabled(false)` → nothing starts; `setEnabled(true)` → starts again.
  - `dedupe`: two `play("gacha.flip.common")` at `now` = 0 and 30 → one start; at 0 and 60 → two.
  - `voice cap`: 8 different cues in a row → at most 6 sounding (oldest stopped).
  - `voice busy`: `isVoiceBusy` true → `answer.correct` not started (or gain ≤ 0.25 × normal; pick one and assert it).
  - `strong`: `play("blow.blade", { strong: true })` peak gain > normal peak gain.
  - `every cue has a recipe`: for each of `SOUND_CUES`, `recipes[cue]` exists (a recipe may be a shared placeholder until Tasks 4–6 refine it; Task 1 must make the lesson cues real).
  - `speakingTracker.test.ts`: `isSpeaking()` true between `speak()` and its resolution, false after reject and after `cancel()`.
  - `dexie.test.ts`: a stored settings row without `sound` reads back `sound: true`.
- [ ] **Step 2: Run** `npx vitest run src/adapters/audio src/app/speakingTracker.test.ts src/adapters/dexie` → FAIL (modules missing).
- [ ] **Step 3: Implement** domain cues, port, `recipes.ts` (`Record<SoundCue, (ctx: AudioContext, out: AudioNode, at: number, strong: boolean) => { stop(at: number): void; end: number }>`), the adapter (master gain → destination, 50 ms dedupe map, 6-voice queue), `trackSpeaking`, fake, container wiring (`tts: trackSpeaking(rawTts)`, `sound: new WebAudioSoundPlayer({ isVoiceBusy: tts.isSpeaking })`; fakes use `FakeSoundPlayer` recording `soft` when the tracked fake TTS is speaking), `Settings.sound` default `true`. Real recipes now for `answer.correct` (short bright mõ + pluck, ≤ 250 ms), `lesson.won` (same family, longer rising phrase, ≤ 1.6 s), `heart.lost` (dry low thud + short noise, ≤ 300 ms), `lesson.lost` (low descending pluck phrase, not harsh, ≤ 1.5 s), `answer.wrong` (soft muted wood, ≤ 200 ms).
- [ ] **Step 4: `SoundSync`** (`src/app/SoundSync.tsx`, mounted once in Root): calls `sound.setEnabled(settings.sound)` on change; on the first `pointerdown`/`keydown` (capture, `{ once: true }` semantics but re-armed on `visibilitychange` → visible, because iOS suspends the context) calls `sound.unlock()`. Test (`SoundSync.test.tsx`): with the fake, toggling the setting calls `setEnabled`; a pointerdown calls `unlock`.
- [ ] **Step 5: « Sons » switch** in `SettingsSection.tsx` (fr: `profile.settings.sound: { label: "Sons", hint: "Effets sonores des leçons, des combats et du tirage." }`), saved through the existing settings save path. Test in `profile.test.tsx`: the switch is on by default, turning it off saves `sound: false`.
- [ ] **Step 6: ADR 0012** « Effets sonores synthétisés » (context, decision: Web Audio synthesis, port/adapter, voice priority, unlock-on-gesture, iOS silent switch behaviour as decided in the spec; consequences) + index line in `docs/README.md`.
- [ ] **Step 7: Run** `npm run lint && npm run verify` → green.
- [ ] **Step 8: Commit** `feat(sound): synthesized sound engine and the « Sons » setting`.

### Task 2: Lesson, review and boss sounds + listening panel

**Files:**
- Modify: `src/features/lessons/useLessonRun.ts` (or `LessonScreen.tsx`), `src/features/lessons/LessonDoneScreen.tsx`, `src/features/review/*` run screen, `src/features/exam/ExamRunScreen.tsx`, `src/features/exam/ExamResultScreen.tsx`, `src/features/profile/DemoPanel.tsx` (« Écouter les sons »), `src/i18n/fr.ts`.
- Test: `src/features/lessons/lessons.test.tsx`, exam tests, `src/features/profile/DemoPanel.test.tsx`, `e2e/sound.spec.ts` (new).

**Interfaces:**
- Consumes: `useServices().sound.play(cue)` (Task 1), `SOUND_CUES`.

- [ ] **Step 1: Failing tests** (fake sound player via `createFakeServices()`):
  - lessons: a correct answer records `answer.correct`; a wrong answer that costs a heart records `heart.lost` (not `answer.wrong`); a wrong answer without heart loss records `answer.wrong`; finishing records `lesson.won` once (StrictMode-safe); running out of hearts records `lesson.lost` once.
  - exam (boss): correct → `answer.correct`; life lost → `heart.lost`; victory → `lesson.won`; defeat → `lesson.lost`.
  - review: correct/wrong → `answer.correct`/`answer.wrong` (no hearts there).
  - `DemoPanel`: in demo mode a « Écouter les sons » list has one button per `SOUND_CUES` entry (label = the cue id is acceptable — demo only) and tapping one records it.
- [ ] **Step 2: Run** those files → FAIL.
- [ ] **Step 3: Implement** the calls at the points where the result is applied (one call per transition; use the existing `handledKey`-style guards so re-renders never replay a cue).
- [ ] **Step 4: e2e** `e2e/sound.spec.ts` (fakes): answer one exercise correctly → `window.__sounds.played` contains `answer.correct`; turn « Sons » off in Moi, reload, answer again → nothing new recorded (Review Focus 4); while the fake TTS is speaking, a correct answer is recorded with `soft: true` (Review Focus 2).
- [ ] **Step 5: Listen**: run the demo locally, play every lesson cue from the panel, adjust recipes until they are pleasant and clearly distinct; note in the report what each sounds like (one line each).
- [ ] **Step 6: Run** `npm run lint && npm run verify && npm run test:e2e` → green.
- [ ] **Step 7: Commit** `feat(sound): lesson, review and boss sounds`.

### Task 3: The new reveal — omen and face-down cards

**Files:**
- Rewrite: `src/features/shop/gachaReveal.ts`, `src/features/shop/gachaReveal.test.ts`, `src/features/shop/XinXamScene.tsx` (+ `XinXamScene.test.tsx`, `XinXamScene.reduced.test.tsx`).
- Create: `src/assets/gacha/card-back.svg`, `src/assets/gacha/lantern.svg` (Đông Hồ style, < 6 KB each); omen lights may be CSS/SVG shapes.
- Remove: stick-tip art usage (`stick-{rarity}.svg` no longer shown before the reveal; delete the files only if nothing references them).
- Modify: `src/i18n/fr.ts` (`gacha.scene.*`: drop stick/tip strings, add `revealAll: "Tout découvrir"`, card labels), `e2e/gacha.spec.ts`, `e2e/shop.spec.ts`, `e2e/helpers.ts` (`shakeTube` stays), `docs/design-system.md` §6.2 row.

**Interfaces:**
- Produces (`gachaReveal.ts`, pure):
  ```ts
  export type RevealPhase = "tube" | "shaking" | "omen" | "cards" | "focus" | "signature" | "recap";
  export type RevealState = { phase: RevealPhase; top: Rarity; flipped: boolean[]; current: number | null; queue: number[]; shake: number; held: boolean };
  export function topRarity(items: readonly GachaPullItem[]): Rarity;
  export function revealAllOrder(items: readonly GachaPullItem[], flipped: readonly boolean[]): number[]; // unflipped, rarity asc, index asc
  export function omenDuration(top: Rarity): number; // seconds, strictly increasing common < rare < epic < legendary
  export function initialReveal(items: readonly GachaPullItem[], opts: { direct: boolean }): RevealState; // direct → phase "recap"
  export function revealReducer(s: RevealState, a: RevealAction): RevealState;
  export type RevealAction =
    | { type: "press" } | { type: "release" } | { type: "shakeEnd" } | { type: "omenEnd" }
    | { type: "flip"; index: number } | { type: "close" } | { type: "revealAll" } | { type: "signatureEnd" } | { type: "skip" };
  // "flip" on a legendary with a registered signature → phase "signature" then "focus"; otherwise → "focus".
  // "revealAll" → queue = revealAllOrder(...); each "close" pops the next queued index into focus; empty queue → "recap".
  export function hasSignature(itemId: string): boolean; // re-exported from the signature registry (Task 5); Task 3 ships a registry that returns false
  ```
- Produces: `XinXamScene` props unchanged (`pull`, `recovered`, `items`, `baseLook`, `onClose`), so `ShopScreen.presentPull` is untouched.

- [ ] **Step 1: Failing tests** `gachaReveal.test.ts`: `topRarity` of 9 commons + 1 rare = `rare`; `omenDuration` strictly increasing; `revealAllOrder` for rarities `[epic, common, legendary, common]` all unflipped = `[1, 3, 0, 2]`; flipping index 2 then `revealAll` excludes 2; `skip` from any phase → `recap` with the same items; `initialReveal(..., { direct: true }).phase === "recap"`; stray actions ignored (e.g. `flip` during `omen`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the reducer.
- [ ] **Step 4: Scene** — tube (shake as today) → all sticks rise together, identical bare wood → omen by `top` (common: wood clack only, no light; rare: jade glow on the altar; epic: two red lanterns light up; legendary: veil + static gold rays + confetti once; durations from `omenDuration`, built from motion tokens) → sticks settle into face-down cards: ×1 one centred card, ×10 a 2-column grid inside the panel's scroll area (the gold fillet stays on the frame, as fixed in a9f19d6). Tap a card → flips in place (scale X 1→0→1, transform only) showing the rarity seal/colour → opens the focus view (the existing scroll component, hero wearing the item, name, « Nouveau ! » / « Déjà obtenu → +N xu ») → « Continuer » back to the grid where the card stays flipped with a small medallion. « Tout découvrir » follows `revealAllOrder`. « Passer » always visible. Recap unchanged. Keep the a11y fixes from 9632ada (status announces the result in focus, initial focus on the tube, focus returns to the next face-down card).
- [ ] **Step 5: Scene tests**: no rarity is exposed (no `data-rarity`, no rarity text, no tip colour) on cards before they flip — assert the DOM of the grid before any flip contains none of the four rarity names and no `[data-rarity]`; flipping card 3 shows its item; « Tout découvrir » reveals in `revealAllOrder`; reduced motion renders the recap directly; recovered → recap.
- [ ] **Step 6: e2e** rewrite the stick-based steps in `gacha.spec.ts`/`shop.spec.ts` (fixed rolls via `fixGachaRolls`): ×1 shake → card → flip → focus → Continuer; ×10 → « Tout découvrir » → recap; reduced motion → recap; « Passer » during the omen → recap with 10 items.
- [ ] **Step 7: Shots + perf**: 360 px light/dark bursts of each omen level (seed rolls to force each top rarity), the grid, a flip, the focus view, into the workspace `shots/`; 4× CPU run of a legendary ×10 (0 long tasks; report frame gaps).
- [ ] **Step 8: Run** `npm run lint && npm run verify && npm run test:e2e` → green. **Commit** `feat(shop): the reveal builds up to the best piece, with cards`.

### Task 4: Gacha sounds

**Files:** `src/adapters/audio/recipes.ts` (gacha cues), `src/features/shop/XinXamScene.tsx`, tests.

**Interfaces:** Consumes `RevealPhase`/`topRarity` (Task 3), `sound.play`/`stopAll` (Task 1).

- [ ] **Step 1: Failing tests** (`XinXamScene.test.tsx`, fake player): shaking records `gacha.shake` (≤ 1 per 300 ms of shaking); entering `omen` records exactly one `gacha.omen.<top>`; each flip records `gacha.flip.<rarity of that card>`; « Tout découvrir » over ten cards records ten flips in `revealAllOrder` rarities; « Passer » and unmount call `stopAll` (Review Focus 5); reduced motion records only `gacha.flip.<top>` once, at the recap.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the calls (from phase transitions/effects keyed on phase, never from animation callbacks) and the recipes: shake = bamboo rattle (short noise bursts through a band-pass); omen.common = one wood clack; omen.rare = three jade bell partials, airy; omen.epic = mid gong with a lantern « whoosh »; omen.legendary = deep gong, ~0.6 s pause, then a shimmering rise (≤ 3 s total); flip.* = same instruments, short (≤ 600 ms), loudness increasing with rarity.
- [ ] **Step 4: Listen** in the demo (panel + real pulls), tune, describe each cue in one line in the report.
- [ ] **Step 5: Run** `npm run lint && npm run verify` → green. **Commit** `feat(sound): the pagoda rings louder for rarer pieces`.

### Task 5: Signature reveals — La gardienne des talismans

**Files:**
- Create: `src/features/shop/signatures/index.ts` (registry), `src/features/shop/signatures/TalismanGuardian.tsx`, `src/assets/gacha/talisman.svg`, `src/assets/gacha/ink-silhouette.svg` (Đông Hồ style, < 6 KB each), tests.
- Modify: `src/features/shop/gachaReveal.ts` (`hasSignature` now reads the registry), `XinXamScene.tsx` (renders the registered signature in the focus view during phase `signature`, then dispatches `signatureEnd`), `src/adapters/audio/recipes.ts` (`sig.wind`, `sig.brush`, `sig.gong`).

**Interfaces:**
- Produces: `export type SignatureProps = { onEnd: () => void; reduced: boolean }; export const SIGNATURES: Readonly<Record<string, ComponentType<SignatureProps>>>; export function hasSignature(itemId: string): boolean;` — registry keyed by item id; `char_phap_su` → `TalismanGuardian`. A legendary without an entry gets the generic gold treatment from Task 3 (no `signature` phase).

- [ ] **Step 1: Failing tests**: `hasSignature("char_phap_su") === true`, `hasSignature("hat_thuy_tinh") === false`; flipping a `char_phap_su` card enters `signature`, then (fake timers) the focus view with the item; « Passer » during the signature → recap, `stopAll` called, signature unmounted; two legendaries in one pull each play their signature on their own flip; reduced motion never mounts a signature.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `TalismanGuardian` (spec §6.2, ~3–4 s): card darkens → `sig.wind` + 12 talismans (yellow paper, red seal) swirl around the altar → seals ignite gold one by one with `sig.brush` → talismans converge into the ink silhouette → `sig.gong`, ink splash (scale/opacity) → `onEnd`. Timing from one pure schedule exported for the test; budget ≤ 16 animated elements, ≤ 12 particles per SVG, no loop, everything unmounted at `onEnd`.
- [ ] **Step 4: Shots + perf**: bursts of each beat at 360 px light/dark; 4× CPU run (0 long tasks, frame gaps reported).
- [ ] **Step 5: Run** `npm run lint && npm run verify && npm run test:e2e` → green. **Commit** `feat(shop): the talisman guardian's own reveal`.

### Task 6: Fight and arena sounds

**Files:**
- Create: `src/domain/blowSound.ts` (+ test).
- Modify: `src/features/duels/DuelResultScreen.tsx` (replay beats), `src/features/duels/DuelRunScreen.tsx` / `DuelsScreen.tsx` (start gong), `src/features/duels/ArenaScreen.tsx` (Kim bài coins where a gain is shown), `src/features/exam/ExamRunScreen.tsx` (hero blows on the boss), `src/adapters/audio/recipes.ts` (blow/fight/arena cues), tests.

**Interfaces:**
- Produces:
  ```ts
  export type WeaponFamily = "blade" | "staff" | "fan" | "fist";
  export const WEAPON_FAMILY: Readonly<Record<string, WeaponFamily>>; // acc_giao_tre: "staff" (spear), acc_quat_sat: "fan", acc_con_vo: "staff", acc_thuan_thien: "blade"
  export function blowCue(look: { accessory: string | null; character: string | null }, rarityOf: (id: string) => Rarity | null): SoundCue;
  // accessory epic+ → `blow.<accessoryId>` when that cue exists; else accessory family → `blow.<family>`;
  // no accessory: character epic+ with a `blow.<characterId>` cue → that cue; else "blow.fist".
  ```
- Consumes: `Look` type used by `FighterSprite`/hero rendering (whatever the duel replay already holds for both fighters), the shop catalogue rarity (through `ContentSource`, as the shop already does).

- [ ] **Step 1: Failing tests** `blowSound.test.ts`: `{ accessory: "acc_thuan_thien" }` → `blow.acc_thuan_thien`; `acc_quat_sat` (rare) → `blow.fan`; `acc_con_vo` (no rarity) → `blow.staff`; no accessory + `char_phap_su` → `blow.char_phap_su`; no accessory + base character → `blow.fist`; an unknown accessory id → `blow.fist`. Duel replay test: a hero blow records the hero's `blowCue`; the opponent's blow records the opponent's `blowCue` plus `fight.hurt`; a critical records the cue with `strong: true`; a miss records `fight.miss`; start of the replay records `arena.start`; the result records `arena.victory`/`arena.defeat`; a Kim bài gain records `arena.coins`. Boss: hero blows use the hero's `blowCue`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the calls on the existing beat schedule (same timer as the visual blow, not animation callbacks) and the recipes: blade = metallic swish + ring; staff = wooden whoosh + thock; fan = paper flap + iron snap; fist = short body thump; `blow.acc_thuan_thien` = blade with a resonant jade ring; `blow.char_phap_su` = paper talisman crackle + soft bell; `blow.char_kiem_khach` = quick double swish; `fight.hurt` = dull impact; `fight.miss` = air whoosh; `arena.start` = gong; `arena.victory` = short fanfare of gong + plucks; `arena.defeat` = soft descending pluck; `arena.coins` = small metallic clinks.
- [ ] **Step 4: Listen** in the demo (receive a challenge, play, watch the replay), tune.
- [ ] **Step 5: Run** `npm run lint && npm run verify && npm run test:e2e` → green. **Commit** `feat(sound): blows sound like the gear, and the arena has its gong`.

### Task 7: e2e, version, changelog

- [ ] e2e sweep: `e2e/sound.spec.ts` gains a gacha ×10 with fixed rolls asserting the omen cue for the forced rare (`gacha.omen.rare`) and ten flips; a duel replay asserting `arena.start` then blows. No `test.skip`.
- [ ] `package.json` → **1.7.0**; changelog entry (newest first) `{ version: "1.7.0", date: <release day>, title: "Le son de la pagode" }`, 3–4 short French items for Mathias (e.g. « L'appli fait maintenant du bruit : bonnes réponses, victoires, coups reçus. », « Au tirage, plus la pièce est rare, plus la pagode résonne. », « Les cartes se retournent d'un doigt, ou toutes d'un coup. », « La gardienne des talismans a sa propre apparition. »; a « Sons » switch in Moi), U+202F typography; update tests pinned to 1.6.1.
- [ ] `npm run lint && npm run verify && npm run test:e2e` green. Commit `test(e2e): sound and reveal flows; v1.7.0`.

### Task 8 (controller): ship

Merge to `main`, push `main` and `main:feat/v1`, refresh `demo`, check the bundle contains « Le son de la pagode ». No migration.
