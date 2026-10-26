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
| `--frame-bronze` | `#9A6A3A` (sombre `#C79563`) | cadre d'avatar bronze (anneau 3 px), boutique | décoratif |
| `--frame-jade` | `#2E7D6B` (sombre `#5DBB9E`) | cadre d'avatar jade (anneau 3 px) | décoratif |
| `--frame-son-mai` | `var(--color-gold)` | cadre d'avatar « sơn mài » : anneau or + filet intérieur encre 1 px (l'or reste une récompense : on l'a acheté) | décoratif |

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
  frame: { bronze: 'var(--frame-bronze)', jade: 'var(--frame-jade)', sonmai: 'var(--frame-son-mai)' },
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
| **Combat : coup porté** (`src/ui/fight`, duel et boss ; option `compact` du boss : anticipation `duration.instant`) | `useFightBeat` : anticipation (`FIGHT.anticipation`, recul 10 px + accroupi `scaleX 1.04 / scaleY 0.94`) → frappe (`FIGHT.strike`, ruée à 30 % du trajet, 50 % si critique) → **arrêt sur image** (`FIGHT.hitStop`, valeur tenue entre deux keyframes, jamais un timer) → recul du défenseur (`FIGHT.recoil`, 14 px / 28 px critique, `rotate 8° / 14°`) → retour de l'attaquant (`FIGHT.settle`). Au contact : visage `hurt` (calque, sans fondu), plaque papier `opacity 0 → 0.7 → 0`, scène ±4 px (±8 px ×2 critique) pendant l'arrêt. Le beat suivant démarre à la fin du recul, pendant le retour |
| **Combat : impact encre** | `InkImpact` : un seul `<svg>` 96 px, `scale 0.6 → 1.1 → 1` + `opacity` en `FIGHT.strike`, balafre 2 chemins `pathLength 0 → 1` (`FIGHT.strike`), gouttes en éventail 12–28 px (`scale 1 → 0.4`) : 6 coup, 10 critique (or), 12 K.-O. (vermillon), 0 raté. Démonté avec son beat |
| **Combat : critique** | élan `duration.slow` + éclat or (étoile 2 traits, `scale 0 → 1 → 0`, `FIGHT.anticipation`) ; sceau vermillon « Chí mạng! » (`rotate -6°`, `scale 1.6 → 1` `spring.bouncy`) — jamais l'icône `bolt` |
| **Combat : chiffre de dégâts** | `DamageNumber` : `scale 1.4 → 1` (`spring.bouncy`), puis `y −24` et fondu sur `FIGHT.number` ; contour papier statique (`-webkit-text-stroke` + `paint-order`) ; non bloquant |
| **Combat : raté** | `duration.slow` au total : élan, balafre dans le vide à côté du défenseur, l'attaquant trébuche ; le défenseur esquive `x ±12 px` ; « Raté » au pinceau (`text-ink`, trait `ink-muted`) sous le médaillon de l'attaquant, lisible ≥ `duration.celebrate`. Ratés consécutifs = un seul beat (« Raté ×3 ») |
| **Combat : K.-O. et salut** | coup de K.-O. : `FIGHT.koHitStop`, 12 gouttes, sceau « K.-O. ». Finale (`duration.celebrate`) : la scène se voile (scrim `opacity 0 → 1`, `duration.base`, derrière les combattants) ; `KoBow` : révérence depuis les pieds (`rotate 18°`, `y +10`, `spring.soft`) vers l'adversaire, le chapeau tombe (`y +40`, `rotate 60°`, fondu, `duration.slow`) ; le gagnant fait 2 bonds (`y −10`). Nul : les deux saluent (`rotate 12°`, chapeau gardé), visage `ko` (yeux fermés). Mouvement réduit : poses finales statiques, chapeau posé à côté sans rotation |
| **Duel rejoué : rythme** | bannière de manche `duration.celebrate` ; coup = `blowTiming().length` (530 ms, 820 ms critique) ; raté(s) 360 ms ; finale `duration.celebrate`. **Total ≤ 9 s** (`REPLAY_BUDGET`) : après le K.-O. tempo ×2 (ou résumé en un beat « Encore n coups » si ça dépasse encore), puis un tempo commun plus rapide pour les autres coups ; le coup de K.-O. garde toujours son poids |
| **Boss : bande de combat** | Héros du joueur (64 px) face à Thủy Tinh (96 px), chacun sur un médaillon papier immobile. **Bonne réponse** : `useFightBeat` en mode `compact` (élan `duration.instant`, contact à 160 ms, beat de 460 ms) en parallèle de l’exercice suivant, qui ne l’attend jamais ; au contact `InkImpact`, `DamageNumber` « −1 » et la goutte de PV se détache (`WaterDropHp` : `y +18`, `rotate 30°`, fondu, `duration.slow`). **Mauvaise réponse** : une vague (1 SVG, `translateX` du boss vers le héros, `duration.base`), le héros recule de 8 px et grimace (visage `hurt`), le cœur éclate à l’arrivée de la vague. **Dernier coup** (respect : une révérence, jamais une marque sur le vaincu) : `FIGHT.koHitStop`, l’encre (12 gouttes) éclabousse **à côté** de lui, au bord de son médaillon, jamais en travers du visage ; le sceau vermillon de la victoire du joueur « Thắng! » est posé au-dessus de la bande, entre les combattants, jamais sur le boss ; puis révérence (`KoBow`, art « vaincu »), scène voilée ; résultat après ≈ 760 ms, ou tout de suite au toucher (« Passer »). **Dernière vie** : le boss lève son trident (`rotate −10°`, `spring.bouncy`), scène voilée, résultat après `duration.celebrate` (interruptible). Mouvement réduit : ni ruée, ni secousse, ni gouttes, ni vague ; visage et goutte en fondu, pose finale statique |
| **Boss : victoire** | Séquence non bloquante : révérence du boss (`KoBow`, depuis les pieds, après `duration.base`), puis titre (`delay duration.slow`), un seul compteur XP (`+ duration.base`), puis certificat (`+ 2 × duration.base`) ; entrées `opacity` + `y 12 → 0` (`duration.base`, `ease.out`). Xu et badges dans une ligne « Butin » repliée. Duo : héros 96 px et boss 88 px dans deux médaillons de 112 px, la révérence reste dans le médaillon. **Défaite** : aucune mise en scène, tout est affiché d’emblée (« Réessayer » immédiat). Mouvement réduit : pose finale immédiate, fondus seuls |
| **Gacha « Xin xăm »** (`src/features/shop/XinXamScene.tsx`, rythme `REVEAL` dans `gachaReveal.ts`, composé de `duration` ; spec son-et-révélation §5) | Panneau laque à filet or ; en-tête (« Passer ») et pied (consigne, action) fixes, seul le corps défile. Scène sur un encart papier fixe de 256 × 264 px (positions constantes, aucune mesure DOM). **Secousse** : toucher = 1 secousse, maintenir = jusqu'à 3 (`REVEAL.shake` = 2 × `duration.slow`, `rotate ±6°` + `y −2`, pivot au pied du tube), jamais de boucle infinie. **Présage** (seul indice, selon la meilleure rareté du tirage, `omenDuration` strictement croissante) : les bâtonnets nus, identiques, sortent ensemble de l'embouchure (5 au plus, en éventail, `y −76`, `REVEAL.rise` = `duration.slow`) ; commun = rien de plus (`rise + duration.base`) ; rare = lueur jade autour de l'autel, derrière son dessin (dégradé statique, `opacity 0 → 0.85` + `scale 0.5 → 1`, `duration.celebrate`) ; épique = deux lanternes rouges descendent (`y`, `duration.slow`) puis s'allument (halo or + lumière intérieure, `opacity`, `duration.slow`) ; légendaire = l'autel retient son souffle (voile encre `opacity 0.32`, `duration.slow + duration.base`), puis la lumière d'or l'envahit (dégradé + rayons statiques, 1 chemin de 12 traits, `opacity`, `duration.celebrate`) et les confettis existants une seule fois. ≤ 6 éléments animés à la fois, tout est démonté avec le présage. **Cartes** : grandes cartes faces cachées (dos laqué identique, `card-back.svg`, ≈ 130 px de haut à 360 px), une centrée pour ×1, grille de 2 colonnes pour ×10 ; les bâtonnets se rangent en cartes : chaque carte descend (`y −24`, `opacity`) large comme un bâtonnet puis s'ouvre (`scaleX 0.12 → 1`), `REVEAL.deal` = `duration.base`, décalage `duration.instant`, ≤ 3 à la fois ; rien dans le DOM ne dit la rareté avant le retournement. **Retournement** sur place (`scaleX 1 → 0 → 1`, 2 × `duration.fast`) : sceau de la rareté posé à cheval sur le bord haut (jamais sur le héros), cadre de la rareté, petit médaillon du héros ; pendant le retournement la carte garde le focus, la consigne dit « La carte se retourne… » et « Tout découvrir » reste en place, inactif ; puis la **vue centrée** : le rouleau se déroule (`scaleY 0.08 → 1`, `duration.slow`), contenu (`duration.base`), sceau (`scale 1.6 → 1`, `spring.bouncy`) ; un légendaire sans signature a d'abord ses rayons d'or (`duration.slow + duration.base`) ; avec une signature (§6), elle joue dans la vue centrée ouverte aussitôt (pas de retournement dans la grille), puis l'objet apparaît sans les rayons génériques. « Continuer » ramène à la grille, carte retournée. **Tout découvrir** : les cartes restantes se retournent de la moins rare à la plus rare (`REVEAL.chainStep` = `duration.slow`), la carte suivie défile dans la vue et la ligne d'état l'annonce (« Carte n : nom, rareté ») ; un légendaire et la dernière carte ouvrent leur vue centrée, puis le récapitulatif (nouveaux d'abord, puis par rareté). « Passer » toujours visible et Échap → récapitulatif ; mouvement réduit ou tirage récupéré → récapitulatif direct. Les résultats ne dépendent jamais de l'animation |

**Tokens de combat** (`src/ui/fight/fightTiming.ts`, composés de `duration`, aucune valeur brute) :

```ts
export const FIGHT = {
  anticipation: duration.fast,          // 150 ms d'élan
  strike: duration.instant,             // 80 ms de frappe
  hitStop: duration.instant,            // 80 ms d'arrêt sur image (coup normal)
  critHitStop: duration.instant * 2,    // 160 ms
  koHitStop: duration.instant * 3,      // 240 ms
  recoil: duration.base,                // 220 ms
  settle: duration.slow,                // 360 ms de retour en place
  number: duration.celebrate,           // 800 ms de dégâts flottants (non bloquant)
} as const;
// Ressorts : KO / révérence = spring.soft ; chiffre de dégâts et sceau = spring.bouncy. Le recul est une keyframe
// (ease.out puis ease.inOut) : un ressort n'interpole que deux valeurs, or l'arrêt sur image tient une valeur au milieu.
```

Budgets d'un beat (audit §C.3) : ≤ 8 éléments animés, ≤ 12 particules dans un seul `<svg>`, ≤ 30 nœuds FX démontés avec le beat (encre et sceaux s'effacent avant la fin de leur beat ; le chiffre de dégâts flotte jusqu'au contact suivant, déjà effacé ; « Raté » reste lisible au moins `duration.celebrate` quel que soit le tempo, immobile entre son apparition et sa sortie en `FIGHT.strike`), aucune boucle infinie, aucune mesure DOM ni `layout` pendant les beats, `will-change: transform` sur les sprites et la scène seulement pendant le combat.

## 7. Composants de base (`src/ui/`)
`Button` (variants : `primary` laqué, `secondary` contour, `ghost`, `danger` ; tailles `md`/`lg` ; état `loading`), `Card`, `Sheet` (feuille du bas, poignée, `drag="y"` pour fermer), `ProgressBar`, `Hearts`, `Avatar`, `ToneMark` (signe + couleur + nom), `ToneButton`, `XpCounter`, `StreakFlame`, `BadgeMedal`, `Toast`, `Skeleton`, `TabBar`, `PageTransition`, `FocusHeader` (✕ + progression), `EmptyState`, `ConfirmDialog`, `SpeakerButton` (🔊 + 🐢), `MicButton`, `ReportButton`.

Chaque composant : props typées, variante sombre testée, état focus visible (`outline: 3px solid var(--color-gold)`, offset 2 px), zone tactile ≥ 44×44 px, `aria-label` FR pour les boutons-icônes.

## 8. Accessibilité
- Contraste AA garanti par les tokens ; ne pas inventer de combinaisons non listées.
- Navigation clavier complète sur PC (exercices : touches 1–4 pour les choix, Entrée pour valider).
- `lang="vi"` sur tout élément contenant du vietnamien (lecteurs d'écran + césure).
- Le feedback juste/faux n'est jamais porté par la couleur seule : icône + texte.
