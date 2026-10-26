# Sons et nouvelle révélation du gacha — design

Statut : approuvé par Marc dans le chat le 2026-10-26 (« C'est parfait, tu peux m'écrire les specs »). Cible : version 1.7.0. Pas d'échéance ferme : Mathias reçoit la version actuelle le 2026-10-29, et ce lot arrive ensuite en mise à jour (décidé par Marc). Ordre de livraison : 1) moteur de son et sons des leçons ; 2) nouvelle révélation du gacha (présage, cartes) avec ses sons ; 3) signature de la Gardienne ; 4) sons d'armes, de combat et d'arène. Chaque étape doit pouvoir être livrée seule.

## 1. Intention

Tiếng Nhà est muet. Marc veut du son « au jeu en général, surtout pour le gacha », pour que ce soit plus divertissant pour Mathias (fan de shōnen / dark fantasy). Il veut aussi refaire la révélation du gacha. Aujourd'hui on choisit un bâtonnet dont la couleur trahit la rareté, et les bâtonnets sont petits et difficiles à toucher. Il veut que la tension monte avec la meilleure rareté de la fournée, sans rien dévoiler d'avance, et qu'un légendaire ait sa propre mise en scène.

Réussite : Mathias entend tout de suite qu'il a bien répondu, sent la différence entre un tirage ordinaire et un tirage exceptionnel avant de voir quoi que ce soit, et réagit à voix haute devant un légendaire.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Des sons pour les leçons, les combats (duels et boss) selon l'équipement du héros, l'arène et le gacha.
- Une révélation du gacha qui va crescendo selon la meilleure rareté de la fournée, avec des cartes faciles à toucher.
- Une « révélation signature » par légendaire, avec un système qui accepte d'autres légendaires plus tard.

**Non-objectifs**
- De la musique de fond.
- Des sons sur la navigation ordinaire (onglets, boutons courants).
- Des vibrations : à envisager plus tard, hors de ce lot.
- Un réglage de volume fin : on a seulement « Sons » activé ou non.

**Anti-objectifs** (ce qui serait un échec même si ça marche)
- Des sons agaçants à la longue : la bonne réponse revient des centaines de fois.
- Un son qui couvre ou coupe la voix vietnamienne. L'apprentissage passe avant le spectacle.
- Une appli qui saccade sur un téléphone moyen à cause d'une animation.
- Un son qui joue alors que « Sons » est désactivé.
- Une rareté devinable avant le présage.
- Un résultat qui change selon la carte touchée. Le tirage reste décidé par le serveur.

## 3. Contraintes

- **Stack et architecture.**
  - Aucune nouvelle dépendance : le son s'appuie sur la Web Audio API du navigateur.
  - L'architecture hexagonale est conservée : un port, un adaptateur et un fake. Les composants n'importent jamais l'adaptateur.
  - Les règles de mouvement viennent d'ADR 0010 et de l'audit §D. Seuls `transform` et `opacity` sont animés. Pas de filtre ni de flou animés, pas de boucle infinie hors écran. « Passer » est toujours visible. En mouvement réduit, on va droit au résultat.
- **Budget.** 0 €. Les sons sont synthétisés, donc pas de fichiers, ni de licence, ni de poids ajouté au pré-cache. *(Choix de Claude.)*
- **Timbre.** Instruments vietnamiens stylisés, cohérents avec le style « laque et estampe » : bloc de bois (mõ), gong, clochettes, cordes pincées façon đàn tranh. *(Choix de Claude.)*
- **Navigateurs.**
  - Le contexte audio ne démarre qu'après un geste de l'utilisateur. iOS l'exige, d'où le piège de l'AGENT_BRIEF.
  - Mathias a un iPhone. La voix vietnamienne (packs MP3 via `<audio>`) joue déjà même en mode silencieux, car elle met la page en session « lecture ». Les effets sonores passeront donc aussi en mode silencieux, comme la voix. *(Choix de Claude, pour ne pas changer le comportement actuel de la voix.)* L'interrupteur « Sons » permet de les couper.
  - Si la Web Audio API manque, l'appli reste muette sans planter.
- **Voix.** Pendant que la voix vietnamienne parle (TTS ou pack audio), un effet sonore n'est pas joué, ou il est joué nettement plus bas. Il ne la coupe jamais.
- **Réglage.** Interrupteur « Sons » dans Moi, activé par défaut. Il s'enregistre avec les autres réglages et ne bloque rien s'il est absent des réglages existants.
- **Textes.** En français dans `src/i18n/fr.ts`. Les mots vietnamiens portent `lang="vi"`. Une espace fine insécable (U+202F) précède `? ! : ;`.
- **Commits.** Signés Marc uniquement, sans aucune mention de Claude ou d'une IA.
- **Version.** 1.7.0, avec une entrée de changelog écrite pour Mathias, sans jargon.

## 4. Sons — ce qui a été décidé

### 4.1 Leçons, révisions et boss
Décidé par Marc :
- **Bonne réponse :** un son de succès court et net.
- **Leçon réussie :** un succès plus ample. *Proposition de Claude : la même « famille » que la bonne réponse, en plus long.*
- **Vie perdue :** un bruit de coup reçu, sec.
- **Leçon perdue (plus de vies) :** un son de défaite, grave et descendant, pas punitif.

Ces sons valent aussi pour le boss Thủy Tinh et les révisions, quand l'événement existe : bonne réponse, vie perdue, victoire, défaite. *(Choix de Claude.)*

### 4.2 Combats (duels et boss) : sons selon l'équipement
Décidé par Marc : « on va juste entendre des bruits par rapport aux skins ».
- **Armes communes, rares ou sans rareté :** un son classique selon le type d'arme. Il y a un son par famille : lame, bâton ou lance, éventail, poings ou mains nues. Le constructeur attribue une famille à chaque accessoire du catalogue.
- **Armes épiques et légendaires :** chacune a son propre son. Aujourd'hui, cela concerne l'épée Thuận Thiên (`acc_thuan_thien`, épique).
- **Personnages épiques et légendaires :** ils peuvent avoir un son de coup propre quand ils frappent à mains nues. *(Choix de Claude.)* Exemple : `char_phap_su`, des talismans qui claquent.
- **Coups :** chaque combattant (le héros comme l'adversaire en duel) frappe avec le son de **son** équipement, que le joueur possède l'objet ou non. Un coup qui touche le héros ajoute le son « dégâts ». *(Choix de Claude.)* Un coup manqué joue un simple souffle d'air.
- **Coups critiques :** même son que le coup normal, plus fort, avec une attaque plus sèche.

### 4.3 Arène
Choix de Claude, avec carte blanche de Marc :
- un gong au début d'un duel ;
- une fanfare courte à la victoire ;
- un son sobre à la défaite ;
- un tintement de pièces quand on gagne des Kim bài.

### 4.4 Gacha
Voir le §5 pour le présage et les cartes. Chaque rareté a aussi son son quand une carte se retourne :
- Commun : claquement de bois.
- Rare : clochettes de jade.
- Épique : gong moyen.
- Légendaire : grand gong grave.

## 5. Nouvelle révélation du gacha (remplace la chorégraphie du §2 de la spec gacha)

Ce qui est retiré :
- choisir un bâtonnet sur l'autel ;
- la couleur de la pointe des bâtonnets avant la révélation ;
- l'éventail de bâtonnets sur deux rangées.

Déroulé, décidé par Marc :
1. **Le tirage.** On secoue le tube (on le touche ou on le maintient). Les bâtonnets sortent tous ensemble, 1 ou 10. Ils sont identiques, en bois nu, et ne disent rien de la rareté.
2. **Le présage.** Au moment où les bâtonnets sortent, le son et l'animation montent selon la meilleure rareté de la fournée. C'est le seul indice. *Paliers proposés par Claude, acceptés par Marc :*
   - Commun : un simple claquement de bois.
   - Rare : des clochettes de jade, et une lueur jade sur l'autel.
   - Épique : un gong, et des lanternes rouges qui s'allument.
   - Légendaire : un grand gong grave, une pause, une lumière dorée qui envahit l'autel, puis des confettis une seule fois.
   
   Le présage est d'autant plus long et ample que la rareté est haute. Une fournée de communs doit rester brève.
3. **Les cartes.**
   - Les bâtonnets se rangent en grandes cartes, faces cachées : une seule carte centrée pour ×1, une grille de 2 colonnes pour ×10.
   - Les cartes sont faciles à toucher. Les cibles font au moins 44 px, *et visent nettement plus*.
   - Toucher une carte la retourne sur place : sa rareté s'affiche (sceau et couleur) avec le son de rareté (§4.4). Puis la carte s'agrandit en vue centrée (l'actuel rouleau) montrant l'objet porté par le héros, son nom et « Nouveau ! » ou « Déjà obtenu → +N xu ». Fermer cette vue ramène à la grille, où la carte reste retournée, avec un petit aperçu. *(Choix de Claude : à 320 px, une carte d'un ×10 est trop petite pour montrer le héros en grand.)*
   - Une signature (§6) joue dans cette vue centrée, avant que l'objet apparaisse.
4. **Tout découvrir.**
   - Un bouton retourne toutes les cartes restantes.
   - *Proposition de Claude, acceptée :* elles se retournent de la moins rare à la plus rare, pour finir sur la meilleure.
   - Le récapitulatif vient à la fin, avec le contenu et le tri actuels.
   - « Passer » reste visible du début à la fin et mène au récapitulatif.
5. **Ce qui ne change pas.**
   - Le résultat est fixé par le serveur avant l'animation. Toucher une carte plutôt qu'une autre ne change que l'ordre de découverte.
   - Passer, tout découvrir ou être en mouvement réduit montre exactement le même tirage.
   - Un tirage récupéré après une coupure s'ouvre directement sur le récapitulatif.

## 6. Révélation signature des légendaires

Décidé par Marc : chaque légendaire a son animation propre avant que l'objet soit révélé, et le système doit en accueillir d'autres plus tard.

### 6.1 Règles
- **Durée et moment.** Une signature dure environ 3 à 4 secondes, avec son propre son. Elle joue quand la carte d'un légendaire se retourne, juste avant que l'objet apparaisse.
- **Plusieurs légendaires dans une fournée.** Chacun joue sa signature quand on touche sa carte. Avec « Tout découvrir », les signatures passent l'une après l'autre, à la fin, puisque l'ordre va de la moins rare à la plus rare.
- **Interruption.** « Passer » coupe la signature à tout moment.
- **Mouvement réduit.** Pas de signature : on va au résultat.
- **Légendaire sans signature.** Il reçoit la mise en scène dorée générique.
- **Ajouter une signature.** Une signature se rattache à l'identifiant de l'objet. En ajouter une ne touche pas au reste de la révélation.
- **Budget.** Une signature peut dépasser le budget habituel d'éléments animés (≤ 8), mais pas de beaucoup. *Plafond proposé : 16 éléments animés, dont au plus 12 particules par SVG.* Elle n'a jamais de boucle infinie, et les éléments disparaissent avec la fin de la séquence. Toujours transform/opacity uniquement. Il faut vérifier la fluidité avec le processeur ralenti ×4.

### 6.2 La gardienne des talismans (`char_phap_su`) — à réaliser
*Proposition de Claude, acceptée par Marc :*
1. La carte s'assombrit. Un coup de vent arrache une douzaine de talismans de papier jaune à sceau rouge, qui tourbillonnent autour de l'autel.
2. À chaque passage, un sceau s'embrase en or, avec un son de pinceau qui frappe le papier.
3. Les talismans se resserrent en une silhouette d'encre.
4. Un dernier coup de gong : l'encre éclate comme une tache sur le papier, et la Gardienne apparaît (la suite normale de la carte).

### 6.3 Exemple réservé pour plus tard : une épée au dragon
Idée de Marc, développée par Claude. Rien à construire maintenant, c'est seulement la preuve que le système accueille ce genre de scène.

Un dragon d'encre s'enroule autour de l'autel, avec un rugissement grave et un grondement. Il plonge dans la lame, qui s'illumine de veines dorées. Un tintement métallique, puis l'arme est révélée.

## 7. Laissé au constructeur
- **Synthèse des sons.** La recette de chaque son : oscillateurs, enveloppes, bruit filtré. Elle doit tenir l'esprit de chaque son (§4) et les anti-objectifs. Le constructeur prévoit une page ou un panneau d'écoute en mode démo pour valider les sons à l'oreille.
- **Volume et sons rapprochés.** Les volumes relatifs, et le traitement des sons qui se chevauchent : limiter la polyphonie, ne pas rejouer le même son dans les 50 ms.
- **Le port.** La forme exacte du port, par exemple `Sound.play(cue)` avec un catalogue de noms de sons. Son câblage dans les services, son fake pour les tests et l'e2e (il enregistre ce qui a été joué).
- **Le réglage « Sons ».** Où il se range dans les réglages existants et sa migration, avec activé par défaut. Son libellé dans Moi.
- **Familles d'armes.** L'attribution d'une famille à chaque accessoire actuel : `acc_giao_tre` lance, `acc_quat_sat` éventail, `acc_con_vo` bâton, `acc_thuan_thien` épique propre. Et l'endroit où cette donnée vit : catalogue ou table dans le code.
- **Mise en scène.** Le dessin des cartes faces cachées, de la lueur jade et des lanternes. Le dessin des talismans et de la silhouette d'encre, en SVG dans le style Đông Hồ des autres pièces. Les durées exactes, tirées des jetons de mouvement.
- **Tests.** Le découpage en tâches et les tests. On garde un module pur pour l'ordre et la durée des temps, comme `gachaReveal.ts` aujourd'hui.
