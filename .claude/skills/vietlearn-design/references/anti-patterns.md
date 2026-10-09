# Anti-patterns: what makes a UI look AI-generated

Each item: the tell, why it hurts here, what to do instead. Reviewers reject any screen that contains these.

## Color and surface
| Tell | Instead |
|---|---|
| Purple/indigo → pink/blue gradients, "aurora" blobs, gradient text | Flat lacquer colors from tokens. At most a very subtle warm radial vignette on `bg`. No gradient text, ever. |
| Glassmorphism (`backdrop-blur`, translucent white cards) | Opaque `surface` cards with warm bottom line + warm shadow. |
| Neutral gray shadows (`shadow-lg` default) | `--shadow-card` / `--shadow-raised` (warm-tinted). |
| Tailwind default palette (`blue-500`, `slate-*`, `gray-*`) | Only tokens. The default palette is disabled on purpose. |
| Everything highlighted / multiple primary buttons | One red primary action per screen; gold only for rewards. |
| Pure white `#fff` background, pure black `#000` text | `bg` cream / `ink` warm black. |

## Layout
| Tell | Instead |
|---|---|
| Hero + "3 feature cards with icon, title, 2 lines" grid | There is no marketing page. Screens are tools: one hero element, one action. |
| Every list item a same-sized rounded card with icon on the left | Vary weight: path for lessons, medal rows for top 3, pinned "me" row, plain dividers elsewhere. |
| Everything centered | Left-align text blocks; center only the single hero element (word card, score). |
| `rounded-2xl` on everything + `rounded-full` pills everywhere | Radius tokens sm/md/lg used with intent; pills only for avatars/badges. |
| Dense dashboards of stat tiles ("12 lessons · 340 XP · 7 days") | Show the one number that matters with context ("🔥 7 jours — ne casse pas ta série !"). |

## Content and copy
| Tell | Instead |
|---|---|
| Emoji at the start of every heading/button | Emojis only for avatars, badges, lesson emblem. UI uses custom SVG icons. |
| Generic copy: "Unlock your potential", « Boostez votre apprentissage », "Let's get started 🚀" | Warm, specific, tutoiement, a bit of Vietnamese: « Chào bạn ! Prêt·e pour ton premier café vietnamien ? » |
| Lorem ipsum / "Lesson 1", "Lesson 2" placeholders | Real titles and words from `src/content`. |
| Fake precision ("You're 87.3% fluent!") | Honest, simple feedback. |
| Exclamation marks and superlatives everywhere | One celebration at the right moment is worth more than ten. |

## Iconography
| Tell | Instead |
|---|---|
| Lucide/Heroicons set dropped in, mixed stroke widths | ~20 custom inline SVGs, 2 px rounded stroke, consistent 24 px grid. |
| Sparkle ✨ icons for "AI"/"magic" | No sparkles. Nothing here is magic. |
| Stock 3D blob illustrations | Small flat motifs inspired by lacquer, nón lá, lanterns, at low opacity. |

## Motion
| Tell | Instead |
|---|---|
| Everything fades-up-on-scroll | Motion only where it explains a change (navigation, feedback, reward). |
| Long (> 500 ms) easing on interactions, bouncy everything | Tokens: fast/base for UI, `spring.bouncy` only for rewards. |
| Spinners on full screen | Skeletons in `surface-2` with a sliding sheen. |
| Hover-only affordances | This is touch-first; pressed states (`whileTap`) are mandatory, hover is a bonus. |
| Animating width/height/top | transform + opacity only. |

## Typography
| Tell | Instead |
|---|---|
| Inter / system-ui default | Be Vietnam Pro everywhere. |
| Tight line-height on Vietnamese | ≥ 1.5; check stacked diacritics (ệ ở ữ ặ) aren't clipped. |
| Many sizes and weights | Only the 6 type tokens. |
