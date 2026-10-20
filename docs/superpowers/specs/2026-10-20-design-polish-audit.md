# Audit design et animations de combat : Tiếng Nhà

> Statut : **validé** par Marc le 2026-10-20 (« Embellis juste l'App. Et travaille sur les animations de combat »), sans perte de perf. Captures citées : `.superpowers/sdd/design-audit/` (non versionné). Ordre et périmètre : [plan](../plans/2026-10-20-design-polish.md).

Date : 2026-10-20. Build : dev server avec fakes et mode démo (`VITE_USE_FAKES/VITE_DEMO/VITE_FAKE_SPEECH`), Chromium 360×780 @2x, thèmes clair et sombre.
Captures : `.superpowers/sdd/design-audit/shots/` (`NN-écran-{light,dark}.png`). Planches : `sheets/`. Séquences : `shots/seq2-boss-q*` (rafales sur un coup porté au boss), `shots/vid-duel/` (vidéo du replay à 12,5 i/s, 22 s), `shots/seq2-duel-replay*/` (rafales toutes les 80 ms, clair et sombre). Scripts : `capture*.spec.ts`, `pw.config.ts`.

---

## 0. Découvertes hors périmètre (à traiter avant le design)

1. **BUG probable, bloquant : l'écran de résultat du boss n'est jamais affiché.** Après le dernier coup, l'app passe par `/exam/result` puis revient aussitôt sur `/exam` (reproduit 3 fois, voir le log de `capture2`). L'état transmis est pourtant valide : tous les champs de `isResultState` sont présents. Cause probable : `FocusLayout` garde l'ancien écran pendant son animation de sortie (`AnimatePresence mode="wait"`). Or `ExamRunScreen` lit `useLocation()`, qui renvoie déjà la nouvelle location (state = ResultState) : `isRunState` devient faux et l'écran qui sort rend `<Navigate to="/exam">`. Le duel n'est pas touché, car il passe par `useParams`. Pour capturer `14b-boss-victory`, j'ai injecté l'état via `popstate` depuis l'intro. Pistes de correction : figer la location dans l'écran qui sort (`useLocation` capturé à l'entrée dans un `useState`/`useRef`), ou ne rediriger que si l'on est encore sur `/exam/run`. Ajouter un test e2e « boss perdu → écran résultat ».
2. **Le replay du duel dure environ 17 s** (8 + 3 questions par joueur, un rythme fixe d'environ 0,6 s par coup, des bannières de 1,16 s). Le verdict arrive **sous la ligne de flottaison** : la scène fait 23rem, le titre est à y ≈ 470 px et les chiffres sont hors écran (`25-duel-bilan-light.png`).
3. Les titres qui reçoivent le focus par programme affichent le gros cadre or `:focus-visible` (`01-welcome-light.png`, `25c-duel-reduced-light.png`). La règle globale de `src/styles/index.css` l'emporte sur `outline-none`. Sur un écran tactile, c'est sans doute invisible, mais c'est très visible au clavier.
4. La typographie française n'est pas tenue : la ponctuation haute passe seule à la ligne (« vietnamien⏎? » sur l'accueil, « 1 » orphelin dans les règles du boss). Il faut une espace fine insécable (` `) avant `? ! : ;` dans `fr.ts`.

---

## A. Signes qui font « généré par IA »

| # | Signe | Écran / capture | Pourquoi ça fait générique |
|---|---|---|---|
| A1 | **Grilles 2 colonnes de cartes identiques** (cercle crème, nom, prix), y compris pour les « Légendes sombres » | Boutique `19-shop-*`, Arène `22-arena-*`, Penderie `27-wardrobe-*` | C'est le gabarit e-commerce par défaut. Les objets dark fantasy (pour Mathias) reçoivent exactement le même traitement qu'un bandeau à 6 Kim bài : aucune rareté, aucune mise en scène. Une seule carte dans une grille à 2 colonnes (penderie) laisse un trou. |
| A2 | **Emoji utilisés comme avatars et illustrations**, mélangés aux personnages Đông Hồ | Classement `15-leaderboard-*` (🐉 🐢 🛵), duels `21b-duels-hub-*`, en-tête (🐉), leçons du parcours (🎵 🙏 🔢), badges | Deux langages visuels cohabitent : de beaux personnages imprimés sur papier điệp d'un côté, des emoji système de l'autre. Bà Ngoại est une tortue 🐢 sur le podium et un héros sur son profil (`16-public-profile`). |
| A3 | **Parcours monotone** : une colonne de pastilles jade identiques avec une coche, des pointillés gris, un texte tronqué au milieu d'un mot (« cent … ») et collé au bord droit | `10-home-progress-light.png`, `03-home-*` | Ça se lit comme une liste, pas comme un chemin. On ne voit ni chapitre, ni repère, ni progression de récompense. La colonne de texte sans marge droite donne une impression d'inachevé. |
| A4 | **Grille de badges verrouillés** : 3 colonnes de cercles gris délavés avec un emoji en niveaux de gris | `18-me-after-demo-light.png`, `16-public-profile-light.png` | Le motif typique « achievements » d'un template. Les 9 badges verrouillés pèsent plus lourd visuellement que les 4 gagnés. |
| A5 | **Écrans vides et d'échec en « placeholder »** : une petite icône en haut à gauche, un titre, puis 60 % d'écran vide | `07-lesson-failed-light.png` (« Plus de vies ! »), `08-review-light.png`, `24-duel-round2-intro-*` (bouton non pleine largeur, rien sous la ligne de flottaison) | La composition par défaut d'un composant EmptyState. Rien ne raconte la scène : le héros n'apparaît pas, aucune phrase en vietnamien. |
| A6 | **Le combat contre le boss est un quiz avec un en-tête** : portrait de 88 px, barre de progression générique rouge pleine largeur, retour uniquement par une légende (« Touché ! Il lui reste 14 PV ») | `12-boss-fight-start-*`, `13-boss-fight-mid-*`, `sheets/boss-hit.png` | La même `ProgressBar` sert à la leçon, au chrono du duel et aux PV du boss. Rien ne dit « combat » : pas de héros à l'écran, pas de PV par segments, et le coup se résume à une secousse de 8 px. |
| A7 | **Intro du boss rédigée comme une doc** : paragraphe de légende centré, liste à puces rouges « Comment ça se passe » | `11-boss-intro-*` | Les puces et le texte centré sur 5 lignes trahissent le texte de remplissage. Les règles (15 PV, 5 vies) devraient se voir (gouttes, cœurs) au lieu d'être écrites. |
| A8 | **Les « victoires » tiennent du collage** : titre, mention, cœurs, XP, xu, 3 badges, certificat, 4 boutons, tout centré et empilé | `14b-boss-victory-*`, `14-boss-result-*` | Aucun moment clé : tout a le même poids. Le boss « vaincu » est la tuile entière inclinée à −8°, avec toujours son visage en colère (un autocollant de travers, pas une révérence). |
| A9 | **Thème sombre = « dark mode » générique** : noir plat, médaillons crème qui éblouissent, podium presque invisible | `15-leaderboard-dark`, `19-shop-dark`, `25-duel-bilan-dark` | La laque noire du sơn mài a de la profondeur (paillettes d'or, chaleur). Ici, c'est un `#15110F` uni, sans texture ni filet or. |
| A10 | **Typographie timide et rythme uniforme** : chaque section est « h2 heading 20 px + cartes `p-5` + `gap-3` », sans surtitre, sans filet ni motif de section | Moi `17-me`, Boutique `19-shop`, Duels `21b` | Les espacements par défaut de Tailwind se répètent identiques d'écran en écran. Aucun élément typographique de marque : sceau, trait de pinceau, surtitre espacé. |
| A11 | **Doublons d'étiquettes** : « Équipé » plus un bouton « Équiper » désactivé ; « Défier » grisé plus « Duel déjà en cours » | `27-wardrobe-light`, `21b-duels-hub-light` | Ça sent l'état généré automatiquement et non relu. |
| A12 | **Le chiffre vedette est mal calé** : « 20 Kim bài » en display passe sur 2 lignes, et « 645 xu » occupe une carte entière | `22-arena-*`, `19-shop-*` | C'est la tuile de stats d'un tableau de bord (un anti-pattern listé dans le skill), sans contexte. |

Ce qui est déjà réussi et doit servir de référence : les personnages et le boss en Đông Hồ sur papier điệp, le certificat (`14b-boss-victory`), la feuille de feedback, le bouton laqué, les cœurs, le profil public grand format (`16-public-profile`), le motif de nuages et de vagues.

---

## B. Embellissements (classés impact ÷ effort)

Règle commune : uniquement des tokens existants (couleurs, `--fx-*`, rayons, ombres, tailles de texte). Les motifs sont des SVG inline à opacité ≤ 0,08. Ne s'animent que `transform` et `opacity`.

| Rang | Embellissement | Concret | Fichiers | Coût perf |
|---|---|---|---|---|
| **1** | **Texture papier dó / laque noire** | `--texture` dans `tokens.css` : un `url("data:image/svg+xml,…")` de 96×96 avec ~40 petits traits (fibres) en `--color-ink` à 5 %. En sombre, ~25 points or (`--color-gold`) à 6 % (dát vàng). Appliqué une fois sur `body` (`background-image`, `background-attachment: scroll`). Ajouter aussi un vignettage radial chaud et statique en sombre. **Pas de `feTurbulence`.** | `src/styles/tokens.css`, `src/styles/index.css` | ≈ 0 : image de fond statique < 2 Ko, une seule peinture, rien d'animé. |
| **2** | **Avatars unifiés : fini les emoji pour les personnes** | Partout où `Avatar` reçoit un `emoji` de membre (classement, podium, duels, en-tête), passer `look`. Donner un look distinct à chaque membre factice (bandeau, nón lá, talismans…) pour que les deux duellistes ne soient plus identiques. Les emoji restent pour les badges et les leçons, conformément au design system. | `src/features/leaderboard/*`, `src/features/duels/DuelsScreen.tsx`, `TabLayout` (en-tête), `src/adapters/fakes/*` (looks) | 2 `<img>` SVG par avatar au lieu d'un glyphe : négligeable (déjà en cache). Garder `sm`/`md` en tête seule. |
| **3** | **Titres de section avec signature** : surtitre plus trait de pinceau | Petit composant `SectionTitle` : surtitre en `text-caption` majuscules, interlettrage 0,08em, couleur `gold-ink` (« BOUTIQUE · PERSONNAGES »), puis `text-heading`, puis un trait de pinceau SVG de 48×6 (2 chemins, `--color-primary`, opacité 0,6). Remplace les `h2` nus de Moi, Boutique, Arène, Duels et Classement. | `src/ui/SectionTitle.tsx` (nouveau, réutilisé partout), écrans concernés | Statique. |
| **4** | **Corriger le parcours** | (a) Marge droite `pr-5` et un seul sous-titre court (`line-clamp-1`, tagline dédiée dans le contenu). (b) Remplacer les pointillés par un trait de pinceau en tirets à 25 % d'encre. (c) Leçons réussies : pastille jade avec 1 à 3 étoiles or (selon `perfect`) au lieu d'une coche uniforme. (d) Un **jalon lanterne de Hội An** (SVG de 32 px) tous les 3 nœuds, avec le nom du chapitre. (e) Arrêt courant à 1,15× avec un anneau `pulse` (déjà dans les tokens), une seule fois. | `src/features/home/PathStop.tsx`, `pathLayout.ts`, `HomeScreen.tsx`, `src/content/tree.json` (taglines) | Anneau : 1 élément `scale`/`opacity` en boucle, uniquement sur l'arrêt courant. |
| **5** | **« Légendes sombres » en vitrine** | La première carte en pleine largeur (« vedette »), les autres en grille. Les objets rares sur une **surface laque noire forcée** (`data-theme="dark"` local, symétrique du `data-theme="light"` existant), avec filet or intérieur (le cadre sơn mài existe) et un **sceau vermillon** « Hiếm » (carré de 18 px tourné de 4°, `--fx-vermilion`). Même traitement dans l'Arène. | `ShopScreen.tsx`, `ArenaScreen.tsx`, `tokens.css` (bloc `[data-theme="dark"]`) | Statique. Les ProfileFx des aperçus en `still` hors focus, et animés seulement quand l'essai est ouvert (`TryOnSheet`). |
| **6** | **Écran de victoire avec un vrai moment clé** | Séquence : boss qui s'incline (voir C), puis titre, puis **un seul** compteur (XP), puis le certificat. Badges et xu regroupés en une ligne « Butin » repliée. Rotation du personnage **depuis les pieds** (`transform-origin: 50% 100%`) et non de la tuile. Visage « vaincu » : un 2e SVG du boss (`boss-thuy-tinh-defeated.svg`, yeux fermés, couronne de travers). | `ExamResultScreen.tsx`, `BossPortrait.tsx`, `bossArt.ts`, `src/assets/characters/` | 1 image en plus (< 6 Ko). Séquence non bloquante (« Continuer » toujours actif). |
| **7** | **Écrans vides et d'échec mis en scène** | `EmptyState` avec une variante `scene` : le héros (`Character`) en grand au centre vertical, une phrase en vietnamien (« Cố lên ! », « Mai gặp lại nhé ! »), un motif de nuages en fond. Lot : leçon échouée, révision vide, Manche 2 (bouton pleine largeur), boss en attente. | `src/ui/EmptyState.tsx`, `fr.ts`, écrans appelants | Statique. |
| **8** | **Badges : incrustations plutôt que grille grise** | Badges gagnés d'abord (médaillon or et ruban). Les verrouillés deviennent une **silhouette en pointillés or à 30 %** (incrustation vide dans la laque), puis une ligne « +9 à découvrir » repliable. | `MeScreen.tsx`, `PublicProfileScreen.tsx`, `BadgeMedal.tsx` | Moins de DOM qu'aujourd'hui. |
| **9** | **Intro du boss : des règles montrées** | Légende alignée à gauche dans un cartouche « cuộn giấy » (rouleau : 2 enroulements SVG aux extrémités). Règles en 3 tuiles visuelles : 15 gouttes (PV segmentés, voir C), 5 cœurs, un pinceau barré pour « pas de correction ». Supprimer les puces. | `ExamIntroScreen.tsx` | Statique. |
| **10** | **Micro-interactions de marque** | (a) **Reflet laqué** : une seule fois, quand le bouton primaire devient actif, une bande `--color-on-primary` à 15 % le traverse (`translateX` −120 % → 120 %, `duration.slow`). (b) Le chiffre xu/Kim bài « tombe » (`y: -6 → 0`, `spring.snappy`) quand il change. (c) Typographie française (` `). (d) Ne plus noircir le bouton « Vérifier » désactivé en rose délavé : utiliser `surface-2` + `ink-muted`, réservant le rouge à l'action possible. | `src/ui/Button.tsx`, `XpCounter.tsx`, `fr.ts` | (a) 1 élément `transform`, dans un `overflow-hidden` déjà présent. |

Ordre conseillé (deadline courte) : 1 → 2 → 4 → 6 → 3 → 5. Les 7 à 10 si le temps le permet.

---

## C. Animations de combat

### C.0 Ce qui se passe aujourd'hui (mesuré sur les captures)

- **Boss** (`sheets/boss-hit.png`) : un coup réussi produit `x: [0,-8,8,-5,5,0]` et `opacity → 0,6`, en 220 ms, sur une tuile de 88 px. Un coup raté fait éclater un cœur. Le texte « Touché ! » fait l'essentiel du travail. Pas de héros, pas d'impact, des PV en barre continue.
- **Duel** (`sheets/vduel-crit.png`, `vduel-hit-finale.png`, `vduel-overview.png`) :
  - c'est **le médaillon entier** (disque papier compris) qui vole vers l'adversaire, comme un autocollant ;
  - le défenseur **clignote en opacité** (0,25 ↔ 1), ce qui fait « fantôme » plutôt que « choc » ;
  - visages toujours souriants ;
  - le critique est l'icône générique `bolt` en or semi-transparent posée sur le défenseur ;
  - la balafre est dessinée d'emblée, puis s'efface ;
  - temps morts de 0,5 à 0,8 s entre les coups ; les ratés à la chaîne (manche 2) se ressemblent tous ;
  - la finale est un coup sans dégâts, puis le perdant s'incline à 75 % d'opacité ; le gagnant ne fait rien.

### C.1 Primitive partagée : `src/ui/fight/`

| Élément | Rôle | Réutilisé par |
|---|---|---|
| `fightTiming.ts` | Constantes de beat **composées des tokens** de `motion.ts` (voir ci-dessous) | boss, duel |
| `FighterSprite` | `Character` (ou image de boss) **sans médaillon mobile**. Le médaillon papier reste au sol comme « tapis » ; seul le personnage bouge. Props `facing: 1 \| -1` (`scaleX`), `expression: "idle" \| "hurt" \| "ko"` (remplace le calque `face`, ou l'image du boss) | boss, duel, résultat |
| `InkImpact` | Un seul `<svg>` de 96×96 : balafre (2 chemins), 6 gouttes (cercles), optionnellement un sceau. `kind: "hit" \| "crit" \| "miss"`. Monté pour le beat, démonté ensuite | boss, duel |
| `DamageNumber` | Chiffre `tabular`, `text-heading` (`text-title` si critique), contour `-webkit-text-stroke: 3px var(--color-paper)` + `paint-order` (statique), couleur `--fx-vermilion` ou `gold-ink` | boss, duel |
| `useFightBeat()` | Reçoit les `AnimationControls` (attaquant, défenseur, scène) et joue `anticipation → frappe → arrêt sur image → recul → retour` à partir des `times` d'une keyframe. **L'arrêt sur image est une valeur tenue dans les keyframes, pas une pause de timer** | boss, duel |
| `KoBow` | Révérence (rotation depuis les pieds) ; le **nón lá / la couronne tombe** grâce au calque `hat` séparé (`y` + `rotate` + `opacity`) | duel (perdant), boss (vaincu) |

**Tokens proposés** (à ajouter au catalogue §6.2 du design system, comme l'exige ADR 0010). Aucune nouvelle valeur brute :

```ts
// src/ui/fight/fightTiming.ts
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
// Ressorts : recul = spring.snappy ; KO / révérence = spring.soft ; chiffre de dégâts = spring.bouncy.
```

### C.2 Chorégraphie beat par beat (duel ; le boss reprend les mêmes beats en mode compact)

| Beat | Timing | Attaquant | Défenseur / scène | FX |
|---|---|---|---|---|
| **Anticipation** | 0 → 150 ms (`anticipation`, `ease.inOut`) | Recul de 10 px, `scaleX 1.04 / scaleY 0.94` (accroupi), `rotate -4°×dir` | — | — |
| **Frappe** | 150 → 230 ms (`strike`, `ease.in`) | Ruée jusqu'au contact (30 % du trajet, 50 % si critique), `scaleY 1.06` | — | — |
| **Impact + arrêt sur image** | 230 → 310 ms (`hitStop` ; 390 ms si critique) | **Figé** (keyframe tenue) | Visage `hurt` (changement de calque instantané) ; une **plaque papier** posée sur le sprite clignote `0 → 0,7 → 0` (au lieu de faire clignoter le personnage) | `InkImpact` estampillé : `scale 0.6 → 1.1`, `opacity 0 → 1` en 80 ms ; balafre en `pathLength 0 → 1` sur 80 ms (même exception que la coche du catalogue, 2 chemins max) ; 6 gouttes projetées en éventail (`x/y` 12 à 28 px, `scale 1 → 0.4`). La **scène** tremble une fois : ±4 px (critique ±8 px, 2 cycles) pendant `hitStop` |
| **Recul** | 310 → 530 ms (`recoil`, `spring.snappy`) | Retour (`settle`, `ease.out`) | Projeté de 14 px (critique 28 px) dans la direction du coup, `rotate 8°×dir` (critique 14°), puis ressort en place | `DamageNumber` : `scale 1.4 → 1` (`spring.bouncy`), puis montée de 24 px et fondu sur `number`. La plaque HP descend **au moment de l'impact** (déjà le cas avec `landed`) |
| **Critique (en plus)** | élan 360 ms (`slow`) | Éclat or sur l'arme ou la main : étoile à 4 branches de 2 traits (`scale 0 → 1 → 0`, 150 ms) | `critHitStop` 160 ms | **Sceau vermillon « Chí mạng! »** (carré `--fx-vermilion`, texte `--color-paper`, `rotate -6°`, `scale 1.6 → 1` en 80 ms, `spring.bouncy`) à la place de l'icône `bolt` ; 10 gouttes or et encre au lieu de 6 |
| **Raté** | 360 ms au total | Élan normal, balafre **dans le vide** à côté du défenseur, puis trébuche (garder l'existant, il marche bien) | Pas de côté : `x ±12 px` aller-retour (`spring.snappy`), visage `idle` | « Raté » écrit au pinceau (texte `ink-muted` + petit trait), sans pastille. Pas de tremblement. **Ratés consécutifs du même joueur** : regroupés (« Raté ×3 », un seul beat de 360 ms) |
| **KO** (PV → 0, sur ce coup-là) | `koHitStop` 240 ms, puis `celebrate` | — | La scène se voile (scrim `opacity 0 → 0,35`, 220 ms). Le perdant : `KoBow` (`rotate 18°` depuis les pieds, `y +10`, `spring.soft`), le **chapeau tombe** (`y +40`, `rotate 60°`, fondu). **Pas** d'opacité 0,75 sur le personnage | Gros sceau « K.-O. » ; ensuite le gagnant fait 2 petits bonds (`y -10`, `spring.bouncy`) et le titre du verdict monte dans le champ |
| **Salut (nul / boss vaincu)** | `celebrate` | — | Les deux personnages (ou le boss) s'inclinent depuis les pieds ; visage `ko` → yeux fermés « salut » (direction artistique : « un salut, pas une défaite humiliante ») | Confettis existants (une fois) |

**Rythme du replay** : un beat de coup ≈ 530 ms + 150 ms de respiration. Le beat suivant **démarre pendant le `settle`** du précédent (chevauchement de 150 ms). Bannières de manche : `celebrate` (0,8 s) au lieu de `celebrate + slow`. Objectif : **≤ 9 s** pour un duel complet, contre 17 s aujourd'hui. Après le KO, les coups restants défilent en accéléré (×2) ou se résument en une ligne. Le verdict doit être visible sans défiler : réduire la scène à `h-[19rem]` et faire remonter le titre dans la scène pendant la finale.

**Combat contre le boss** (contrainte : < 400 ms sur le chemin d'interaction, l'exercice suivant ne doit jamais attendre) :

- **Bande de scène** de 112 px en haut : à gauche le héros du joueur (`FighterSprite`, 64 px, regardant à droite), à droite le boss (96 px). Les PV deviennent **15 gouttes d'eau segmentées** (motif vagues, signature de Thủy Tinh), à la place de la `ProgressBar`.
- **Bonne réponse** : anticipation 80 ms, ruée et frappe 80 ms, arrêt sur image 80 ms, `InkImpact` sur le boss, recul du boss 220 ms (soit 460 ms, dont seuls 150 ms avant que l'exercice suivant commence son entrée ; les deux tournent en parallèle). La goutte perdue **se détache** (`y +18`, `rotate 30°`, fondu, 360 ms).
- **Mauvaise réponse** : le boss lance une vague (le chemin `Motif waves`, 1 élément `translateX` du boss vers le héros, 220 ms) ; le héros recule de 8 px ; le cœur éclate (existant).
- **Dernier coup (PV 0)** : remplacer le `setTimeout(duration.slow)` par la séquence KO compacte (`koHitStop` + révérence + couronne qui tombe ≈ 800 ms, interruptible au toucher), puis navigation. **Après correction du bug §0.1.**
- **Dernière vie perdue** : le boss lève son trident (`rotate -10°`, `spring.bouncy`), la scène se voile, puis navigation.

### C.3 Budgets

| Poste | Budget |
|---|---|
| Éléments animés en même temps (par beat) | ≤ 8 (2 sprites, scène, 1 SVG d'impact, ≤ 1 chiffre, ≤ 1 sceau, plaque HP, plaque papier) |
| Particules (gouttes) | coup 6, critique 10, KO 12 : **à l'intérieur d'un seul `<svg>`**, chaque goutte en `<motion.circle>` animée en `transform`/`opacity` |
| Nœuds DOM de la couche FX | ≤ 30, démontés à la fin du beat (`key` = index du beat, comme `Effects` aujourd'hui) |
| Boucles infinies sur la scène | 0 pendant les beats : les `ProfileFx` des combattants passent en `still` pendant le replay et ne se réaniment qu'au verdict. « Respiration » au repos facultative : 1 élément par personnage, `scaleY 1 → 1.015`, `duration.loop × 2` |
| `will-change: transform` | Seulement sur les sprites et la scène, posé au début du replay et retiré au verdict |
| Taille des SVG | `InkImpact` < 2 Ko inline ; visages `hurt`/`ko` < 6 Ko chacun (règle de la direction artistique) |

### C.4 Mouvement réduit (`prefers-reduced-motion`)

- **Duel** : on garde le saut direct au verdict (aujourd'hui `beat = beats.length`) et on ajoute, en option, un bouton « Voir les coups » qui affiche la liste textuelle des coups (déjà annoncée via `aria-live`). Poses finales : visage `ko` statique et chapeau posé à côté, sans rotation.
- **Boss** : pas de ruée, de tremblement, de goutte ni de projection. Coup réussi : fondu enchaîné du visage `hurt` (120 ms) et goutte de PV qui s'estompe. Coup raté : le cœur s'estompe. Chiffres de dégâts en fondu seul. KO : fondu vers le visage « vaincu ».
- Tester avec `duelResult.reduced.test.tsx` et `ProfileFx.reduced.test.tsx`, plus un nouveau `fightFx.reduced.test.tsx` vérifiant qu'aucune propriété `x`/`y`/`rotate`/`scale` n'est animée.

---

## D. Garde-fous de perf à exiger en revue

1. **Seuls `transform` et `opacity` s'animent.** Exceptions déjà cataloguées seulement : `pathLength` sur ≤ 2 chemins et ≤ 300 ms ; couleurs du thème (200 ms). **Jamais** d'animation de `filter`, `backdrop-filter`, `box-shadow`, `clip-path`, `width`/`height`/`top`/`left`, ni de `background-position`.
2. **Pas de flou.** Aucun `blur()`, aucun `feGaussianBlur` / `feTurbulence` dans les SVG d'interface. Les textures sont des motifs vectoriels statiques ou des data-URI ≤ 2 Ko. `grayscale` n'est toléré que statique (absent ou verrouillé).
3. **Pas de mise en page à chaque image** : rien de `layout`/`layoutId` dans la scène de combat, pas de mesure DOM (`getBoundingClientRect`) pendant un beat. Les positions viennent de constantes (comme `PATH`/`SPOT`).
4. **Budgets DOM** : ≤ 8 éléments animés en même temps, ≤ 12 particules dans un seul `<svg>`, ≤ 30 nœuds FX, tous démontés après le beat ; confettis ≤ 30 (existant : 24).
5. **Aucune boucle infinie hors de l'écran** : `ProfileFx` et les anneaux `pulse` en `still` quand ils sont masqués ou pendant un beat de combat ; au plus 1 boucle par écran en dehors des aperçus d'objets.
6. **Durées issues de `motion.ts`** (ou `FIGHT`, composé des tokens) ; aucune valeur brute en millisecondes dans les composants (grep `duration: 0.` et `\d+ms`).
7. **Chemin d'interaction ≤ 400 ms** : l'exercice suivant, « Continuer » et « Passer » restent toujours actifs. Les célébrations sont interruptibles.
8. **`prefers-reduced-motion`** : un test unitaire par écran de combat, avec en plus une capture e2e en `reducedMotion: "reduce"`.
9. **Mesure** : avant de fusionner une modification de combat, tracer avec Chrome DevTools en throttling CPU 4× sur le replay complet. Objectif : aucune frame longue > 32 ms et aucun événement « Layout » pendant les beats. Joindre la capture de la trace à la PR.
10. **Le chemin heureux couvert en e2e** : ajouter « boss perdu → écran résultat visible » et « replay de duel → verdict visible sans défiler » (les deux sont cassés aujourd'hui, voir §0).
