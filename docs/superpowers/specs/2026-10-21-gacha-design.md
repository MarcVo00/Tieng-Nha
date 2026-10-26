# Gacha « Xin xăm » par thème — conception

> Statut : **validé** par Marc le 2026-10-21 (taux, garanties et prix acceptés ; panoplie complète : on continue de tirer, les doublons rendent des xu). Livraison visée : semaine du 26 octobre (avant l'anniversaire du 29 si possible, sinon juste après).
> Les points marqués *(appel du concepteur)* sont des choix de Claude, à corriger librement.
> Complète la [spec Héros et cosmétiques](2026-10-18-hero-cosmetics-design.md) et la [spec Duels et arène](2026-10-19-duels-arena-design.md).

## 1. Intention

Dans la **boutique classique** (xu), les cosmétiques ne s'achètent plus directement : on **tire** dans un gacha. Le plaisir vient de la surprise, de la rareté et de l'envie de compléter une panoplie.

Décisions de Marc :
- Gacha **par thème** : un gacha par univers (« Légendes sombres », puis les suivants) qui contient tout le thème — personnages, armes, couvre-chefs, habits, auras.
- Un **système de rareté**.
- Uniquement la **boutique classique** (xu). La **boutique d'arène** (Kim bài) reste en achat direct. Les **cadres et animations** restent des récompenses de succès. Les **consommables** (recharge d'énergie, gel de série) restent en achat direct.
- Une **animation de tirage** à thème.

**Anti-buts :** un gacha frustrant (doublons à l'infini, aucun espoir de légendaire) ; un tirage qu'on peut tricher ; des xu perdus ; une animation lente qu'on ne peut pas passer ; casser les objets déjà achetés.

## 2. L'animation : « Xin xăm », les bâtonnets de la pagode

À la pagode, on secoue un tube de bambou (ống xăm) rempli de bâtonnets numérotés jusqu'à ce qu'un bâtonnet tombe ; il renvoie à un papier (quẻ) qui donne la réponse. C'est notre tirage.

Déroulé (style estampe Đông Hồ, uniquement `transform`/`opacity`, durées du catalogue `motion.ts`) :
1. **Le tube** : un ống xăm laqué au centre d'un autel stylisé (encens fixe, nuages en motif). « Secoue ! » : on maintient le doigt (ou on touche une fois) → le tube tremble en rythme (rotation ±6°), les bâtonnets s'entrechoquent.
2. **La chute** : un bâtonnet glisse hors du tube et tombe sur l'autel. **La couleur de son extrémité annonce la rareté** avant de voir l'objet : bois (commun), jade (rare), laque vermillon (épique), **or** (légendaire).
3. **Le quẻ** : on touche le bâtonnet → il se déroule en un papier điệp (petit rouleau) qui révèle l'objet **porté par ton héros** (aperçu `Character`), son nom, sa rareté (sceau) et « Nouveau ! » ou « Déjà obtenu → +N xu ».
4. **Légendaire** : avant le déroulé, un temps d'arrêt plus long, des rayons dorés statiques derrière le bâtonnet (SVG fixe, opacité animée) et le sceau or ; confettis existants une seule fois.
5. **Tirage ×10** : dix bâtonnets tombent en éventail (décalés), l'utilisateur les touche un par un ou « Tout révéler » ; récapitulatif final en grille (nouveaux d'abord, par rareté).
- Bouton **« Passer »** toujours visible ; `prefers-reduced-motion` → résultat direct (récapitulatif) ; budgets du design system (≤ 8 éléments animés, ≤ 12 particules par SVG, aucune boucle infinie).

## 3. Rareté

| Rareté | Couleur du bâtonnet / sceau | Probabilité *(appel du concepteur)* | Doublon rendu en xu *(appel du concepteur)* |
|---|---|---|---|
| Commun | bois clair | 60 % | 8 xu |
| Rare | jade | 28 % | 20 xu |
| Épique | laque vermillon | 10 % | 50 xu |
| Légendaire | or | 2 % | 120 xu |

- Les **probabilités sont affichées** dans le gacha (bouton « Taux »), par honnêteté.
- **Doublon** = objet déjà dans l'inventaire, quelle qu'en soit l'origine (achat passé ou tirage) : remboursé selon sa rareté. Les personnages sont dans l'inventaire comme les autres cosmétiques.
- **Garanties (pity)** *(appel du concepteur)* :
  - **Tirage ×10** : au moins **un Rare ou mieux** garanti.
  - Le compteur avance **à chaque objet tiré** (un ×10 = 10). Dans un ×10, si les 9 premiers sont communs, le 10ᵉ est forcé au moins Rare.
  - **Légendaire garanti** au plus tard au **40ᵉ tirage** sans légendaire dans ce thème (compteur par joueur et par thème, remis à zéro à chaque légendaire, affiché : « Légendaire garanti dans 23 tirages »).
- **Doublons** : convertis automatiquement en xu (table ci-dessus).
- **Panoplie complète** (décision de Marc) : le tirage reste possible ; comme tout est déjà possédé, chaque objet tiré est un doublon et rend des xu. La bannière affiche « Panoplie complète ! » et rappelle que les tirages ne donnent plus que des xu.

- **Hasard et tests** *(appel du concepteur)* : le serveur tire avec `random()` ; les règles (taux, garanties, doublons) sont écrites pour recevoir une **liste de tirages** injectée, côté SQL comme côté TS, ce qui permet de tester exactement les mêmes cas des deux côtés (pas de reproduction de la même suite aléatoire).
- **Animation = décor** : « Passer » et « Tout révéler » ne changent rien : les résultats sont fixés dès la réponse du serveur.

## 4. Prix *(appel du concepteur)*

- **1 tirage : 40 xu** · **10 tirages : 360 xu** (1 gratuit).
- Repère : une leçon rapporte ~10–15 xu → un tirage ≈ 3 leçons ; un ×10 ≈ une semaine régulière. Le doublon rendu limite la frustration.
- Les prix sont des réglages dans le catalogue (testés par parité serveur/appli).

## 5. Contenu des thèmes

Chaque objet cosmétique du xu-shop reçoit `rarity` et `theme`. Les personnages entrent dans les thèmes.

**Légendes sombres (thème de lancement)** — cible **12 objets** :

| Type | Objets existants (rareté proposée) | Nouveaux à dessiner |
|---|---|---|
| Personnages | La lame errante (épique), La gardienne des talismans (légendaire) | — |
| Armes (accessory) | Thuận Thiên (épique) | 1 commune (ex. lance de bambou), 1 rare |
| Couvre-chefs (hat) | Couronne des marées (rare) | 1 commune, 1 rare |
| Habits (outfit) | Armure de Sơn Tinh (épique) | 1 commune |
| Auras (aura) | Vagues sombres (rare) | 1 commune (ex. brume) |

→ 6 existants + **6 nouveaux** (art, Đông Hồ, compatibles avec les 3 personnages). Répartition visée : 5 communs, 4 rares, 2 épiques, 1 légendaire *(ajustable une fois les dessins faits)*.

- Au lancement, le seul légendaire du thème est La gardienne des talismans (un doublon légendaire rend 120 xu) : c'est voulu.
- **Si les 6 nouveaux dessins ne sont pas prêts** : on lance avec les 6 objets existants (2 communs → les plus simples deviennent communs : à rééquilibrer en 2 communs / 2 rares / 1 épique / 1 légendaire) et on ajoute les autres dans une version suivante.

Plus tard : un nouveau thème = une nouvelle bannière (ex. « Fête du Têt », « Lac de l'Épée »), avec ses ~12 objets.

## 6. Ce qui change dans la boutique classique

- Section **Consommables** inchangée (achat direct).
- Section **Gacha** : une **bannière par thème** (illustration, « 1 tirage — 40 xu », « 10 tirages — 360 xu », « Taux », compteur de garantie, progression « 7/12 obtenus »), et un aperçu de la panoplie (obtenus en couleur, manquants en silhouette).
- Plus de bouton « Acheter » sur les cosmétiques. L'**essayage** reste possible sur les objets possédés (penderie) et sur les objets du thème depuis l'aperçu de panoplie (sans achat).
- **Objets déjà achetés** : gardés, rien ne change. Aucun remboursement nécessaire.

## 7. Serveur (Supabase) — tirage infalsifiable

Le hasard est tiré **côté serveur** (pas de triche par le client) ; le tirage demande donc d'être **en ligne**.

- Catalogue `shop_item` : ajout de `rarity` (`common|rare|epic|legendary|null`) ; les cosmétiques du xu-shop passent `price = null` (plus d'achat direct ; le test de parité suit). Nouvelle fonction `gacha_banner(theme)` : coût 1×/10×, taux, seuil de garantie.
- Table `gacha_pulls` : `id`, `user_id`, `theme`, `count`, `cost`, `results jsonb` (`[{ itemId, rarity, duplicate, refund }]`), `created_at`, `claimed bool`.
- `user_stats` : `gacha_pity jsonb` (compteur par thème).
- RPC `gacha_pull(p_theme, p_count)` (security definer, `auth.uid()`, jamais de `raise` métier → `{ ok:false, error }`) : vérifie le solde **serveur** ≥ coût, tire selon les taux + garanties, débite, crédite les doublons, ajoute les nouveaux objets à l'inventaire, enregistre le tirage, renvoie les résultats. Refus : `not_enough`, `unknown_theme`, `bad_count`.
- **Journal d'événements (ADR 0004)** : comme pour les duels, l'appli ajoute ensuite un événement **`gacha_pulled`** (`refId` = id du tirage, `payload` = coût, objets, remboursements) pour que son portefeuille local reflète le tirage ; le serveur l'ignore (déjà appliqué) sauf pour marquer `claimed`. Un tirage n'est **compté qu'une fois** côté appli (par `refId`).
- **Reprise après coupure** *(appel du concepteur)* : l'appli génère un identifiant de tirage (`pullId`, uuid) et l'envoie à `gacha_pull` ; la RPC est **idempotente** sur cet id (un second appel renvoie les mêmes résultats sans re-débiter). Au démarrage et au retour du réseau, l'appli liste les tirages **non encaissés** (`list_gacha_pulls()` → ceux où `claimed = false`), ajoute leurs événements `gacha_pulled` et affiche un récapitulatif « Tirage récupéré ». Aucun xu n'est jamais perdu.
- **Serveur autoritaire** : `gacha_pull` écrit directement `coins`, `inventory` et `gacha_pity` dans `user_stats` (comme les achats en Kim bài) ; le trigger `apply_event` ne fait, pour `gacha_pulled`, que passer `claimed` à vrai (jamais de double application). Le portefeuille de l'appli rejoue `gacha_pulled` : −coût, +remboursements, +objets nouveaux.
- **Catalogue** *(appel du concepteur)* : on garde `shop_item` et on lui ajoute `rarity` ; un objet est « du gacha » s'il a un `theme` du xu-shop, une `rarity` et `price = null` (donc aucun achat direct possible, même par un événement forgé). Le test de parité couvre `rarity`.
- **Solde** : avant de tirer, l'appli **synchronise** ses événements en attente ; le tirage n'est permis que si `min(solde local, solde serveur) ≥ coût` (même règle que l'arène) ; hors ligne → « Connecte-toi pour tirer ».

## 8. Appli

- Port `GachaGateway` (`banners`, `pull`) + adaptateur Supabase + faux (mode démo : tirages simulés avec les mêmes règles, RNG injectable).
- Service pur : règles de rareté/garantie/doublons **testées contre les mêmes cas que pgTAP** (avec un RNG déterministe pour les tests).
- Écrans : bannières dans la boutique, scène « Xin xăm » (§2), récapitulatif ×10, « Taux », panoplie.
- Nouveautés : entrée de version.

## 9. Tests et Definition of Done

- pgTAP : taux (distribution sur N tirages avec graine), garanties (×10 rare+, légendaire au 40ᵉ), doublons → xu, panoplie complète (tout en xu), `not_enough`, inventaire, RLS.
- Unitaires : règles, portefeuille (`gacha_pulled` une seule fois), écrans (mouvement réduit, Passer, ×10 Tout révéler).
- e2e (faux) : tirer ×1 puis ×10, voir les révélations, l'objet nouveau dans la penderie, le solde.
- Dessins : planche des 6 nouveaux objets sur les 3 personnages ; bâtonnets/tube/autel lisibles en clair/sombre.
- Perf : trace 4× CPU sans tâche longue pendant l'animation.

## 10. Décisions de Marc (2026-10-21)

- Taux 60/28/10/2, légendaire garanti au 40ᵉ tirage, au moins un rare par ×10 : validés.
- Prix 40 xu / 360 xu les dix : validés.
- Panoplie complète : on peut continuer à tirer ; les doublons rendent des xu.
