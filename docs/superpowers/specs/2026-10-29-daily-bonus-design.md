# Bonus de connexion quotidien — design

Statut : demandé par Marc le 2026-10-29 (« Ajoute un bonus de connexion quotidienne. Je te laisse faire de A à Z. »). Toutes les décisions ci-dessous sont des choix de Claude. Cible : version 1.9.0.

## 1. Intention

Donner à Mathias une raison d'ouvrir l'appli chaque jour, même s'il n'a que trente secondes. Le geste doit être un petit plaisir, pas une corvée. Les xu gagnés alimentent les trois tirages.

Réussite : Mathias ouvre l'appli, voit son enveloppe, l'ouvre, et a envie de revenir le lendemain pour ne pas casser la suite.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Un « lì xì du jour » : une enveloppe rouge à ouvrir une fois par jour (jour de Paris, comme le reste de l'appli), qui donne des xu.
- Une suite de 7 jours qui monte en valeur, pour récompenser la régularité.
- Le serveur reste la référence : un bonus ne peut pas être réclamé deux fois le même jour, ni pour des jours passés.

**Non-objectifs**
- Le bonus ne donne pas d'XP, ne compte ni pour la série (flamme), ni pour les badges, ni pour l'énergie. La série reste liée à l'apprentissage.
- Pas de Kim bài, pas d'objet, pas de tirage gratuit.
- Pas de notification push.

**Anti-objectifs**
- Une fenêtre qui bloque l'accès aux leçons ou qui revient à chaque ouverture.
- Un bonus si gros qu'il rend les leçons inutiles pour gagner des xu.
- Un écran qui ressemble à un calendrier de jeu mobile générique (grille de 7 cases, confettis partout).

## 3. Règles

- **Montants, jour 1 à 7 de la suite :** 10, 10, 15, 15, 20, 20, 50 xu, soit 140 xu par semaine complète (environ 3,5 tirages simples). Une leçon donne 10 à 15 xu, donc le bonus ne remplace pas les leçons.
- **Suite :**
  - si le dernier bonus date d'hier, la suite avance d'un jour ;
  - sinon, elle repart au jour 1 ;
  - après le jour 7, elle repart au jour 1.
- **Un seul bonus par jour de Paris.**
- **Événement :** `daily_bonus_claimed`, `ref_id` = le jour de Paris (`AAAA-MM-JJ`), `xp` = 0, payload `{ day, coins }` pour l'affichage. Le serveur ignore le montant du payload et le recalcule.
- **Côté serveur** (`apply_event`), le bonus est crédité si toutes ces conditions sont vraies :
  - `ref_id` est une date égale au jour de l'événement (heure client bornée à `now()`) ;
  - ce jour est aujourd'hui ou hier ;
  - ce jour est postérieur au dernier bonus.
  
  « Hier » est accepté pour qu'un bonus ouvert hors ligne tard le soir passe à la synchronisation du lendemain. Tout le reste ne crédite rien et ne lève jamais d'erreur. Deux nouvelles colonnes dans `user_stats` : `bonus_day date` et `bonus_streak int`.
- **Côté appli :** le portefeuille rejoue la même règle (sans le « hier », qu'il ne peut pas vérifier) et expose `bonusDay` et `bonusStreak`. Comme pour les tirages, la Boutique dépense `min(local, serveur)`. Deux appareils qui ouvrent le même jour ne sont crédités qu'une fois par le serveur.

## 4. Interface

- **Accueil :** tant que le lì xì du jour n'est pas ouvert, une carte en tête de l'accueil, au-dessus des carte duels et révisions : enveloppe rouge, « Ton lì xì du jour t'attend », « Jour N · +X xu ». Toucher ouvre la feuille.
- **Ouverture automatique :** la feuille s'ouvre d'elle-même une fois par jour et par appareil, à la première visite de l'accueil (`localStorage`, avec try/catch). Si on la ferme sans ouvrir l'enveloppe, la carte reste.
- **Feuille :**
  - le héros est l'enveloppe, grande et centrée, en laque rouge avec un sceau doré ;
  - dessous, une frise de 7 petites enveloppes : celles déjà ouvertes sont dorées et barrées d'un trait, celle du jour est mise en avant, la 7ᵉ est plus grande ;
  - un seul bouton principal : « Ouvrir ».
- **Ouverture :**
  - le rabat s'ouvre, le montant monte de l'enveloppe en or (`+15 xu`), et le son `arena.coins` joue ;
  - le solde se met à jour ;
  - le bouton devient « Continuer » et ferme la feuille ;
  - en mouvement réduit : un simple fondu.
- **Textes :** tutoiement, une touche de vietnamien (« Lì xì » en `lang="vi"`, « Chúc may mắn ! »). Tous les textes dans `src/i18n/fr.ts`.

## 5. Déploiement

- Migration `20261029000000_daily_bonus.sql` d'abord :
  - ajoute le type à la contrainte ;
  - ajoute les colonnes ;
  - ajoute `daily_bonus_amount(int)` ;
  - recrée `apply_event` (même corps que la migration gacha, plus la branche bonus).
- Tests pgTAP `08_daily_bonus_test.sql`.
- Une appli 1.8 n'envoie jamais ce type et ne le reçoit jamais, donc rien ne casse.
- Version 1.9.0, entrée de changelog « Le lì xì du jour ».

## 6. Laissé au constructeur

Le dessin exact de l'enveloppe (SVG inline, style des icônes et des estampes), les temps d'animation tirés des jetons, et le découpage des tests.
