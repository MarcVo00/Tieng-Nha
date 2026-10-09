# UI review checklist

Answer each with yes/no. Any "no" must be fixed before the task is done. Paste the completed checklist in your task report.

## Identity
- [ ] The screen has one clear hero element and exactly one `primary` action.
- [ ] No item from `anti-patterns.md` is present (gradients, glass, default palette, emoji headings, generic copy, icon libraries).
- [ ] Gold is used only for rewards; tone colors only for tones.
- [ ] Copy comes from `src/i18n/fr.ts`, is warm and tutoie, and uses real content.

## Tokens
- [ ] `grep -nE "#[0-9a-fA-F]{3,8}|rgb\(" src/features src/ui --include=*.tsx` returns nothing new (colors only via tokens).
- [ ] Only the 6 type tokens, the 3 radius tokens and the 2 shadow tokens are used.
- [ ] Durations/easings come from `src/ui/motion.ts`.

## Motion
- [ ] Every pressable element has `whileTap` feedback.
- [ ] Only `transform`/`opacity` are animated (except the theme switch).
- [ ] The animation matches the catalogue entry in `docs/design-system.md §6.2`.
- [ ] With `prefers-reduced-motion: reduce` emulated, the screen is fully usable with simple fades.
- [ ] No interaction waits on an animation longer than 400 ms.

## Robustness
- [ ] Checked in light and dark themes.
- [ ] Checked at 360 px and 430 px width, plus desktop (centered `max-w-md` column).
- [ ] Longest Vietnamese string in the content renders without overflow or clipped diacritics.
- [ ] Touch targets ≥ 44 × 44 px; visible gold focus outline on keyboard focus.
- [ ] Icon-only buttons have a French `aria-label`; Vietnamese text has `lang="vi"`.
- [ ] Loading state (skeleton), empty state, and error state are designed, not default.
