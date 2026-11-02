# Tagalog et plusieurs langues — design

Statut : rédigé le 2026-11-02 à partir de la discussion avec Marc, qui l'a validé (« Choisis seul, je te fais confiance », en réponse à la dernière question : le choix de la voix tagalog revient à Claude). Cible : versions 2.0.0 à 2.2.0 (§4.6).

Ce que Marc a dit :
- « je veux que tu me rajoutes le tagalog. Je veux savoir parler surtout. Je ne vais pas lire de livre […]. Cependant, si l'écriture peut m'aider à mieux prononcer le mot ok. Plus tard, il se pourrait qu'il y aurait d'autres langues […]. A toi de prévoir une architecture scalable. »
- « je vais partir en voyage. Je veux pouvoir parler pour commander à manger ou autres. »
- « prépare une vue où on peut choisir la langue qui nous redirige sur les cours après […] avant qu'on ait le chemin et les cours qui sont affichés, on peut choisir la langue qu'on veut apprendre et switcher entre elle. »
- « Tu peux ajouter le boss final et les succès pour le tagalog. » Pour les duels, « contrôler que chaque joueur ait passé les mêmes cours et [que] les questions ressortent ».
- Situations voulues : « Commander, payer, demander son chemin, prendre un taxi, salutation de base ».

Tout le reste est marqué *(choix de Claude)*.

## 1. Intention

Marc part en voyage aux Philippines. Il veut se débrouiller **à l'oral** :
- saluer ;
- commander à manger ;
- payer ;
- demander son chemin ;
- prendre un taxi.

L'appli devient multi-langues. On choisit la langue à apprendre avant le parcours et on peut en changer à tout moment. Le vietnamien reste tel quel.

**Réussite :**
- sur place, Marc ose dire les phrases clés et comprend les réponses courantes (un prix, « tout droit », « à gauche ») ;
- ajouter une 3ᵉ langue plus tard demande seulement d'ajouter du contenu, une voix et une fiche de réglages, pas de réécrire l'appli.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Un écran de choix de langue et un sélecteur pour changer de langue.
- Un parcours tagalog complet :
  - des leçons ;
  - des dialogues ;
  - un boss final ;
  - des succès propres à la langue ;
  - des duels.
- Une voix tagalog pré-générée, qui marche sur iPhone sans voix système tagalog.
- Une aide à la prononciation écrite pour les francophones.
- Une architecture où une langue est une **donnée**, pas une branche de code.

**Non-objectifs**
- Lire ou écrire le tagalog pour lui-même : grammaire formelle, conjugaison détaillée des affixes, orthographe.
- Traduire l'interface : elle reste en français.
- Une 3ᵉ langue maintenant.
- Toucher au contenu vietnamien.

**Anti-objectifs**
- Un tagalog de manuel que personne ne parle dans la rue. Le tagalog réel des voyageurs mélange l'anglais (« Taglish ») et compte souvent les prix en espagnol ou en anglais. Le contenu doit enseigner ce qu'on entend vraiment.
- Casser quoi que ce soit pour les joueurs qui n'apprennent que le vietnamien, comme Mathias : progression, xu, classement, certificat.
- Une architecture qui oblige à dupliquer chaque écran par langue.

## 3. Contraintes

- La stack du projet et ADR 0001. Une nouvelle dépendance seulement avec ADR.
- Budget 0 € : outils gratuits uniquement.
- Les textes d'interface sont en français dans `src/i18n/fr.ts`.
- Les mots tagalog portent `lang="tl"`, les mots vietnamiens gardent `lang="vi"`.
- Commits signés Marc uniquement, sans mention de Claude ou d'une IA.
- Les migrations existantes ne sont jamais modifiées. Les nouvelles partent en production avant l'appli, et une appli 1.11 encore ouverte ne doit pas casser.

## 4. Décidé

### 4.1 Une langue est une donnée *(choix de Claude)*

- Un **registre des langues** (`src/content/languages.json` ou équivalent) donne, pour chaque langue :
  - `id` : `vi`, `tl` ;
  - le nom en français et le nom natif ;
  - un emblème (pas d'emoji drapeau : une petite icône SVG maison) ;
  - le code de reconnaissance et de synthèse vocale (`vi-VN`, `fil-PH`) ;
  - le préfixe des identifiants de contenu ;
  - le boss final de la langue ;
  - les voix disponibles.
- **Le contenu est rangé par langue** dans `src/content/<langue>/` :
  - leçons, dialogues, parcours, boss et pool d'examen ;
  - le vietnamien y est déplacé, avec ses identifiants inchangés.
- **Identifiants de contenu préfixés.** Les nouveaux identifiants portent le préfixe de leur langue : `tl_l01`, `tl_d01`, `tl_v_salamat`, `tl_boss_…`. Les identifiants vietnamiens existants (`l01`, `v_…`) restent tels quels : le vietnamien est la langue « sans préfixe ». Ainsi :
  - le journal d'événements, les révisions et le serveur continuent de marcher sans renommer l'existant ;
  - `lessons_done` et `dialogues_done` peuvent contenir des leçons des deux langues ;
  - la langue d'un identifiant se lit avec une seule fonction.
- **La parole reçoit la langue en paramètre.** Les ports de synthèse et de reconnaissance vocales prennent la langue au lieu de `"vi-VN"` en dur. Les voix pré-générées sont rangées par langue.

### 4.2 Choix et changement de langue

- **Au premier lancement après la mise à jour,** ou après l'inscription, un écran « Quelle langue veux-tu apprendre ? » montre une carte par langue : nom, nom natif, emblème, et une ligne qui dit à quoi elle sert (*Le parler du Sud* / *Pour voyager aux Philippines*).
  - *(choix de Claude)* Un joueur qui a déjà progressé en vietnamien voit cet écran une fois, avec le vietnamien présélectionné.
- **Le choix est retenu par appareil,** dans les réglages locaux, avec le vietnamien par défaut si rien n'est enregistré.
- **Un sélecteur en haut de l'accueil** montre la langue en cours et permet d'en changer à tout moment. Changer de langue change :
  - le parcours ;
  - les révisions, limitées aux mots de la langue ;
  - le boss ;
  - la liste des succès mise en avant ;
  - le choix de langue pour les duels.
- **Partagé entre les langues** *(choix de Claude)* :
  - le héros, les xu, le Kim bài, les tirages, l'énergie, la série et le bonus quotidien ;
  - l'XP, qui compte au total dans le classement.

### 4.3 Contenu tagalog *(choix de Claude, à partir des situations données par Marc)*

- **Huit leçons**, chacune suivie de son dialogue :
  1. Salutations et politesse : *po* / *opo*, *salamat*, *magandang umaga*.
  2. Se présenter et petites phrases de survie : *hindi ko alam*, *pakiulit*, *marunong ka bang mag-Ingles?*
  3. Les nombres, avec la vraie pratique :
     - nombres tagalog de 1 à 10 ;
     - prix en espagnol (*singkuwenta*, *isandaan*) ;
     - prix en anglais.
  4. Commander à manger : plats courants, *isa pa*, *pahingi ng tubig*, *masarap*.
  5. Payer : *magkano?*, *bayad*, *sukli*, *pwede bang GCash?*, *ang mahal!*
  6. Demander son chemin : *nasaan ang…?*, *kaliwa*, *kanan*, *diretso*, *malapit*, *malayo*.
  7. Prendre un taxi : la destination (*sa … po*), *para po!*, le compteur, le jeepney, Grab.
  8. Révision en situation : une journée de voyageur.
- **Exercices :** les types existants, avec l'oral en premier :
  - écouter puis choisir ;
  - traduire puis choisir ;
  - remettre les mots dans l'ordre ;
  - parler.
  
  L'exercice des tons est réservé au vietnamien : le registre dit quels types d'exercices une langue utilise.
- **Aide à la prononciation :** chaque mot et chaque phrase tagalog porte une **transcription pour francophone**, les syllabes séparées par un point et la syllabe accentuée en capitales (`sa·LA·mat`, `ma·GAN·dang u·MA·ga`). Elle s'affiche :
  - sous le mot, dans le jeu de cartes de vocabulaire ;
  - dans la correction après une réponse.
  
  C'est l'aide demandée par Marc : « si l'écriture peut m'aider à mieux prononcer ».
- **Boss final :** **Bakunawa**, le serpent de mer qui avale la lune (mythologie philippine), dessiné dans le même style que Thủy Tinh. Il a son propre pool de questions, tiré des 8 leçons, et les mêmes règles de combat.
- **Succès tagalog :** environ 8, comme premier cours, toutes les leçons, tous les dialogues, boss vaincu, sans faute… Ils ont des identifiants `tl_…` et leurs propres montants de xu (20 à 200, comme la 1.10). Les succès transversaux (série, jours actifs, XP) restent communs.
- **Qualité :** aucun locuteur natif ne relit avant la mise en ligne. Le contenu est donc limité aux phrases de voyage les plus courantes et les plus sûres. Marc pourra signaler une erreur avec le bouton « Signaler » qui existe déjà.

### 4.4 Voix

- Les voix tagalog sont pré-générées comme les voix vietnamiennes (ADR 0011), une voix féminine et une voix masculine si le moteur les a, avec un moteur **gratuit**.
- Le choix du moteur est laissé au constructeur. Il doit être gratuit, utilisable pour un projet personnel non commercial, et sa prononciation doit être jugée correcte sur un échantillon.
- **Reconnaissance vocale :** la reconnaissance `fil-PH` du navigateur n'est pas garantie sur iPhone. Sans elle, les exercices et la 2ᵉ manche des duels passent à l'auto-évaluation qui existe déjà.

### 4.5 Serveur

- **Examen et boss par langue :**
  - les tentatives (3 par jour) et le meilleur score sont comptés **par langue** ;
  - le certificat et les succès vietnamiens restent ceux du vietnamien ;
  - l'existant reste valable : une tentative sans langue est vietnamienne.
- **Les montants des nouveaux succès `tl_…`** sont ajoutés à `badge_coins`, avec le test de parité.
- **Duels :**
  - un duel porte sa langue ;
  - les questions viennent des leçons de cette langue terminées par les deux joueurs ;
  - il faut avoir fini le premier cours et le premier dialogue de la langue pour jouer ;
  - les duels existants sont vietnamiens.

### 4.6 Précisions après relecture *(choix de Claude)*

- **Livraison par étapes, le contenu en premier :**
  1. **2.0.0** : le registre, le choix de langue, les leçons, les dialogues, la voix et l'aide à la prononciation tagalog.
  2. **2.1.0** : le boss, les succès et le certificat.
  3. **2.2.0** : les duels.
  
  Marc ne donne pas de date de voyage (« ne t'inquiète pas de ça ») : ainsi, l'essentiel pour parler arrive en premier.
- **Succès par langue.** Les succès liés au contenu ne comptent que la progression de leur langue :
  - leçons, dialogues, sans faute, mots révisés, boss.
  
  Les succès vietnamiens existants gardent leurs identifiants et ne comptent que le vietnamien. Personne ne perd un succès déjà obtenu, puisqu'un succès gagné l'est pour toujours. Les succès transversaux, série, jours actifs et XP, restent communs.
- **Certificat tagalog.** Vaincre Bakunawa donne un certificat tagalog, avec le même dessin que le vietnamien et un texte à la langue.
- **Le profil public** montre le boss de chaque langue commencée par le joueur.
- **L'XP d'examen** se calcule sur le meilleur score de la langue.
- **Limites des duels :**
  - un seul duel ouvert par paire de joueurs **et par langue** ;
  - la limite de 5 nouveaux duels par jour est commune ;
  - l'ancienne fonction de création de duel reste valable pour les applis 1.11 et crée un duel vietnamien.
- **L'accent tonique tagalog** ne s'écrit pas dans l'orthographe courante. Chaque transcription doit donc venir d'une source gratuite qui le note, en priorité la prononciation (API) du Wiktionnaire anglais. Un mot sans source sûre n'est pas enseigné.

## 5. Laissé au constructeur

- Le nom exact des fichiers et la forme du registre.
- Le découpage de la migration.
- La façon de déplacer le contenu vietnamien sans casser les tests.
- Le dessin de l'écran de choix, du sélecteur et de Bakunawa, en suivant le design system et le skill `vietlearn-design`.
- Le moteur de voix, avec les contraintes du §4.4.
- La liste exacte des mots et des phrases, avec les thèmes du §4.3.
- Le nombre exact de succès.
- Le découpage en tâches et en versions intermédiaires.
