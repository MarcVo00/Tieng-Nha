---
name: vietlearn-design
description: Design direction for the VietLearn PWA so its UI feels handcrafted (Vietnamese lacquer "Sơn mài" theme) instead of looking AI-generated. Load this BEFORE writing or modifying any React component, screen, Tailwind class, CSS, animation, icon, illustration or copy layout in VietLearn — including small tweaks like "add a button", "style this card", "make the leaderboard nicer", "add a transition", or building any feature folder under src/features or src/ui. Also use it to review an existing screen for generic/AI-looking design.
---

# VietLearn design skill

You are designing a **birthday gift**: a small app that teaches Southern Vietnamese to a French speaker and their family. The person opening it should feel that someone *made this for them* — not that a template was filled in. Generic AI-looking UI (purple gradients, glass cards, three-feature grids, emoji-in-every-heading) breaks that feeling instantly, which is why this skill exists.

The full token spec is in `docs/design-system.md`. This skill tells you **how to think** while using it, and what to avoid.

## Before you write UI code

1. Read `docs/design-system.md` (colors, type, motion catalogue). Use only its tokens.
2. Read `references/anti-patterns.md` — the list of tells that make a UI look machine-made. You will be reviewed against it.
3. Identify the **one moment** of the screen that matters (the word to learn, the score, the rank). Design around it; everything else is quieter.

## The direction: "Sơn mài" (Vietnamese lacquer)

Think of a lacquered wooden box from Hội An: deep red lacquer, gold leaf, a cream eggshell inlay, black lacquer at night. That translates to:

- **Surfaces feel like objects.** Cards sit on the cream paper with a warm 1 px bottom line and a soft warm shadow — like a tile placed on a table. Primary buttons are "lacquered": solid red with a darker 4 px bottom edge that compresses when pressed. That press is the app's tactile signature; keep it consistent everywhere.
- **Gold is earned.** Gold (`gold`) appears only for rewards: XP, stars, medals, the certificate border. If gold is everywhere it stops meaning "you did well".
- **Red means action.** `primary` is for the next thing to tap. One primary button per screen.
- **Tones have their own colors.** The six tone colors are a teaching tool, consistent across every screen (`ToneMark`). Never reuse them for decoration, never use success/error colors for tones.
- **Vietnamese text is the hero.** Big, bold, generous line-height (diacritics stack: ệ, ở, ữ). French translation is smaller and muted underneath.

## Composition principles

- **Asymmetry and rhythm over grids.** The home screen is a winding *path* of lesson stops, not a grid of identical cards. Leaderboard rows vary (top 3 get medals and more weight; your row is pinned). Vary sizes on purpose.
- **Fewer, bigger things.** A lesson screen shows one exercise, large, with lots of cream breathing room. If a screen has more than ~5 distinct elements competing, cut.
- **Real content in mockups.** Design with actual Vietnamese words from `src/content/` (`Cà phê sữa đá`, `Bao nhiêu tiền?`), not lorem ipsum — long diacritic-heavy words reveal layout bugs.
- **Copy has a voice.** Warm, short, tutoiement, a sprinkle of Vietnamese (« Đúng rồi ! », « Cố lên ! », « Giỏi quá ! »). No corporate phrasing (« Optimisez votre apprentissage »). All strings go in `src/i18n/fr.ts`.
- **Details that show care:** custom inline SVG icons (2 px rounded stroke), subtle lacquer/nón-lá/wave motifs at ≤ 8 % opacity on backgrounds, tabular numbers on counters, a real empty state with a small illustration and a sentence, not just "Aucune donnée".

## Motion: fluid, never showy

The user explicitly asked for a smooth, pleasant app. Motion is how the app feels alive — but it must stay fast.

- Use the exact catalogue and tokens in `docs/design-system.md §6` (`src/ui/motion.ts`). Don't invent new durations or easings.
- Animate only `transform` and `opacity`. Every tap gets visual feedback in < 100 ms (`whileTap={{ scale: 0.97 }}`).
- Motion should explain *where things go*: the exercise slides away left as the next arrives from the right; the feedback sheet rises from the bottom where the thumb is; word tiles physically travel (`layoutId`) into the answer line.
- Celebrations (XP counter, badge, confetti) are short, happen once, and never block "Continuer".
- Always test with `prefers-reduced-motion` on: it must still be fully usable, with simple fades.

## Workflow for any UI task

1. Sketch the hierarchy in a comment (what is the hero, what is secondary, what is the one action).
2. Build with `src/ui/` primitives first; add a new primitive only if it will be reused.
3. Check light **and** dark themes, 360 px and 430 px widths, and a long Vietnamese string.
4. Run through `references/review-checklist.md` and fix every "no" before declaring done.

## When in doubt

Ask: "Would this look at home on a lacquered gift box from Hội An, or on a startup landing page?" If it's the latter, change it.
