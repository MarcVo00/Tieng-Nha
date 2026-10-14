# Direction artistique des personnages — « Đông Hồ simplifié »

> Statut : **validé** par Marc le 2026-10-14 (style C, simplifié). S'applique aux héros (l'apprenant, ses skins) et aux boss.
> Complète le [design system « Sơn mài »](design-system.md) : l'interface reste en laque, les **personnages** suivent ce guide.
> Références dessinées : [`docs/art/hero-base.svg`](art/hero-base.svg), [`docs/art/boss-thuy-tinh.svg`](art/boss-thuy-tinh.svg), aperçu [`docs/art/preview-medallion.png`](art/preview-medallion.png).

## 1. Intention

Les estampes populaires de **Đông Hồ** (gravures sur bois du Têt) : aplats francs, contour noir, couleurs végétales, papier nacré. On garde leur **esprit** et on **simplifie** : moins de détails, des formes rondes et lisibles en petit, pour que les personnages vivent dans un jeu mobile.

Trois mots : **populaire · rond · imprimé**.

Ce n'est **pas** : du chibi brillant de jeu mobile, de la 3D, des dégradés, du réalisme.

## 2. Palette des personnages

Palette fermée, inspirée des pigments Đông Hồ. Un personnage utilise **4 à 5 teintes** au plus, plus le noir du contour.

| Nom | Hex | Pigment d'origine | Usage |
|---|---|---|---|
| Đen (noir) | `#1F1A17` | charbon de feuilles de bambou | contour, cheveux, yeux |
| Đỏ son (vermillon) | `#B23A2A` | terre rouge | vêtements du héros, joues, accents |
| Vàng hoè (jaune) | `#D9A93A` | fleur de sophora | nón lá, couronnes, or |
| Xanh chàm (indigo) | `#2B4E6E` | indigo | pantalons, robes, eau |
| Lục (vert) | `#4E7A4A` | feuilles | nature, Thánh Gióng, tortue |
| Điệp (crème nacré) | `#F4E4C4` | coquille Saint-Jacques (papier điệp) | médaillon, barbes, motifs clairs |
| Peau | `#F6DDBF` | — | peau humaine |
| Peau d'esprit | `#9CC3BB` | — | êtres surnaturels (Thủy Tinh…) |

Ces couleurs sont **réservées aux personnages** ; elles ne remplacent pas les tokens d'interface (`--color-primary`, tons pédagogiques…).

## 3. Règles de dessin

| Règle | Valeur |
|---|---|
| Contour | noir `#1F1A17`, **2,5 px** à l'échelle du héros (120×160), **3 px** pour les boss (200×200) ; bouts et angles **arrondis** |
| Remplissage | **aplats** uniquement : pas de dégradé, pas d'ombre portée, pas de flou, pas de reflet |
| Texture | **une seule** zone texturée par personnage (hachures fines à 45°, opacité ≈ 0,3, ou motif de vagues/nuages) — le nón lá du héros, le bas de robe du boss |
| Formes | rondes et simples : tête cercle, corps trapèze, mains en cercles, pas de doigts |
| Visage | yeux en **arcs mi-clos** (calme) ou **points** (surprise, colère) ; sourcils seulement pour une émotion ; petite bouche en arc ; **joues vermillon** (cercles r ≈ 3) comme sur les estampes |
| Proportions héros | tête ≈ 1/3 de la hauteur (sans chapeau), pieds à peine visibles |
| Proportions boss | **2 fois** la largeur du héros, silhouette massive, un **attribut lisible de loin** (couronne, arme, animal) |
| Ombre au sol | une ellipse noire à 12 % d'opacité, rien d'autre |

### Le médaillon « giấy điệp »
Un personnage est **toujours** posé sur un médaillon de papier crème nacré (`#F4E4C4`, bord or `--color-gold` 2–3 px) — rond pour les avatars, rectangle aux coins arrondis pour les scènes de boss. C'est la feuille d'estampe : elle garantit la lisibilité du contour noir **en thème sombre** et donne l'unité visuelle. Jamais de personnage posé directement sur le fond sombre.

### Tests de lisibilité (obligatoires)
1. **40 px** de haut (classement, en-tête) : on reconnaît la silhouette et le chapeau / la couronne.
2. **Thème sombre**, sur le médaillon.
3. **Niveaux de gris** : les zones restent distinctes (pas deux teintes de même valeur côte à côte).

## 4. Le héros et ses skins (calques)

Le héros est un **empilement de calques** SVG dans un `viewBox="0 0 120 160"`. Un skin remplace **un calque**, jamais le gabarit entier.

| Calque (`id`) | Rôle | Slot boutique | Exemples futurs |
|---|---|---|---|
| `layer-shadow` | ombre au sol | — | — |
| `layer-base` | corps, mains, tête, cheveux | `base` (coupe, teint) | cheveux longs, chignon |
| `layer-face` | yeux, bouche, joues | `face` (expression) | rieur, étonné, déterminé |
| `layer-outfit` | vêtement | `outfit` | áo bà ba (base), áo dài, tenue de pêcheur, tenue de Têt |
| `layer-hat` | couvre-chef | `hat` | nón lá (base), khăn đóng, couronne de fleurs, casque de soldat |
| `layer-accessory` | objet tenu | `accessory` | quạt (éventail), lồng đèn (lanterne), cerf-volant, bol de phở |

**Points d'ancrage** (identiques pour tous les skins) : tête centre `(60,70)` rayon 22 · épaules `y = 92` · ourlet `y = 146` · main gauche `(28,122)` · main droite `(92,122)`.

Le **slot** de chaque calque correspond au champ `slot` du catalogue de la boutique (voir [spec Progression V2 §5.2](superpowers/specs/2026-10-14-progression-boss-energy-design.md)) : les cadres d'avatar (`frame`) de novembre, puis `hat`, `outfit`, `accessory`… sans changer le modèle de données.

### Le héros sur le parcours
Sur l'accueil, le héros est un **pion** : son médaillon (46 px) avec une pointe or posée sur la case de la **dernière leçon réussie** (la plus avancée). Avant la première leçon, il attend **à côté du chemin**, à hauteur de la leçon 1, côté extérieur. Le pion est purement visuel (les touchers passent à la case dessous) et porte un `aria-label` (« Toi, après la leçon « Au café » »). Code : `features/home/HeroToken.tsx`, position calculée par `buildPathLayout` (`hero`).

## 5. Les boss

Gabarit : `viewBox="0 0 200 200"`, calques `layer-shadow`, `layer-aura` (l'élément autour de lui), `layer-body`, `layer-weapon` (attribut), `layer-head`. Chaque boss a :
- une **couleur signature** (la plus grande surface) ;
- un **motif d'élément** (la seule zone texturée) ;
- une **émotion** lisible : sourcils froncés au combat ; une version « vaincu » (yeux en spirale ou fermés, couronne de travers) pour l'écran de victoire.

### Galerie prévue
| Boss | Légende / histoire | Signature | Motif | Attribut |
|---|---|---|---|---|
| **Thủy Tinh** (novembre) | dieu des eaux, rival de Sơn Tinh | xanh chàm | vagues | trident, couronne |
| Sơn Tinh | génie des montagnes | lục (vert) | montagnes en strates | massue de pierre |
| Thánh Gióng | l'enfant devenu géant, cheval de fer | vàng hoè + noir | flammes | bambou arraché, cheval |
| Kim Quy | la tortue d'or du lac de l'Épée | vàng hoè | écailles hexagonales | l'épée sacrée |
| Hai Bà Trưng | les sœurs Trưng sur leurs éléphants | đỏ son | nuages | éléphant, étendard |
| Trần Hưng Đạo | général vainqueur des Mongols | xanh chàm + đỏ | pieux du fleuve Bạch Đằng | épée, armure |

Les figures historiques sont dessinées avec **respect** : ce sont des héros nationaux. Le « combat » est une épreuve qu'ils te font passer (un défi de maître), pas un ennemi à humilier ; leur version « vaincu » est un salut, pas une défaite humiliante.

## 6. Animation (rappel du design system §6)
Seulement `transform` et `opacity`, durées du catalogue `src/ui/motion.ts`.
- Boss touché : secousse horizontale courte + flash d'opacité.
- Erreur du joueur : le cœur se brise (échelle + fondu).
- Victoire : le boss s'incline (rotation légère) puis fondu ; confettis existants.
- `prefers-reduced-motion` : simples fondus.

## 7. Fichiers et intégration
- Dessins sources : `docs/art/*.svg` (références). En production : `src/assets/characters/` (un fichier par calque et par skin, ex. `hat/non-la.svg`), composés par un composant `Character` qui empile les calques dans l'ordre du §4.
- SVG à la main ou exportés proprement : pas de `filter`, pas de dégradé, pas d'image intégrée, ids préfixés par le calque, **< 6 Ko** par fichier.
- Texte et accessibilité : chaque personnage a un `aria-label` en français (« Thủy Tinh, le dieu des eaux »).
