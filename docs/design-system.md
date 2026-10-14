# Tiếng Nhà — Design system « Sơn mài »

> Source de vérité visuelle. Tout travail UI commence par la lecture de ce fichier **et** le chargement du skill `vietlearn-design`.
> Aucune couleur, durée, rayon ou ombre en dur dans les composants : uniquement les tokens ci-dessous.

## 1. Intention

L'app doit ressembler à un **objet artisanal vietnamien**, pas à un SaaS générique. Inspiration : la **laque sơn mài** (rouge profond, or à la feuille, noir laqué, coquille d'œuf incrustée), le **papier dó** crème, les **lanternes de Hội An**, la céramique céladon. Chaleureux, tactile, un peu ludique — c'est un cadeau.

Trois mots : **chaleureux · artisanal · vivant**.

Les **personnages** (héros, skins, boss) ont leur propre guide : [direction artistique « Đông Hồ simplifié »](art-direction.md).

## 2. Couleurs

Toutes les paires ci-dessous ont été vérifiées (WCAG 2.1) : texte normal ≥ 4.5:1, sauf mention.

### 2.1 Thème clair — « Papier dó »
| Token CSS | Hex | Usage | Contraste |
|---|---|---|---|
| `--color-bg` | `#F6F0E4` | fond d'app (crème papier) | — |
| `--color-surface` | `#FFFBF3` | cartes, feuilles | — |
| `--color-surface-2` | `#EFE6D4` | zones en retrait, pistes de progression, tuiles inactives | — |
| `--color-line` | `#DDD1BC` | bordures 1 px, séparateurs | décoratif |
| `--color-ink` | `#1F1A17` | texte principal | 15.2 sur bg |
| `--color-ink-muted` | `#5E544B` | texte secondaire, légendes | 6.5 sur bg |
| `--color-primary` | `#A3201C` | rouge laque : CTA, éléments actifs, liens | 6.65 sur bg |
| `--color-primary-hover` | `#861A17` | survol / pressé | — |
| `--color-on-primary` | `#FFF8EE` | texte sur primary | 7.16 |
| `--color-gold` | `#C8962E` | or : XP, étoiles, médailles, accents décoratifs (fond) | texte ink dessus : 6.45 |
| `--color-gold-ink` | `#8A6416` | or utilisé **comme texte** | 4.73 sur bg |
| `--color-success` | `#276B54` | jade : bonne réponse, validé | 5.58 sur bg ; on-primary dessus : 6.0 |
| `--color-success-soft` | `#DCEBE2` | fond de feuille « bonne réponse » | — |
| `--color-error` | `#B4410F` | cinabre/orange brûlé : mauvaise réponse (≠ primary volontairement) | 5.0 sur bg |
| `--color-error-soft` | `#F7E0D2` | fond de feuille « mauvaise réponse » | — |
| `--color-info` | `#2C4A7A` | indigo (chàm) : infos, aide | 7.8 sur bg |
| `--color-streak` | `#D9531E` | flamme du streak (icône uniquement) | décoratif |
| `--color-scrim` | `rgb(31 26 23 / 0.35)` | voile derrière feuilles et dialogues | décoratif |
| `--color-paper` | `#F4E4C4` | papier « giấy điệp » : médaillon des personnages (identique en sombre), voir [direction artistique](art-direction.md) | — |

### 2.2 Thème sombre — « Laque noire »
| Token CSS | Hex | Contraste |
|---|---|---|
| `--color-bg` | `#15110F` | — |
| `--color-surface` | `#1F1916` | — |
| `--color-surface-2` | `#2A221E` | — |
| `--color-line` | `#3A302A` | — |
| `--color-ink` | `#F3EADB` | 15.7 |
| `--color-ink-muted` | `#B5A895` | 8.0 |
| `--color-primary` | `#E0574A` | 5.0 sur bg, 4.66 sur surface |
| `--color-primary-hover` | `#EA6D61` | — |
| `--color-on-primary` | `#1A0F0D` | 5.04 |
| `--color-gold` | `#E3B34F` | — |
| `--color-gold-ink` | `#E3B34F` | 9.7 |
| `--color-success` | `#5DBB93` | 8.0 ; texte `#15110F` dessus : 8.0 |
| `--color-success-soft` | `#1E3229` | — |
| `--color-error` | `#F08A4B` | 7.5 |
| `--color-error-soft` | `#3A2418` | — |
| `--color-info` | `#8FB0E0` | 8.5 |
| `--color-streak` | `#F07A3C` | — |
| `--color-scrim` | `rgb(0 0 0 / 0.55)` | — |

### 2.3 Couleurs des 6 tons (pédagogiques — toujours les mêmes partout)
Chaque ton a **une couleur + un signe + un nom** (jamais la couleur seule, pour les daltoniens).

| Ton | Signe | Exemple | Clair | Sombre |
|---|---|---|---|---|
| `ngang` (plat) | (aucun) | ma | `#4A5560` ardoise | `#B8C2CC` |
| `huyen` (descendant) | ` (grave) | mà | `#3D5A99` indigo | `#8FB0E0` |
| `sac` (montant) | ´ (aigu) | má | `#9A5B00` ocre | `#E8A54B` |
| `hoi` (interrogatif) | ̉ (hook) | mả | `#7A4B9A` prune | `#C9A3E6` |
| `nga` (brisé) | ˜ (tilde) | mã | `#1E6E78` sarcelle | `#6CC4CF` |
| `nang` (lourd) | ̣ (point dessous) | mạ | `#6B4A2F` brun | `#C9A27E` |

Tokens : `--tone-ngang`, `--tone-huyen`, `--tone-sac`, `--tone-hoi`, `--tone-nga`, `--tone-nang`. Tous ≥ 4.7:1 sur leur fond.
Les tons n'utilisent **jamais** les couleurs success/error, pour ne pas être confondus avec un feedback.

### 2.4 Implémentation
`src/styles/tokens.css` :
```css
:root { /* thème clair */ --color-bg: #F6F0E4; /* … tous les tokens … */ }
:root.dark { /* thème sombre */ --color-bg: #15110F; /* … */ }
```
`tailwind.config.ts` (`darkMode: 'class'`) mappe les tokens :
```ts
colors: {
  bg: 'var(--color-bg)', surface: 'var(--color-surface)', 'surface-2': 'var(--color-surface-2)', line: 'var(--color-line)',
  ink: { DEFAULT: 'var(--color-ink)', muted: 'var(--color-ink-muted)' },
  primary: { DEFAULT: 'var(--color-primary)', hover: 'var(--color-primary-hover)', on: 'var(--color-on-primary)' },
  gold: { DEFAULT: 'var(--color-gold)', ink: 'var(--color-gold-ink)' },
  success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  error: { DEFAULT: 'var(--color-error)', soft: 'var(--color-error-soft)' },
  info: 'var(--color-info)', streak: 'var(--color-streak)', scrim: 'var(--color-scrim)',
  tone: { ngang: 'var(--tone-ngang)', huyen: 'var(--tone-huyen)', sac: 'var(--tone-sac)', hoi: 'var(--tone-hoi)', nga: 'var(--tone-nga)', nang: 'var(--tone-nang)' },
}
```
La palette Tailwind par défaut est **désactivée** (`theme.colors` remplacé, pas `extend`) : `bg-blue-500`, `text-gray-600`, etc. n'existent pas, ce qui empêche les couleurs hors thème.
Thème : `settings.theme ∈ {system, light, dark}` ; la classe `dark` est posée sur `<html>` par un script inline dans `index.html` (avant le rendu, pour éviter le flash).
Objet « papier » (ex. le certificat) : `data-theme="light"` sur l’élément force les tokens du thème clair même sous `:root.dark` (bloc dédié dans `tokens.css`).
`<meta name="theme-color">` mis à jour avec `--color-bg` du thème actif.

## 3. Typographie

- Police unique : **Be Vietnam Pro** (`@fontsource/be-vietnam-pro`, poids 400, 500, 700, 800 ; sous-ensembles `latin`, `latin-ext`, `vietnamese`). Conçue au Vietnam, elle gère les diacritiques empilés (ệ ở ữ ặ) sans collision.
- `line-height` ≥ 1.5 pour tout texte vietnamien (les diacritiques ont besoin de place au-dessus et en dessous).
- Le texte vietnamien d'apprentissage est **toujours plus grand et plus gras** que sa traduction.

| Token | Taille / interligne / graisse | Usage |
|---|---|---|
| `text-display` | 40/48, 800, letter-spacing -0.02em | mot vedette d'une carte vocabulaire, score d'examen |
| `text-title` | 28/36, 800 | titres d'écran |
| `text-heading` | 20/28, 700 | titres de section, phrase VI dans un exercice |
| `text-body` | 16/24, 400 | texte courant |
| `text-body-strong` | 16/24, 600 | boutons, libellés |
| `text-caption` | 13/18, 500 | légendes, traductions secondaires, méta |

Les chiffres (XP, scores, classement) utilisent `font-variant-numeric: tabular-nums` pour ne pas « sauter » pendant les animations.

## 4. Espacement, rayons, ombres

- Échelle d'espacement : Tailwind par défaut (base 4 px). Marges d'écran : `px-5` (20 px) mobile, conteneur `max-w-md` centré (l'app est pensée téléphone ; sur PC on centre une colonne, fond `bg` décoré d'un motif discret).
- Rayons : `--radius-sm: 10px` (tuiles, chips), `--radius-md: 16px` (cartes, boutons), `--radius-lg: 28px` (feuilles, modales). Pas de `rounded-full` sauf avatars et pastilles.
- Ombres (teintées chaud, jamais grises neutres) :
  - `--shadow-card: 0 1px 0 var(--color-line), 0 6px 16px -8px rgb(80 40 20 / 0.18)`
  - `--shadow-raised: 0 2px 0 var(--color-line), 0 14px 30px -12px rgb(80 40 20 / 0.28)`
  - Sombre : mêmes formes, `rgb(0 0 0 / 0.5)`.
- **Bouton principal « laqué »** : fond `primary`, bordure basse 4 px `primary-hover` (effet relief) ; pressé : `translateY(2px)` + bordure 2 px. C'est la signature tactile de l'app.

## 5. Iconographie et illustrations

- Icônes : **inline SVG maison** dans `src/ui/icons/` (trait 2 px, extrémités arrondies, 24 px). Pas de librairie d'icônes générique (pas de lucide/heroicons) : on en a besoin d'une vingtaine.
- Emojis autorisés pour : avatars, badges, emoji de leçon. Jamais comme icône d'interface fonctionnelle (bouton, navigation).
- Motifs décoratifs SVG légers (opacité ≤ 0.08) : vagues de nón lá, écailles, nuages stylisés — en fond d'écran d'accueil, de certificat, d'en-tête de dialogue.

## 6. Mouvement (motion)

Bibliothèque : `motion` (`import { motion, AnimatePresence } from "motion/react"`). Tokens dans `src/ui/motion.ts` :

```ts
export const duration = { instant: 0.08, fast: 0.15, base: 0.22, slow: 0.36, celebrate: 0.8 } as const; // secondes
export const ease = {
  out: [0.22, 1, 0.36, 1],        // entrées
  inOut: [0.65, 0, 0.35, 1],      // déplacements
  in: [0.55, 0, 1, 0.45],         // sorties
} as const;
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 34 },   // boutons, tuiles
  soft:   { type: "spring", stiffness: 260, damping: 28 },   // feuilles, cartes
  bouncy: { type: "spring", stiffness: 420, damping: 16 },   // récompenses (XP, badge)
} as const;
```

### 6.1 Règles
1. **N'animer que `transform` et `opacity`** (et `filter` exceptionnellement). Jamais `width`, `height`, `top`, `left`, `margin` → 60 fps sur téléphone milieu de gamme.
2. Sorties plus rapides que les entrées (sortie ≈ 70 % de la durée d'entrée).
3. Aucune animation > 400 ms sur un chemin d'interaction (sauf célébrations, non bloquantes : l'utilisateur peut toujours toucher « Continuer »).
4. `prefers-reduced-motion: reduce` → `MotionConfig reducedMotion="user"` à la racine : les déplacements deviennent de simples fondus de 120 ms, pas de confettis, pas de secousse.
5. Toute réponse à un toucher a un retour visuel en < 100 ms (`whileTap={{ scale: 0.97 }}` sur tout élément pressable).

### 6.2 Catalogue (à implémenter tel quel)
| Moment | Animation |
|---|---|
| **Navigation entre onglets** | fondu croisé 150 ms + léger `y: 8 → 0` à l'entrée ; `AnimatePresence mode="wait"` dans `PageTransition` |
| **Entrer dans une leçon / dialogue / examen** | l'écran monte du bas (`y: 100% → 0`, `spring.soft`) ; sortie inverse ; la tab bar glisse hors écran |
| **Exercice suivant** | sortie `x: 0 → -24, opacity → 0` (fast) ; entrée `x: 24 → 0` (base, ease.out) |
| **Barre de progression** | `scaleX` animé avec `spring.soft`, `transform-origin: left` |
| **Valider une réponse** | feuille de feedback monte du bas (`spring.soft`) ; bonne réponse : la tuile choisie pulse `scale 1 → 1.06 → 1` + coche dessinée (`pathLength 0 → 1`, 250 ms) ; mauvaise : secousse horizontale `x: [0,-6,6,-4,4,0]` 300 ms |
| **Perte d'un cœur** | cœur `scale 1 → 1.3 → 0` + fondu |
| **Tuiles word_order** | déplacement partagé `layout` + `layoutId` entre la réserve et la ligne réponse |
| **Carte vocabulaire** | pile : carte suivante passe de `scale 0.94, y 10` à `scale 1, y 0` ; swipe avec `drag="x"` et seuil 80 px |
| **Micro (STT) en écoute** | 3 anneaux concentriques qui pulsent (`scale` + `opacity`), couleur primary |
| **XP gagnés** | compteur numérique animé (`animate()` de motion sur une valeur, 600 ms, tabular-nums) + « +15 » qui monte et disparaît |
| **Badge débloqué** | toast du haut, badge `scale 0 → 1` avec `spring.bouncy` + éclat doré (rotation lente) |
| **Fin de leçon** | confettis maison (20–30 losanges or/rouge/jade en `motion.div`, 800 ms, une fois) — pas de librairie |
| **Bulles de dialogue** | indicateur « … » 600 ms puis bulle `scale 0.9 → 1, opacity 0 → 1` depuis son coin d'origine (`transform-origin`) |
| **Onglets Semaine/Total** | soulignement partagé `layoutId="tab-underline"` |
| **Lignes du classement** | entrée en cascade `staggerChildren: 0.03` ; changement de rang animé par `layout` |
| **Chargement** | squelettes `surface-2` avec reflet qui glisse (`translateX`), jamais de spinner plein écran |
| **Bascule de thème** | transition CSS `background-color, color` 200 ms sur `html` (exception autorisée à la règle 1, une seule fois) |

## 7. Composants de base (`src/ui/`)
`Button` (variants : `primary` laqué, `secondary` contour, `ghost`, `danger` ; tailles `md`/`lg` ; état `loading`), `Card`, `Sheet` (feuille du bas, poignée, `drag="y"` pour fermer), `ProgressBar`, `Hearts`, `Avatar`, `ToneMark` (signe + couleur + nom), `ToneButton`, `XpCounter`, `StreakFlame`, `BadgeMedal`, `Toast`, `Skeleton`, `TabBar`, `PageTransition`, `FocusHeader` (✕ + progression), `EmptyState`, `ConfirmDialog`, `SpeakerButton` (🔊 + 🐢), `MicButton`, `ReportButton`.

Chaque composant : props typées, variante sombre testée, état focus visible (`outline: 3px solid var(--color-gold)`, offset 2 px), zone tactile ≥ 44×44 px, `aria-label` FR pour les boutons-icônes.

## 8. Accessibilité
- Contraste AA garanti par les tokens ; ne pas inventer de combinaisons non listées.
- Navigation clavier complète sur PC (exercices : touches 1–4 pour les choix, Entrée pour valider).
- `lang="vi"` sur tout élément contenant du vietnamien (lecteurs d'écran + césure).
- Le feedback juste/faux n'est jamais porté par la couleur seule : icône + texte.
