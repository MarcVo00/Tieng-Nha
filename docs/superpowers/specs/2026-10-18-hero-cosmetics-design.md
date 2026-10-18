# Héros, cosmétiques et récompenses de succès — conception

> Statut : **validé** par Marc le 2026-10-18. Plan du lot 1 : [`plans/2026-10-18-achievement-rewards.md`](../plans/2026-10-18-achievement-rewards.md).
> Complète la [spec Progression V2](2026-10-14-progression-boss-energy-design.md) (§5 coins, §6 boutique) et la [direction artistique](../../art-direction.md).
> Échéance : l'anniversaire de Mathias, le **2026-10-29**. Tout ce qui n'est pas prêt et testé sur téléphone le 2026-10-27 passe après.

## 1. Intention

Le héros du parcours est **l'incarnation du joueur**. Mathias doit avoir envie de le faire évoluer et de le montrer. Il aime le **dark fantasy** et le **shonen**.

Les décisions de Marc :
- On garde le style de base du héros (estampe **Đông Hồ simplifiée**). On l'habille de **cosmétiques regroupés par thème**, plus sombres ou plus « shonen ».
- Le premier thème est **les légendes vietnamiennes en version sombre**.
- Les **personnages** s'achètent avec les xu, et les cosmétiques se posent par-dessus.
- Les **cadres** et les **animations du profil** ne s'achètent pas : ce sont les **seules** récompenses de succès, débloquées en faisant les cours.
- Les succès sont des moments marquants : finir le tronc de l'arbre, battre le boss, tenir une série de 7 puis de 30 jours, enchaîner des leçons parfaites. Les récompenses les plus impressionnantes, comme les animations, vont aux exploits les plus durs.
- Plus tard : des **duels** entre joueurs sur les leçons qu'ils ont en commun (§8, non construit ici).

**Ce qu'on veut :**
- Un héros qui a l'air « à lui ».
- Des objets qui font envie et qu'on peut voir avant de les acheter.
- Des succès qui se voient sur le profil.

**Ce qu'on ne veut pas :**
- Casser le style estampe : pas de 3D, pas de dégradés, pas de chibi brillant.
- Faire perdre des xu à quelqu'un.
- Mettre en avant des achats au détriment de l'apprentissage. Les xu ne viennent que des cours.

**Hors périmètre ici :**
- Les duels.
- Les branches de l'arbre : il n'y a que le tronc aujourd'hui, donc pas de succès « branche terminée » tant qu'elles n'existent pas.
- Les expressions de visage (`face`).
- Les nouveaux boss.

## 2. Livraison en trois lots, dans cet ordre

Chaque lot est livrable seul : il est fusionné et déployé, et l'appli reste cohérente s'il est le dernier à sortir avant le 29.

| Lot | Contenu | Visé |
|---|---|---|
| **1. Succès → cadres et animations** | Les cadres sortent de la boutique et deviennent des récompenses de badges. Trois animations de profil. Section « Cadres et animations » dans « Moi ». Migration SQL. | 2026-10-21 |
| **2. Cosmétiques « Légendes sombres »** | Composant `Character` en calques. Quatre emplacements. Quatre objets. Boutique par thème avec essayage. Héros visible sur le parcours, sur « Moi » et sur le profil public. | 2026-10-24 |
| **3. Personnages** | Deux personnages à acheter. Les cosmétiques s'y posent. | 2026-10-26 |

Le lot 1 passe en premier : c'est le moins risqué, et il corrige la boutique déjà en ligne, où les cadres sont encore en vente.

## 3. Modèle commun : un catalogue d'objets

Aujourd'hui, `src/content/shop.json` et la fonction SQL `shop_item()` ne connaissent que les objets **achetables**. Les deux deviennent un **catalogue d'objets** qui contient aussi les récompenses.

### 3.1 Objet du catalogue (`src/content/shop.json`, schéma `ShopItemSchema`)

| Champ | Type | Règle |
|---|---|---|
| `id` | string | Immuable, `[a-z0-9_]+`. |
| `kind` | `consumable` · `cosmetic` | Inchangé. |
| `slot` | `null` · un emplacement (§3.2) | `null` pour les consommables. |
| `price` | int ≥ 1 · **`null`** | **`null` = non achetable** : récompense de badge, jamais en boutique. |
| `maxStock` | int ≥ 1, optionnel | Inchangé (gel de série). |
| `theme` | string, optionnel | Thème de boutique (`legendes_sombres`…). Seulement pour les cosmétiques achetables. |

Le nom et la description des objets restent dans `src/i18n/fr.ts`, sous `fr.shop.items[id]`, comme aujourd'hui.

### 3.2 Emplacements (`ItemSlot`)

| Slot | Contenu | Source | Lot |
|---|---|---|---|
| `frame` | Cadre de l'avatar | Badge | 1 |
| `profile_fx` | Animation autour de l'avatar du profil | Badge | 1 |
| `hat` | Couvre-chef | Boutique | 2 |
| `outfit` | Vêtement | Boutique | 2 |
| `accessory` | Objet tenu en main | Boutique | 2 |
| `aura` | Élément derrière le héros (nouveau calque `layer-aura`) | Boutique | 2 |
| `character` | Personnage de base | Boutique | 3 |

Un emplacement vide veut dire « rien » pour `frame`, `profile_fx` et `aura`, et « tenue par défaut du personnage » pour `hat`, `outfit` et `accessory`. Un `character` vide est le héros actuel (au nón lá).

### 3.3 Récompenses de badges (`src/content/badges.json`)

Le schéma `BadgeDefSchema` reçoit un champ optionnel **`reward: string`**, l'id d'un objet du catalogue dont `price` vaut `null`.

| Badge | Existe ? | Récompense | Pourquoi |
|---|---|---|---|
| `streak_7` « Une semaine » | oui | `frame_bronze` | Premier effort tenu. |
| `ten_lessons` « Toutes les leçons » | oui | `frame_jade` | Tronc de l'arbre terminé. |
| `exam_passed` (boss vaincu, score ≥ 70) | oui | `frame_son_mai` | Le boss. |
| `perfect_5` « Main de maître » | **nouveau** : 5 leçons différentes réussies sans faute | `fx_ink` (encre qui tourbillonne) | Leçons parfaites enchaînées. |
| `exam_excellent` (boss avec au moins 4 vies, c.-à-d. score ≥ 90) | oui | `fx_lightning` (éclairs) | Exploit rare. |
| `streak_30` « Inarrêtable » | oui | `fx_embers` (braises qui montent) | Le plus dur. |

Le nouveau badge s'appuie sur une nouvelle règle `{ "kind": "perfect_lessons", "gte": 5 }`. Elle compte les ids de leçons **distincts** terminés avec `perfect: true`, comme le fait déjà `progress.ts`. Comme tous les badges, il est évalué par l'appli à la prochaine activité : un joueur qui remplit déjà la condition le reçoit à ce moment (rétroactif voulu, aucun rattrapage serveur).

### 3.4 Règles (identiques dans l'appli et sur le serveur)

- **Achat** `item_purchased { itemId }`. Il est refusé, sans aucun effet, si :
  - l'objet est inconnu, ou son prix vaut `null` ;
  - le solde est inférieur au prix ;
  - c'est un cosmétique déjà possédé ;
  - c'est un gel de série alors que la réserve est pleine.

  Sinon, les règles actuelles s'appliquent.
- **Badge** `badge_unlocked`, **la première fois** pour cet id : il donne toujours +10 xu, et ajoute en plus l'objet `reward` à l'inventaire s'il ne s'y trouve pas déjà.
- **Équiper** `item_equipped { slot, itemId | null }`. C'est accepté si `itemId` vaut `null`, ou si l'objet est possédé **et** que son slot est le même. Sinon, l'événement n'a aucun effet. Valable pour tous les slots du §3.2.
- **Anciens achats de cadres :** en rejouant le journal avec le nouveau catalogue, un ancien `item_purchased` d'un cadre est **refusé**, parce que son prix vaut maintenant `null`. Il ne coûte donc rien et ne donne rien. Le joueur **récupère ses xu**, et le cadre revient quand il gagne le badge correspondant. La migration fait exactement la même chose côté serveur (§3.5).
- **Rejeu (appli) — règles exactes, appel du concepteur :** le journal est rejoué dans l'ordre chronologique ; l'inventaire est un ensemble (jamais de doublon) ; une récompense déjà possédée n'est pas ajoutée deux fois ; un achat refusé n'a **aucun** effet ; un `item_equipped` n'est accepté que si l'objet est possédé **au moment** de l'événement. Les règles de récompenses sont lues dans `badges.json` par `wallet.ts` (l'appli passe les badges à `walletAt` comme elle passe déjà le catalogue).
- **Cas de référence** (test unitaire et pgTAP, mêmes attendus) : un joueur a acheté `frame_bronze` (40), l'a équipé, puis a obtenu `streak_7` → solde remboursé de 40, `frame_bronze` possédé (récompense), **non équipé** (l'équipement a eu lieu avant d'en être propriétaire). Variante : `streak_7` obtenu **avant** l'achat → achat refusé au rejeu, équipement accepté (possédé par récompense) → cadre possédé **et** équipé. Variante sans badge : +40 xu, pas de cadre, rien d'équipé.
- Un trigger ne lève **jamais** d'erreur pour une règle métier ni sur un payload mal formé. C'est inchangé.

### 3.5 Serveur (nouvelle migration, lot 1)

- `public.shop_item(p_id)` devient le catalogue complet. Elle renvoie `price` (nullable), `kind` et `slot`, avec toutes les lignes de `shop.json`.
- Nouvelle fonction `public.badge_reward(p_badge text) returns text`, avec les lignes du §3.3.
- Les deux fonctions gardent `search_path = ''` et l'exécution révoquée pour `public`, `anon` et `authenticated`, comme les fonctions existantes.
- `apply_event` :
  - refuse l'achat si le prix vaut `null` ;
  - ajoute la récompense au premier `badge_unlocked` ;
  - accepte l'équipement dans tous les slots du §3.2, via `shop_item`.
- **Rattrapage**, en une seule passe sur `user_stats` :
  1. coins += somme des **anciens** prix (bronze 40, jade 80, sơn mài 150) des cadres présents dans l'inventaire ;
  2. retirer ces cadres de l'inventaire ;
  3. ajouter les récompenses des badges déjà obtenus ;
  4. recalculer `equipped.frame` comme le rejeu de l'appli : le dernier `item_equipped` du slot `frame` (ordre `client_created_at`) dont l'objet est `null` ou un cadre de récompense dont le `badge_unlocked` est **antérieur** à cet équipement ; sinon vide.

  C'est le miroir exact du rejeu de l'appli (§3.4), cas de référence compris.
- La vue `leaderboard` ajoute **à la fin** une colonne `equipped jsonb` (tout l'équipement). `equipped_frame` est conservée.
- `set lock_timeout = '10s';` en tête du fichier, comme la migration précédente.
- Tests pgTAP :
  - achat d'un objet sans prix ;
  - récompense au premier badge, et pas au second ;
  - rattrapage avec et sans badge ;
  - équipement d'un objet de récompense ;
  - mauvais slot ;
  - la vue expose `equipped`.
- Tests Vitest de **parité** : les lignes SQL de `shop_item` et de `badge_reward` égalent `shop.json` et `badges.json`. On étend `src/content/shopParity.test.ts`.
- Le lot 2 et le lot 3 ajoutent seulement des lignes au catalogue : **chaque lot a sa propre migration** qui recrée `shop_item` avec le catalogue complet de ce lot (donc au plus trois migrations : lots 1, 2, 3). `shop.json` et la migration d'un lot sont livrés ensemble ; le test de parité lit la **migration la plus récente** qui définit `public.shop_item` (et `public.badge_reward`), et passe à chaque fin de lot.

**Mise en production :** c'est le contrôleur (Opus) qui pousse chaque migration, après les tests locaux et un essai à blanc. Avant chaque `db push`, il demande l'accord de Marc **dans le chat**. La migration passe **avant** la fusion du code qui en dépend.

## 4. Lot 1 — Cadres et animations de profil

### 4.1 Animations de profil (`profile_fx`)

Ce sont des effets dessinés **autour** de l'avatar, sur l'écran « Moi » et sur le profil public. On ne les montre pas dans les lignes du classement, où ce serait trop chargé.

| Objet | Effet | Couleurs |
|---|---|---|
| `fx_ink` | 3 volutes d'encre qui tournent lentement autour du médaillon | noir `#1F1A17` à 40 % + vermillon |
| `fx_lightning` | 2 ou 3 éclairs courts qui apparaissent et disparaissent en alternance autour du cadre | vàng hoè `#D9A93A` + blanc crème |
| `fx_embers` | 6 à 8 braises qui montent et s'éteignent derrière l'avatar | đỏ son + vàng hoè |

Contraintes :
- On n'anime que `transform` et `opacity`, avec les durées de `src/ui/motion.ts`.
- C'est du SVG ou CSS en ligne : pas de `filter`, pas de dégradé.
- Avec `prefers-reduced-motion`, l'effet reste **figé**, dans son état le plus lisible.
- L'effet doit rester lisible en thème clair comme en thème sombre.

### 4.2 Écran « Moi » : section « Cadres et animations »

- Elle montre une grille des 6 récompenses.
  - **Obtenue :** l'aperçu sur l'avatar du joueur, et un bouton pour l'équiper ou la retirer. Un seul cadre et une seule animation sont équipés à la fois.
  - **Verrouillée :** l'aperçu en grisé et un cadenas, avec le badge qui la débloque (« Débloqué par « Une semaine » : 7 jours d'affilée »).
- Équiper déclenche `item_equipped` hors ligne, puis synchronise, exactement comme la boutique aujourd'hui.
- Quand un badge à récompense se débloque (écran de fin de leçon, de boss, de révision), la carte du badge ajoute « + cadre Jade » ou « + animation Braises ».

### 4.3 Boutique

- Les cadres disparaissent de la boutique.
- Une ligne discrète renvoie vers « Moi » : « Les cadres et animations se gagnent avec les succès ».

## 5. Lot 2 — Cosmétiques « Légendes sombres »

### 5.1 Composant `Character`

- Il est placé dans `src/ui/Character.tsx` : c'est une primitive d'affichage, sans logique métier.
- Il empile les calques SVG dans l'ordre suivant : `layer-aura`, `layer-shadow`, `layer-base`, `layer-face`, `layer-outfit`, `layer-hat`, `layer-accessory`. C'est l'ordre de `docs/art-direction.md` §4, avec `aura` en dessous.
- Props : `look: { character?, hat?, outfit?, accessory?, aura? }` et `size`.
- Il s'affiche toujours sur le médaillon « giấy điệp », comme l'exige la direction artistique §3.
- Les fichiers vont dans `src/assets/characters/<slot>/<id>.svg`. Chaque fichier respecte les règles de la direction artistique §3 et §7 : < 6 Ko, aplats, contour 2,5 px, points d'ancrage communs.
- **Le héros actuel est déjà en calques** (`src/assets/characters/hero-base.svg` a les groupes `layer-shadow` … `layer-accessory`) : il est **séparé en fichiers** par calque. Contrôle : capture avant/après côte à côte, identiques à l'œil (pas de diff au pixel).

### 5.2 Les quatre objets du thème `legendes_sombres`

| Id | Slot | Prix | Description (pour le dessin) |
|---|---|---|---|
| `hat_thuy_tinh` | hat | 60 | **Couronne des marées** : la couronne de Thủy Tinh, indigo et noire, avec des pointes en crêtes de vague. |
| `aura_waves` | aura | 80 | **Vagues sombres** : un arc de vagues indigo dressées derrière le héros. C'est la seule zone texturée (motif de vagues). |
| `outfit_son_tinh` | outfit | 90 | **Armure de Sơn Tinh** : plastron vert sombre en strates de roche, épaulières en montagnes. |
| `acc_thuan_thien` | accessory | 120 | **Thuận Thiên**, l'épée du lac Hoàn Kiếm : lame jade avec un liseré vàng hoè, tenue main droite `(92,122)`, levée à la verticale. |

Les objets sont dessinés avec la palette fermée de la direction artistique (§2). Le côté « sombre » vient de :
- l'indigo, le vert et le noir qui dominent ;
- des silhouettes anguleuses ;
- l'expression déterminée (sourcils), que ces objets peuvent imposer via le calque de tenue.

Ils doivent rester **lisibles à 40 px** et en niveaux de gris.

### 5.3 Boutique

- Elle a une section par thème, avec un titre, par exemple « Légendes sombres ». Les consommables (recharge, gel) restent en haut.
- Chaque cosmétique montre un **aperçu sur le héros du joueur**, avec son équipement actuel et l'objet ajouté. C'est l'**essayage**.
- Toucher la carte ouvre un essayage en grand. On y trouve **une seule action principale** : « Acheter (N xu) », ou « Équiper » / « Retirer » si l'objet est possédé.
- Après un achat, l'objet est **équipé automatiquement**. Ce sont deux événements, `item_purchased` puis `item_equipped`.

### 5.4 Où l'on voit le héros

| Endroit | Ce qu'on voit |
|---|---|
| Parcours (`HeroToken`) | Le héros complet dans le pion de 46 px, qui remplace l'image fixe actuelle. |
| « Moi » | Le héros en grand (≈ 160 px), avec son cadre et son animation. Le bouton « Changer de tenue » ouvre la boutique ou la penderie. |
| Profil public | Le héros en grand, avec cadre et animation, lu dans `leaderboard.equipped`. Un id inconnu de l'appli (objet d'une version plus récente) est traité comme un emplacement vide, sans erreur. |
| Classement (lignes, podium) | Inchangé : emoji et cadre. Il n'y a pas la place pour un personnage. |

### 5.5 Penderie

Dans « Moi », la liste des cosmétiques possédés, par slot, avec Équiper / Retirer. On peut réutiliser les cartes de la boutique en mode « possédé ».

## 6. Lot 3 — Personnages

- Il y a **deux** personnages à acheter, slot `character`, à **200 xu** chacun.
- Chacun fournit ses calques `base`, `face`, et sa tenue et son chapeau **par défaut**, sur les **mêmes points d'ancrage** que le héros actuel. Tous les cosmétiques vont donc sur tous les personnages.
- Ils sont dans le style Đông Hồ simplifié, avec une touche shonen ou dark fantasy :

| Id | Nom affiché | Silhouette |
|---|---|---|
| `char_kiem_khach` | La lame errante | Jeune escrimeur, bandeau vermillon sur le front, cheveux noirs en épis (shonen), tenue indigo serrée, cicatrice discrète sur la joue. |
| `char_phap_su` | La gardienne des talismans | Jeune femme aux longs cheveux noirs attachés, tunique noire et vermillon, bandes de talismans jaunes (vàng hoè) qui flottent. |

- Changer de personnage **garde** les cosmétiques équipés. Les points d'ancrage (direction artistique §4 : tête `(60,70)`, épaules `y = 92`, ourlet `y = 146`, mains `(28,122)` et `(92,122)`) sont un **contrat** : chaque personnage s'y conforme, et l'aura tient dans le `viewBox` 120×160 derrière n'importe quelle silhouette. La relecture vérifie chaque combinaison personnage × objet (6 × 2 = 12 captures dans `/__ui`).
- Le héros de départ (le petit au nón lá) reste gratuit et sélectionnable. C'est le slot `character` vide.
- Dans la boutique, les personnages forment une section « Personnages », placée **avant** les thèmes.

## 7. Économie (repères, appel du concepteur)

Un joueur régulier gagne environ 15 xu par leçon, 5 par dialogue, 3 par révision, 10 par badge et 50 pour le boss. Finir le tronc rapporte donc de l'ordre de **300 à 400 xu**.

| Ensemble | Coût total |
|---|---|
| Les 4 objets « Légendes sombres » | 350 xu |
| Les 2 personnages | 400 xu |

Le premier objet (60 xu) est accessible après 4 ou 5 leçons. L'ensemble du thème demande d'avoir fini le tronc. Les personnages sont un objectif de long terme.

Les prix sont des réglages : on les ajuste dans `shop.json` et dans la migration, et le test de parité garde les deux alignés.

## 8. Plus tard : les duels (non construit)

L'idée de Marc : deux joueurs s'affrontent sur les **leçons qu'ils ont tous les deux terminées**. On le note ici pour ne pas fermer de portes :
- les questions viennent de l'intersection des `lessons_done` des deux joueurs (déjà exposée par la vue `leaderboard`) ;
- le héros, avec son équipement, est l'avatar du combat : on réutilise `Character` et le format de combat du boss (PV, vies) ;
- il faudra choisir entre un duel asynchrone (même tirage, scores comparés) et un duel en direct (Supabase Realtime, gratuit). L'asynchrone est plus simple et marche hors ligne.

Rien de cela n'est construit dans les lots 1 à 3.

## 9. Tests et Definition of Done

- **Unitaires purs :**
  - `wallet.ts` : prix `null` refusé ; récompense de badge une seule fois ; ancien achat de cadre remboursé au rejeu ; équipement par slot.
  - `badges.ts` : règle `perfect_lessons`.
- **Parité catalogue et récompenses** (Vitest, §3.5), et **pgTAP** (§3.5).
- **Composants :**
  - `Character` : ordre des calques et équipement par défaut.
  - Section « Cadres et animations » : obtenu, verrouillé, équiper.
  - Boutique : sections par thème, essayage, achat puis équipement automatique.
- **e2e :** gagner `streak_7` (journal simulé), puis équiper le cadre bronze, puis le voir sur « Moi » ; acheter et équiper `hat_thuy_tinh`, puis le voir sur le parcours.
- **Lisibilité des dessins :** 40 px, thème sombre, niveaux de gris (direction artistique §3). Capture de chaque objet dans la galerie `/__ui`.
- Contrôle `npm run verify`, plus les e2e. Chaque lot est vérifié sur le téléphone de Marc avant le suivant si possible.

## 10. Laissé au concepteur

- La disposition exacte des sections, dans le respect de `docs/design-system.md` et du skill `vietlearn-design`.
- Les textes d'interface exacts (en français, en tutoiement) et les noms affichés des animations.
- Le détail des dessins, dans le respect de la direction artistique.
- Les durées précises des animations, prises dans le catalogue `motion.ts`.
