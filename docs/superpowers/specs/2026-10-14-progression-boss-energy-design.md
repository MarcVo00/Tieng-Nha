# Progression V2 — Arbre de compétences, boss, énergie, pièces

> Statut : **design validé** par Marc le 2026-10-14 (brainstorming). Implémentation **après** la correction de l'oral (reconnaissance vocale), dans l'ordre du §8.
> Complète la [spec V1](2026-10-09-vietlearn-design.md) ; en cas de conflit, ce document l'emporte pour les sujets qu'il couvre.
> Langue des docs : français. Langue du code : anglais.

## 0. Objectifs et périmètre

Rendre la progression plus ludique et plus durable :

1. **Arbre de compétences** : un tronc commun (les bases), puis des branches que l'apprenant choisit.
2. **Examen en « boss »** : un combat à points de vie (PV) au lieu d'un questionnaire noté.
3. **Énergie** : rythmer l'apprentissage pour que l'apprenant ne se lasse pas.
4. **Récompenses** : une monnaie (« xu ») et une petite boutique.

### Calendrier (décision du 2026-10-14)
| Pour le 2026-11-09 | Après |
|---|---|
| Boss final (Thủy Tinh) | Branches de l'arbre (nouveau contenu, chacune avec son boss légendaire) |
| Énergie | Personnage personnalisable acheté avec les xu |
| Xu + boutique (recharge, gel de série, cadres d'avatar) | Autres boss (légendes et figures historiques du Vietnam) |
| Fondations de l'arbre (données + déverrouillage générique), affichage linéaire inchangé | Affichage en arbre avec choix de branche |

### Hors périmètre de ce document
Coffres surprises, achats réels, notifications, IA. Rien de payant (budget 0 €).

## 1. Principe technique

Tout dérive du **journal d'événements** (ADR 0004), comme l'XP et la série aujourd'hui :
- l'appli calcule énergie, solde de xu, inventaire et équipement **à partir des événements locaux** (hors ligne compris) ;
- le trigger Supabase `apply_event` recalcule **le solde de xu, l'inventaire et l'équipement** côté serveur (source de vérité pour le classement) ;
- l'**énergie n'est pas vérifiée par le serveur** : cercle familial, la triche n'en vaut pas la complexité.

Règle anti-blocage (déjà appliquée à l'examen) : **un trigger ne lève jamais d'exception** pour une règle métier ; un événement invalide (achat sans solde suffisant…) est enregistré mais **sans effet**. L'appli applique exactement la même règle, dans le même ordre, pour que l'affichage local et le serveur concordent.

Chaque logique est un **module pur et testé** dans `src/services/` : `tree.ts`, `bossFight.ts`, `energy.ts`, `wallet.ts`.

## 2. Arbre de compétences

### 2.1 Données — `src/content/tree.json`
```jsonc
{
  "contentVersion": 1,
  "nodes": [
    { "id": "l01", "kind": "lesson", "requires": [] },
    { "id": "l02", "kind": "lesson", "requires": ["l01"] },
    // … l03 → l10, chacun requiert le précédent
    { "id": "boss_thuy_tinh", "kind": "boss", "requires": ["l10"], "branch": "trunk" }
  ]
}
```
- `kind` : `"lesson" | "boss"` (extensible : `"dialogue"`, `"checkpoint"`).
- `requires` : liste d'ids de nœuds ; un nœud est **déverrouillé** quand tous ses prérequis sont faits (`lesson_completed`, ou boss vaincu).
- `branch` : `"trunk"` pour le tronc ; plus tard un id de branche (`"pho_va_cafe"`, `"tet"`, …).
- Validé par Zod et par `validate-content` : ids uniques, références existantes, graphe sans cycle, chaque leçon de `lessons/` présente.

### 2.2 Déverrouillage — `services/tree.ts`
- `nodeState(node, done) → "locked" | "available" | "done"`.
- Remplace la règle codée en dur `EXAM_UNLOCK_LESSONS = 10` (`features/home/pathLayout.ts`) : le boss est disponible quand `l10` est faite.

### 2.3 Affichage
Novembre : le chemin de l'accueil reste **linéaire et identique** (l01 → l10 → boss). Après : les branches s'affichent en éventail après le boss final ; l'apprenant choisit laquelle suivre (plusieurs peuvent être commencées).

### 2.4 Branches futures (idées, à valider avec le contenu)
Chaque branche : 3 à 5 leçons + 1 dialogue + **1 boss légendaire**. Pistes : « Phở & cà phê » (manger dehors), « Tết » (fêtes et famille élargie), « Voyage » (transports, hôtel), « Au marché flottant ».

## 3. Le boss (examen final)

### 3.1 Fiches de boss — `src/content/bosses.json`
```jsonc
{
  "contentVersion": 1,
  "bosses": [{
    "id": "boss_thuy_tinh",
    "name": "Thủy Tinh",
    "title": "Le dieu des eaux",
    "legend": "Thủy Tinh voulait épouser la princesse Mỵ Nương. Battu par Sơn Tinh, le génie des montagnes, il fait monter les eaux chaque année. Repousse-les avec ton vietnamien !",
    "illustration": "boss_thuy_tinh",
    "hp": 15,
    "playerLives": 5,
    "pool": "exam"
  }]
}
```
- `pool` : banque de questions (`"exam"` = `exam.json` actuel). Les futurs boss auront leur propre banque, construite sur le vocabulaire de leur branche.
- `illustration` : clé d'une illustration SVG (design system « Sơn mài ») ; en attendant, un emblème simple.
- Boss futurs (légendes et histoire) : Thánh Gióng, Sơn Tinh, la tortue d'or Kim Quy, les sœurs Trưng, Trần Hưng Đạo… Ajouter un boss = ajouter une fiche + une banque de questions.

### 3.2 Règles du combat — `services/bossFight.ts`
- État : `{ bossHp, lives, asked: questionId[], answers: { questionId, correct }[] }`.
- Tirage **une question à la fois**, sans répétition, en tournant entre les sections (listening → translation → tones → speaking → …) pour garder l'équilibre. Sans reconnaissance vocale, les questions orales sont remplacées par des listening (comme aujourd'hui, `noSpeaking`).
- Bonne réponse : **−1 PV** au boss. Mauvaise réponse : **−1 vie** au joueur. Une question orale « passée » compte comme une erreur ; une auto-évaluation « j'ai bien dit » compte comme juste.
- **Victoire** : PV du boss à 0. **Défaite** : vies à 0. Si la banque s'épuise avant (ne devrait pas arriver : 15 + 4 < 60), le combat se termine en défaite.
- Pas de retour en arrière, pas de pause : quitter = abandon (confirmation, comme aujourd'hui).

### 3.3 Score, mention, récompenses
Le score sur 100 reste la valeur stockée (base, badges `exam_passed` ≥ 70 / `exam_excellent` ≥ 90, XP en delta par le trigger, profil) :

| Résultat | Score | Mention |
|---|---|---|
| Victoire, 5 vies | 100 | Excellent |
| Victoire, 4 vies | 92 | Excellent |
| Victoire, 3 vies | 85 | Très bien |
| Victoire, 2 vies | 78 | Réussi |
| Victoire, 1 vie | 70 | Réussi |
| Défaite | `round(60 × dégâts / PV)` (0 à 60) | — |

- Certificat **uniquement en cas de victoire** (le certificat actuel est réutilisé ; la mention vient du tableau).
- Profil : « Thủy Tinh vaincu ✓ (4/5 ❤️) » ou « Pas encore vaincu ».
- **Aucune migration** pour le score : le trigger accepte déjà `payload.score` lié à `payload.attemptId`. Payload ajouté (informatif) : `{ bossId, livesLeft, bossHpLeft, won }`.
- La limite de **3 tentatives par jour** (`start_exam_attempt`) est conservée comme garde-fou ; le coût en énergie (§4) rythme le reste.

### 3.4 Écran
Mode focus (sans barre d'onglets). En haut : le boss (illustration, nom, barre de PV). En bas : les vies (❤️ ×5). Au centre : l'exercice (même `ExerciseHost` en mode `exam`). Animations : secousse du boss sur un coup, flash et cœur qui se brise sur une erreur ; `prefers-reduced-motion` respecté. Fin : écran victoire (confettis, mention, certificat) ou défaite (dégâts infligés, « Réessayer » si énergie et tentatives).

## 4. Énergie ⚡ — `services/energy.ts`

| Paramètre | Valeur |
|---|---|
| Maximum | 5 (plein au départ) |
| Commencer une leçon | −1 |
| Commencer un dialogue | −1 |
| Défier un boss | −3 |
| Terminer une séance de révision | +1 |
| Recharge avec le temps | +1 toutes les 3 h |
| Recharge achetée (boutique) | remet à 5 |

- **Jamais bloqué** : révision, classement, profil, réglages. Refaire une leçon déjà faite coûte aussi 1 ⚡.
- Calcul : `energyAt(events, now)` rejoue les événements dans l'ordre (dépenses, gains, recharges, achats) en ajoutant la recharge temporelle, plafonné à 5. Pur et déterministe → testable.
- Événement nouveau : `session_started` `{ kind: "lesson" | "dialogue" | "boss", refId }` (xp 0). Le gain de révision vient de `review_session_completed` existant ; la recharge achetée vient de `item_purchased`.
- Écran sans énergie : « Plus d'énergie ! Fais une révision (+1 ⚡) ou reviens dans 2 h 14. » + bouton « Réviser » (+ « Recharger (30 xu) » si le solde le permet).
- Affichage : jauge ⚡ dans l'en-tête, à côté de la série et de l'XP.

## 5. Pièces (« xu ») et boutique — `services/wallet.ts`

### 5.1 Gains (calculés aussi par le trigger)
| Événement | xu |
|---|---|
| `lesson_completed` | +10 (+5 si parfaite) |
| `dialogue_completed` | +5 |
| `review_session_completed` | +3 |
| `badge_unlocked` | +10 |
| Boss vaincu (`exam_finished` avec `won`) | +50 la 1re fois, +20 ensuite |

Pas de plafond quotidien (l'énergie limite déjà le rythme). Le trigger ignore toute valeur de xu envoyée par le client et applique ce barème.

### 5.2 Boutique — `src/content/shop.json`
| Id | Article | Type | Slot | Prix |
|---|---|---|---|---|
| `energy_refill` | Recharge d'énergie | consommable (immédiat) | — | 30 |
| `streak_freeze` | Gel de série (2 max en stock) | consommable (automatique) | — | 50 |
| `frame_bronze` | Cadre bronze | cosmétique | `frame` | 40 |
| `frame_jade` | Cadre jade | cosmétique | `frame` | 80 |
| `frame_son_mai` | Cadre laque dorée | cosmétique | `frame` | 150 |

- Le **slot** prépare le personnage personnalisable : plus tard `hat`, `outfit`, `accessory`, `pet`… sans changer le modèle.
- Événements : `item_purchased` `{ itemId }` (le prix vient du catalogue, jamais du client), `item_equipped` `{ slot, itemId | null }`.
- Achat refusé (sans effet) si : solde insuffisant, cosmétique déjà possédé, ou 2 gels déjà en stock.
- **Gel de série** : le jour où la série devrait retomber à 1, un gel en stock est consommé et la série continue. Le trigger enregistre la consommation (champ `streak_freezes`), l'appli rejoue la même règle.
- **Cadre équipé** visible au classement, sur le podium et sur le profil public.

## 6. Données et backend

### 6.1 Migration Supabase (une seule)
- `events.type` : ajouter `session_started`, `item_purchased`, `item_equipped`.
- `user_stats` : `coins int not null default 0`, `inventory text[] not null default '{}'`, `equipped jsonb not null default '{}'`, `streak_freezes int not null default 0`, `boss_wins text[] not null default '{}'`.
- `apply_event` : barème de xu, achats (catalogue en table `shop_items` ou en `case` SQL, prix côté serveur), équipement (seulement un objet possédé), gel de série dans le calcul de la série, `boss_wins`.
- Vue `leaderboard` : ajouter `equipped->>'frame'`.
- Tests pgTAP : barème, achat refusé sans solde, double achat de cosmétique, gel consommé, équipement d'un objet non possédé ignoré.

### 6.2 Côté appli
- `ProgressSnapshot` : ajouter `energy`, `nextEnergyAt`, `coins`, `inventory`, `equipped`, `streakFreezes`, `bossWins`.
- Nouveaux ports : aucun (tout passe par les événements existants et le dépôt de progression).
- Hors ligne : énergie, achats et boss fonctionnent ; synchronisation ensuite. Un achat refusé par le serveur (solde divergent, cas rare) disparaît au prochain rafraîchissement, avec un toast.

## 7. Tests
- Unitaires purs : `tree.ts` (prérequis, cycles), `bossFight.ts` (victoire, défaite, tirage sans répétition, rotation des sections, score du tableau §3.3), `energy.ts` (coûts, recharge 3 h, plafond, révision, recharge achetée), `wallet.ts` (barème, refus, gel de série).
- Composants : écran du boss (PV, vies, fin), écran « plus d'énergie », boutique.
- pgTAP : §6.1.
- E2E : vaincre le boss (fakes), boutique (acheter un cadre et le voir au classement).

## 8. Ordre d'implémentation (après l'oral)
1. **Arbre** : `tree.json`, `services/tree.ts`, remplacement de `EXAM_UNLOCK_LESSONS`.
2. **Boss** : `bosses.json`, `services/bossFight.ts`, écran de combat, résultat et certificat.
3. **Énergie** : événement `session_started`, `services/energy.ts`, jauge, écran sans énergie.
4. **Xu et boutique** : migration, `services/wallet.ts`, boutique, cadres au classement, gel de série.

Chaque étape : plan dans `docs/superpowers/plans/`, TDD, `npm run verify` vert, E2E vert.

## 9. Plus tard (noté, non conçu)
- **Personnage personnalisable** : avatar composé de calques (base, tenue, chapeau, accessoire) achetés avec les xu ; remplace l'emoji d'avatar.
- **Boss légendaires et historiques** par branche, avec illustration et récit.
- **Affichage en arbre** avec choix de branche après le boss final.
