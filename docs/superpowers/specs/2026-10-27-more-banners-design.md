# Deux nouveaux tirages — design

Statut : approuvé par Marc dans le chat le 2026-10-27 (« 1 et 2 pour l'instant », puis « vas-y fais les specs jusqu'à l'implémentation »). Cible : version 1.8.0, en mise à jour après le 2026-10-29.

## 1. Intention

La Boutique n'a qu'un tirage, « Légendes sombres ». Marc veut que Mathias ait le choix entre trois, avec des thèmes qu'il aime : dark fantasy et shōnen, ancrés dans les légendes vietnamiennes. Marc a choisi deux thèmes parmi trois propositions :
- **Long Vương — Le seigneur des mers** : dragons.
- **Hồ ly — Les esprits de la nuit** : renards-esprits, feux follets, la nuit des âmes errantes.

Réussite : Mathias hésite entre les trois bannières et en a une préférée. Un légendaire de chaque nouveau thème lui fait le même effet que la Gardienne.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Deux nouveaux tirages permanents, chacun de 12 objets.
- Une signature pour chacun des deux nouveaux légendaires.
- Un sélecteur clair entre les trois bannières.

**Non-objectifs**
- Changer les règles du gacha : taux, prix, garanties, doublons et présage restent ceux de la spec gacha et de la spec « sons et révélation ».
- Des bannières à durée limitée.
- Le thème « Thánh Gióng », gardé pour plus tard.
- Du contenu d'apprentissage sur les légendes (textes, vocabulaire) : seuls les noms des objets portent les mots vietnamiens (`lang="vi"`). *(Choix de Claude.)*
- Changer l'écran Moi ou la garde-robe : les nouveaux objets y apparaissent comme les autres, et les thèmes ne se montrent que dans la Boutique. *(Choix de Claude.)*

**Anti-objectifs**
- Un thème qui ressemble à un simple recoloriage de l'autre.
- Des objets qui jurent avec le style d'estampe Đông Hồ ou avec les trois personnages existants.
- Une Boutique devenue un long défilement où l'on se perd.
- Un compteur de garantie ou une collection qui mélange les thèmes.

## 3. Contraintes

- **Stack.** Celle du projet, sans nouvelle dépendance. Architecture hexagonale, frontières ESLint.
- **Textes.** Français dans `src/i18n/fr.ts` ; mots vietnamiens en `lang="vi"` ; espace fine insécable U+202F devant `? ! : ;` et à l'intérieur des « ».
- **Mouvement.** Mêmes budgets qu'ADR 0010 et l'audit §D. Une signature a droit à 16 éléments animés au plus, dont 12 particules par SVG au plus, sans boucle, et tout se démonte à la fin. Vérification ×4 CPU.
- **Serveur.** Une nouvelle migration `20261028000000_more_banners.sql`. Le catalogue côté serveur (`public.shop_items()`) est recréé selon le même modèle que la migration gacha, et aucune migration déjà appliquée n'est modifiée. Les nouveaux objets ont `price = null`, `currency = 'xu'`, leur thème et leur rareté. Le compteur de garantie `gacha_pity` est déjà indexé par thème. Les tests pgTAP couvrent les nouveaux thèmes.
- **Parité.** Le catalogue `src/content/shop.json` et le catalogue serveur restent identiques, ce que vérifie le test de parité existant.
- **Commits.** Signés Marc uniquement, sans aucune mention de Claude ou d'une IA.

## 4. Décidé

### 4.1 Les trois bannières
- Le haut de la Boutique porte un sélecteur à trois onglets, dans cet ordre : « Légendes sombres », « Seigneur des mers », « Esprits de la nuit ». L'onglet affiche la bannière du thème et sa collection.
- Le dernier onglet ouvert est retenu sur l'appareil. Si cette mémoire n'est pas disponible, on ouvre le premier onglet.
- Chaque bannière garde ses éléments actuels : son illustration, les deux boutons de tirage, les taux, la ligne « Légendaire garanti dans N tirages » et la ligne « x/12 obtenus ». Le tout est propre au thème.
- *(Choix de Claude)* Les intitulés complets, avec le nom vietnamien, apparaissent dans la bannière :
  - « Long Vương — Le seigneur des mers » ;
  - « Hồ ly — Les esprits de la nuit ».
  
  Les onglets utilisent la forme courte.

### 4.2 Catalogues
*(Choix de Claude, acceptés par Marc.)* Les identifiants suivent les conventions existantes (`acc_`, `hat_`, `outfit_`, `aura_`, `char_`).

**Seigneur des mers** (`seigneur_des_mers`)

| Rareté | Identifiant | Nom | Emplacement |
|---|---|---|---|
| commun | `acc_mai_cheo` | Rame de pêcheur | accessoire |
| commun | `hat_khan_song` | Bandeau d'écume | couvre-chef |
| commun | `outfit_ao_luoi` | Tunique de filets | tenue |
| commun | `aura_bot_bien` | Écume marine | aura |
| rare | `acc_dinh_ba` | Trident de corail | accessoire |
| rare | `hat_vuong_mien_san_ho` | Couronne de corail | couvre-chef |
| rare | `outfit_ao_thuy_trieu` | Manteau des marées | tenue |
| rare | `aura_ngoc_trai` | Perles flottantes | aura |
| épique | `char_lac_long_quan` | Lạc Long Quân | personnage |
| épique | `outfit_giap_vay_rong` | Armure d'écailles de dragon | tenue |
| épique | `hat_mu_rong` | Heaume du dragon | couvre-chef |
| légendaire | `acc_kiem_rong` | L'épée du dragon | accessoire |

**Esprits de la nuit** (`esprits_de_la_nuit`)

| Rareté | Identifiant | Nom | Emplacement |
|---|---|---|---|
| commun | `acc_long_den` | Lanterne de papier | accessoire |
| commun | `hat_khan_den` | Voile noir | couvre-chef |
| commun | `outfit_ao_dem` | Tunique de la nuit | tenue |
| commun | `aura_dom_dom` | Lucioles | aura |
| rare | `acc_quat_giay` | Éventail de papier-monnaie | accessoire |
| rare | `hat_tram_chuong` | Coiffe aux clochettes | couvre-chef |
| rare | `outfit_ao_khoi` | Robe de brume | tenue |
| rare | `aura_khoi_huong` | Fumée d'encens | aura |
| épique | `hat_mat_na_cao` | Masque de renard | couvre-chef |
| épique | `aura_ma_troi` | Feux follets | aura |
| épique | `char_thay_phap` | Le chasseur d'esprits | personnage |
| légendaire | `char_ho_ly` | La renarde à neuf queues | personnage |

### 4.3 Dessins
- Les 24 objets sont dessinés en SVG dans le style Đông Hồ des pièces existantes, avec le même contour, la même palette et les mêmes ancrages d'emplacement. Chacun doit aller avec les trois personnages de base et rester lisible à 160 px et à 40 px, en clair, en sombre et en niveaux de gris.
- Les trois nouveaux personnages ont la même taille et les mêmes points d'accroche que les personnages existants. Les accessoires et couvre-chefs des autres thèmes doivent tomber juste sur eux.
- Chaque thème a son illustration de bannière. *(Choix de Claude : on y voit le légendaire du thème, comme la Gardienne aujourd'hui.)*
- Chaque thème a aussi sa teinte d'autel pendant le présage : vert-bleu de mer pour le Seigneur des mers, indigo de nuit pour les Esprits. Ce sont des jetons de couleur ; le présage lui-même ne change pas.

### 4.4 Signatures
Elles suivent les règles de §6.1 de la spec « sons et révélation » :
- elles durent environ 3 à 4 secondes et jouent dans la vue centrée ;
- « Passer » les coupe ;
- en mouvement réduit, il n'y en a pas ;
- tous les sons s'arrêtent avec la scène ou si l'appli passe en arrière-plan.

**L'épée du dragon** (`acc_kiem_rong`)
1. Un dragon d'encre s'enroule autour de l'autel avec un rugissement grave et un grondement.
2. Il plonge dans la lame, qui s'illumine de veines dorées.
3. Un tintement métallique, puis la carte révèle l'objet.

**La renarde à neuf queues** (`char_ho_ly`)
1. Les lanternes s'éteignent une à une, chaque fois avec un souffle.
2. Dans le noir, neuf queues de flammes bleues se déploient en éventail derrière une silhouette, avec un crépitement de feu froid.
3. Un tintement de clochettes, puis elle apparaît.

Les sons nécessaires sont synthétisés comme les autres : `sig.roar`, `sig.blade`, `sig.lantern`, `sig.foxfire`. *(Choix de Claude)*

### 4.5 Sons de combat
- Familles d'armes :
  - `acc_mai_cheo` : bâton ;
  - `acc_dinh_ba` : bâton ;
  - `acc_long_den` : bâton ;
  - `acc_quat_giay` : éventail ;
  - `acc_kiem_rong` : légendaire, avec son propre son, `blow.acc_kiem_rong`, une lame avec un écho de rugissement.
- Personnages épiques et légendaires :
  - `char_ho_ly` a un son propre, `blow.char_ho_ly` (crépitement de feu froid) ;
  - `char_lac_long_quan` a un son propre, `blow.char_lac_long_quan` (vague qui s'écrase) ;
  - `char_thay_phap` utilise le son des mains nues. *(Choix de Claude)*

### 4.6 Précisions issues de la relecture *(choix de Claude)*
- **Corps et emplacements.** Un personnage est un corps : couvre-chef, tenue, accessoire et aura se portent par-dessus, comme aujourd'hui. Il y aura donc **six corps** : `hero`, `char_kiem_khach`, `char_phap_su` et les trois nouveaux. Les 24 nouveaux objets doivent tomber juste sur les six. Les objets existants doivent aussi tomber juste sur les trois nouveaux corps. C'est vérifié par une planche de contact : chaque objet sur chaque corps, en clair et en sombre.
- **Bannière du Seigneur des mers.** Elle montre Lạc Long Quân tenant l'épée du dragon. Dans la vue centrée, l'épée apparaît portée par le héros du joueur, comme tout accessoire.
- **Validation du dessin.** Les dessins sont faits par un agent, puis relus sur planche de contact par un relecteur. Marc les voit dans la démo après la mise en ligne, et les retouches éventuelles viennent ensuite. Aucun dessin provisoire n'est livré.
- **Ordre de déploiement.** La migration part d'abord, l'appli ensuite. Une appli 1.7 encore ouverte ne casse pas :
  - la Boutique ignore les thèmes qu'elle ne connaît pas ;
  - le portefeuille ignore les objets absents de son catalogue ;
  - le serveur reste la référence pour les xu et l'inventaire.
  
  Ces trois points sont à vérifier par un test.

## 5. Laissé au constructeur
- La disposition exacte du sélecteur d'onglets : composant existant (`SegmentedNav`) ou équivalent. Où retenir l'onglet, en `localStorage` avec try/catch.
- Les recettes sonores, le dessin des signatures et leurs temps exacts, à tirer des jetons de mouvement.
- Le découpage en tâches et les tests, sur le modèle du plan gacha et du plan « sons et révélation ».
- La version 1.8.0 et son entrée de changelog en français pour Mathias.
