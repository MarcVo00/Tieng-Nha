# Énergie plus rapide et succès qui rapportent — design

Statut : demandé par Marc le 2026-10-29 (« Corrige l'énergie, 3h c'est trop long, peut-être toutes les 10 minutes et il faudrait plus de succès qui rapporte des xu. »). Le chiffre de 10 minutes vient de Marc ; tout le reste est un choix de Claude. Cible : version 1.10.0.

## 1. Énergie

- La recharge passe de +1 ⚡ toutes les 3 h à **+1 ⚡ toutes les 10 minutes**. Elle est toujours comptée à partir du moment où la jauge descend sous le maximum.
- Le reste ne change pas :
  - maximum 5 ;
  - une leçon ou un dialogue coûte 1, le boss coûte 3 ;
  - une révision rend 1 ;
  - la recharge achetée (30 xu) remplit la jauge.
- L'énergie n'est calculée que dans l'appli (aucune règle serveur), donc il n'y a pas de migration. Le texte d'explication change.
- Ce chiffre remplace celui de la spec Progression V2 (§ énergie, « +1 toutes les 3 h »).

## 2. Succès qui rapportent des xu

**Avant :** chaque succès rapportait 10 xu côté serveur, quel que soit l'identifiant, même inconnu.

**Après :** chaque succès porte son propre montant (`coins` dans `badges.json`), de 20 à 200 xu selon la difficulté. Repères :
- un tirage simple coûte 40 xu ;
- un tirage de 10 coûte 360 xu.

### 2.1 Montants des 13 succès existants

| Succès | xu |
|---|---|
| Premier pas | 20 |
| Bon élève | 40 |
| Toutes les leçons | 100 |
| Lancé·e | 30 |
| Une semaine | 60 |
| Inarrêtable | 200 |
| Sans faute | 20 |
| Main de maître | 60 |
| Mémoire d'éléphant | 50 |
| Première conversation | 20 |
| Bavard·e | 100 |
| Vainqueur de Thủy Tinh | 100 |
| Excellence | 150 |

### 2.2 Onze nouveaux succès

Ils utilisent les règles existantes, plus deux règles nouvelles calculées depuis le profil de progression : `xp_total` et `active_days` (jours actifs au total, pas forcément de suite).

| id | Titre | Condition | xu |
|---|---|---|---|
| `three_lessons` | Sur la lancée | 3 leçons | 30 |
| `five_dialogues` | Beau parleur | 5 dialogues | 50 |
| `perfect_10` | Pinceau d'or | 10 leçons sans faute | 120 |
| `vocab_25` | Ça rentre | 25 mots révisés | 20 |
| `vocab_250` | Dictionnaire vivant | 250 mots révisés | 100 |
| `streak_14` | Deux semaines | 14 jours d'affilée | 100 |
| `xp_500` | Sur la voie | 500 XP | 40 |
| `xp_1500` | Érudit·e | 1 500 XP | 100 |
| `xp_3000` | Lettré·e | 3 000 XP | 200 |
| `days_10` | Fidèle au poste | 10 jours actifs | 60 |
| `days_30` | Pilier de la maison | 30 jours actifs | 150 |

### 2.3 Serveur

Migration `20261030000000_badge_rewards.sql` :
- **`badge_coins(id)`** : renvoie le montant de chaque succès, et 0 pour un identifiant inconnu, ce qui ferme la porte aux succès inventés.
- **`apply_event`** : même corps que la migration du bonus quotidien, mais un `badge_unlocked` paie `badge_coins(ref_id)`, toujours une seule fois par succès.
- **Rattrapage, une seule fois :** chaque joueur reçoit la différence (nouveau montant − 10) pour les succès qu'il a déjà. Le même calcul tourne côté appli, qui rejoue le journal avec les nouveaux montants, donc les deux soldes restent égaux.

Le montant de chaque succès est vérifié par un test de parité entre `badges.json` et la migration.

### 2.4 Interface

- La fiche d'un succès (écran Moi) affiche « Rapporte N xu », ou « N xu gagnés » s'il est débloqué.
- Les écrans de fin (leçon, dialogue, révision, boss) affichent déjà les xu gagnés : les montants y apparaissent sans autre changement.

## 3. Déploiement

- La migration part d'abord, l'appli ensuite.
- **Une appli 1.9 encore ouverte :**
  - elle compte 10 xu par succès en local, alors que le serveur est désormais plus généreux ;
  - elle ne connaît pas les nouveaux succès et ne les débloque donc pas.
  
  Rien ne casse : la mise à jour automatique arrive au lancement suivant.
- Version 1.10.0, entrée de changelog « Plus d'énergie, plus de succès ».
