# Duels, Kim bài et boutique d'arène — conception

> Statut : **validé** par Marc le 2026-10-19 (découpage et règles du jeu). Les points marqués *(appel du concepteur)* sont des décisions de Claude prises en autonomie, sur mandat de Marc.
> Complète la [spec Héros et cosmétiques](2026-10-18-hero-cosmetics-design.md) (§8 « Plus tard : les duels ») et respecte l'[ADR 0004 — journal d'événements](../../adr/0004-event-log-as-source-of-truth.md).
> Échéance : l'anniversaire de Mathias, le **2026-10-29**.

## 1. Intention

Mathias et Marc (et le reste du groupe) peuvent **s'affronter** sur ce qu'ils ont appris tous les deux. Le duel est l'occasion de voir son héros équipé **se battre** contre celui de l'autre, avec un vrai enjeu : une monnaie qu'on ne gagne **qu'en duel** et une **boutique d'arène** aux cosmétiques martiaux vietnamiens.

Décisions de Marc :
- Duel **en différé** : chacun joue quand il veut ; le combat est **rejoué** à la fin, les deux héros se tapent dessus.
- **Deux manches** : **1. QCM** où la **vitesse** compte ; **2. oral**.
- Les duels se **débloquent** en terminant la **première leçon** et le **premier dialogue** ; sinon un message l'explique (« Tu n'as pas encore débloqué les duels… »).
- Une **2ᵉ monnaie**, gagnée **uniquement** en duel, et une **boutique d'arène** aux cosmétiques « gladiateurs » version vietnamienne (arts martiaux de Tây Sơn / Bình Định, lutte de village *hội vật*).
- Pour le 29 : le duel complet + la monnaie + une petite boutique de **3 objets**.

**Anti-buts :** un duel qui se règle à la chance ou à la lenteur du micro ; un duel qu'on peut « espionner » (voir le score de l'autre avant de jouer) ; perdre des xu ; un héros qui ne s'affiche pas.

**Hors périmètre :** duel en direct ; classement ELO ; notifications push ; duels entre groupes.

## 2. Déroulé pour le joueur

1. **Défier.** Depuis le profil public d'un membre du groupe (bouton « Défier »), ou depuis l'écran **Duels**. Possible seulement si les deux ont débloqué les duels et ont **au moins une leçon en commun** (sinon message clair). Un seul duel ouvert à la fois **par paire** de joueurs. *(appel du concepteur)* Au plus **5 défis lancés par jour** et par joueur.
2. **Le défi est créé en ligne** avec ses questions figées (§3). Le lanceur peut jouer tout de suite ; l'adversaire voit le défi à sa prochaine ouverture : bannière sur l'accueil « ⚔️ Duel en attente contre X » et compteur sur l'entrée **Duels**.
3. **Jouer** (chacun de son côté, une seule fois) : manche 1 puis manche 2, sans feedback de correction entre les questions (pour ne pas casser le rythme) — un retour bref « touché / raté » suffit. Hors ligne possible une fois le défi téléchargé ; l'envoi du résultat se fait dès que le réseau revient.
4. **Attendre** : tant que l'autre n'a pas joué, l'écran Duels montre « En attente de X ». Le score de l'autre n'est **jamais** visible avant d'avoir joué soi-même.
5. **Résultat** : quand les deux ont joué (ou à l'expiration), le duel est **réglé** ; chacun voit le **combat rejoué** (§5), le vainqueur, et ses **Kim bài** gagnés.
6. **Expiration** *(appel du concepteur)* : un défi non joué par l'un des deux au bout de **72 h** est réglé : celui qui a joué gagne **par forfait** (3 Kim bài ; l'absent 0) ; si personne n'a joué, le duel est **annulé** sans récompense. `create_duel` et `list_duels` règlent d'abord les duels expirés (un duel périmé ne bloque jamais un nouveau défi).
7. **Micro obligatoire** (décision de Marc : « passer le premier oral ») : défier ou jouer un duel exige la **reconnaissance vocale** sur l'appareil. Sans elle (navigateur non compatible, micro refusé), l'écran explique : « Les duels se jouent aussi à l'oral : ouvre l'appli dans Chrome et autorise le micro. » Si le micro est perdu **pendant** la manche 2, les questions orales restantes comptent comme ratées.

## 3. Questions

- Tirées des **leçons terminées par les deux** (intersection des `lessons_done` du serveur au moment du défi).
- **Manche 1 — QCM, 8 questions** : exercices de type `translate_choose`, `listen_choose`, `tone_pick` (types à choix ; `word_order` exclu car sa durée dépend de la longueur de la phrase).
- **Manche 2 — oral, 3 questions** : exercices `speak` des mêmes leçons, validés par la reconnaissance vocale existante (`saidExactly`, validation anticipée incluse).
- S'il n'y a pas assez d'exercices dans l'intersection, on complète par ce qu'il y a (au moins **4** QCM et **1** oral, sinon le défi est refusé avec un message « Pas assez de leçons en commun »).
- Les questions sont **choisies par le client du lanceur** (tirage aléatoire) et **enregistrées dans le duel** comme références immuables `{ lessonId, exerciseId }` ; le serveur vérifie que chaque `lessonId` est dans l'intersection. Les deux joueurs reçoivent **les mêmes questions dans le même ordre** ; l'ordre des réponses à l'écran est mélangé avec la même graine pour les deux.
- Un exercice introuvable chez un joueur (contenu supprimé) compte comme **raté** pour lui. *(appel du concepteur)*
- Le serveur ne connaît pas le contenu (JSON côté client) : il vérifie les `lessonId` et la forme des références ; les types d'exercices sont garantis par le client (application familiale). *(appel du concepteur)*

## 4. Règles du combat

Chaque joueur a **100 PV**. Ses **coups** retirent des PV à l'adversaire.

| Action | Dégâts |
|---|---|
| Bonne réponse manche 1 | **10** |
| Bonne réponse manche 1 en **moins de 3 s** (chrono : de l'affichage de la question à la réponse) → **coup critique** | **15** |
| Bonne réponse manche 2 (oral reconnu) | **15** |
| Mauvaise réponse / exercice raté | 0 |

- Maximum : 8 × 15 + 3 × 15 = **165** ; les PV restants affichés sont bornés à 0 (K.-O.).
- **Vainqueur** : le plus de **dégâts infligés** ; à égalité, le plus petit **temps total** de la manche 1 ; à égalité encore : **match nul**.
- **Limite de temps** *(appel du concepteur)* : **20 s** par question QCM et **30 s** par question orale ; au-delà, la question compte comme **ratée** (barre de temps visible). Le chrono continue si l'appli passe en arrière-plan (chercher la réponse ailleurs coûte le critique, voire la question). Si l'appli est fermée en cours de duel, à la reprise la question qui était affichée compte comme **ratée** et le duel reprend à la suivante.
- Le temps et le résultat de chaque question sont mesurés **sur le téléphone** et envoyés à la fin ; le serveur **recalcule** les dégâts et le vainqueur à partir de ces réponses (jamais à partir d'un total envoyé). On fait confiance au client pour la justesse des réponses (application familiale), mais le serveur borne les temps (≥ 300 ms, sinon la réponse compte sans critique).

## 5. Le combat rejoué (écran de résultat)

- Les deux héros, **équipés** (personnage, cosmétiques, cadre), face à face sur leurs médaillons papier, une barre de PV au-dessus de chacun. Le héros de l'adversaire vient de `PublicProfile.look`.
- Le combat est rejoué **question par question**, en alternance (Q1 du joueur A, Q1 du joueur B, …), manche 1 puis bandeau « Manche 2 — oral » puis manche 2 :
  - **coup** : le médaillon de l'attaquant **bondit** vers l'autre, l'autre **recule et clignote**, sa barre baisse ;
  - **critique** : idem, plus fort, avec un **éclair doré** et la mention « Critique ! » ;
  - **raté** : l'attaquant **trébuche** (petite rotation) ;
  - fin : le vainqueur porte le dernier coup, le **perdant s'incline** (comme les boss vaincus) ; nul : les deux se saluent.
- **Forfait** : seul le joueur présent attaque ; le médaillon de l'absent est grisé avec « Forfait » ; bilan « Victoire par forfait ».
- Uniquement `transform` et `opacity`, durées de `src/ui/motion.ts`. Bouton **« Passer »** pour aller au bilan ; `prefers-reduced-motion` → bilan directement.
- **Bilan** : vainqueur, dégâts de chacun, critiques, temps, Kim bài gagnés, bouton « Revanche » (nouveau défi, mêmes règles) et « Retour aux duels ».

## 6. Kim bài (la monnaie d'arène)

- Nom : **Kim bài** (la médaille d'or remise aux champions). Icône : une médaille dorée ; jamais confondue avec les xu.
- Gains *(appel du concepteur)* : **victoire 3**, **nul 2**, **défaite 1** (on récompense le fait de jouer), **victoire par forfait 3**, duel annulé 0.
- **Uniquement** gagnés en duel ; dépensés **uniquement** dans la boutique d'arène.
- **Journal d'événements** (ADR 0004) : quand un client lit (en ligne, via `list_duels`) un duel **réglé** dont sa récompense n'est pas encore encaissée localement, il ajoute un événement local **`duel_settled`** avec `refId = duelId`, `xp = 0`, `payload = { kimBai }` où `kimBai` est la récompense lue sur le serveur (synchronisé). Les Kim bài n'apparaissent donc qu'après lecture du règlement serveur. Le portefeuille de l'appli additionne `kimBai` (un seul encaissement par `duelId`). Le serveur, à l'insertion de cet événement, crédite le montant **calculé côté serveur** pour ce joueur dans ce duel, **une seule fois** (le montant du client est ignoré). Les deux soldes concordent sauf client falsifié.
- Affiché dans l'écran Duels, la boutique d'arène et « Moi » (à côté des xu).

## 7. Boutique d'arène

- Écran **Arène** accessible depuis l'écran Duels. Même mécanique que la boutique : essayage sur son héros (sheet existante), achat confirmé dans la sheet puis équipement automatique, objets visibles dans « Ma penderie ».
- Catalogue : les objets ont un champ **`currency`** : `"xu"` (défaut) ou `"kim_bai"`. Prix en Kim bài, achat refusé si solde Kim bài insuffisant. Mêmes règles qu'en boutique sinon (cosmétique déjà possédé, etc.).
- Thème **`arene`** — 3 objets *(appel du concepteur pour les prix)* :

| Id | Slot | Prix | Description (pour le dessin) |
|---|---|---|---|
| `hat_tay_son` | hat | 6 Kim bài | **Bandeau de Tây Sơn** : large bandeau rouge noué sur le front, deux longs pans qui flottent derrière, un petit emblème doré au centre. Laisse voir les cheveux. |
| `acc_con_vo` | accessory | 8 Kim bài | **Bâton de Bình Định** (côn võ) : long bâton en bois sombre tenu à la verticale dans la main droite, bagues dorées aux extrémités. |
| `outfit_hoi_vat` | outfit | 10 Kim bài | **Tenue de lutteur du hội vật** : veste courte sans manches indigo ouverte, large **ceinture de soie rouge** nouée sur le côté avec pans tombants, pantalon serré. Lisible et digne (pas de torse nu). |

- Style : estampe Đông Hồ simplifiée, palette fermée, règles de la direction artistique §2–3 et §7 ; compatibles avec les trois personnages et les autres cosmétiques (mêmes ancrages).

## 8. Données et serveur (Supabase)

Nouvelle migration (et ses tests pgTAP) :
- `public.duels` : `id uuid pk`, `group_id`, `challenger uuid`, `opponent uuid`, `questions jsonb` (`{ round1: [{lessonId, exerciseId}], round2: [...] }`), `seed int`, `created_at`, `expires_at` (= `created_at + 72 h`), `status` (`open` | `settled` | `cancelled`), `winner uuid null`, `settled_at`.
- `public.duel_runs` : `(duel_id, user_id)` pk, `round1 jsonb` (`[{ correct bool, ms int }]`), `round2 jsonb` (`[{ correct bool }]`), `damage int`, `time_ms int`, `submitted_at`, `reward int` (Kim bài, fixé au règlement), `claimed bool` (encaissé par l'événement).
- `user_stats` : colonne `kim_bai int not null default 0`.
- RPC (security definer, `search_path` fixé, `auth.uid()` obligatoire, jamais de `raise` pour une règle métier — elles renvoient un code d'erreur dans le JSON) :
  - `create_duel(p_opponent uuid, p_questions jsonb, p_seed int)` → `{ ok, duelId | error }` ; vérifie : même groupe, pas soi-même, les deux ont `l01` dans `lessons_done` et `d01` dans `dialogues_done`, chaque `lessonId` dans l'intersection, tailles (4–8 / 1–3), pas de duel `open` pour la paire, quota 5/jour.
  - `submit_duel_run(p_duel uuid, p_round1 jsonb, p_round2 jsonb)` → `{ ok | error }` ; participant, duel `open`, pas encore soumis, longueurs = celles du duel ; calcule dégâts et temps (§4) ; si les deux runs existent → **règlement** (vainqueur, `reward` de chacun, `status settled`).
  - `list_duels()` → les duels du joueur (90 derniers jours), **règle d'abord les duels expirés** (§2.6) ; ne renvoie le run de l'adversaire **que si le duel est réglé**.
- Événements : `events_type_check` accepte **`duel_settled`** ; `apply_event` : pour `duel_settled`, si `duel_runs(duelId, user)` existe, est réglé et non `claimed` → `kim_bai += reward`, `claimed = true` ; jamais d'XP.
- Catalogue : `shop_item` renvoie aussi `currency` ; l'achat d'un objet `kim_bai` débite `kim_bai` (refus sans effet si insuffisant). Le test de parité couvre `currency`.
- RLS : `duels` et `duel_runs` en lecture seulement via les RPC (aucune policy de sélection directe) ; écriture uniquement via les RPC.
- La vue `leaderboard` n'expose pas Kim bài *(appel du concepteur — le classement reste celui de l'apprentissage)*.

## 9. Appli

- **Port** `DuelGateway` (`create`, `submitRun`, `list`) + adaptateur Supabase + faux en mémoire (pour les tests et le mode démo).
- **Services purs** : choix des questions (intersection, filtres de types, graine), calcul des dégâts / vainqueur / récompense (identique au serveur, testé contre les mêmes cas que pgTAP), portefeuille : `kimBai` dans `walletAt` (somme des `duel_settled`, dédupliqués), achats `kim_bai`.
- **Écrans** (feature `duels`) : Duels (à jouer / en attente / terminés, entrée Arène, solde Kim bài), course du duel (manche 1, bandeau, manche 2 ; reprise si l'appli est fermée en cours de route — l'état de la course est sauvegardé localement), résultat + combat rejoué, Arène (boutique). Bouton **Défier** sur le profil public ; bannière sur l'accueil ; message de prérequis.
- Le résultat en attente d'envoi est conservé localement et renvoyé automatiquement (au démarrage et au retour du réseau).

## 10. Tests et Definition of Done

- pgTAP : création (chaque refus), soumission (dégâts, critiques bornés, double envoi refusé), règlement (victoire, nul, départage au temps), expiration (forfait, annulation), encaissement unique `duel_settled`, achat en Kim bài, RLS (pas de lecture directe).
- Unitaires : services de duel (mêmes cas que pgTAP), portefeuille Kim bài, sélection des questions.
- Composants : course (chrono, manche 2, reprise), résultat (bilan, passer, mouvement réduit), Duels (listes, prérequis), Arène.
- e2e (faux backend) : défier → jouer → (adversaire simulé) → résultat avec Kim bài → acheter le bandeau en arène → le voir sur le héros.
- Dessins : planche d'aperçu des 3 objets sur les 3 personnages (40 px, sombre, gris).
- `npm run lint && npm run verify && npm run test:e2e` verts ; migration poussée **avant** la fusion.

## 11. Ordre de livraison et priorités

Deux plans : **A. Duels + Kim bài** (migration complète, y compris la colonne `currency` du catalogue et les 3 lignes d'arène ; écrans de duel ; combat rejoué), puis **B. Boutique d'arène** (dessins des 3 objets, écran Arène). Si le temps manque avant le 29, on coupe dans cet ordre : d'abord l'écran Arène (les Kim bài restent gagnés et visibles), jamais le combat rejoué. La migration est poussée par le contrôleur (Claude), sur mandat de Marc.

## 12. Laissé au concepteur

Mise en page exacte (design system, skill `vietlearn-design`), textes d'interface (français, tutoiement), chorégraphie précise des animations dans le catalogue `motion.ts`, détail des dessins dans la direction artistique.
