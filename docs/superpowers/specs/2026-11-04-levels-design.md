# Niveaux (2.3.0)

> Demande de Marc, 2026-11-04 : « Ajoute des niveaux supplémentaires pour le vietnamien et le tagalog. Je te laisse choisir comment on peut passer d'un niveau à l'autre. Et bien sûr il faut battre le boss du niveau précédent avant de pouvoir entamer le nouveau niveau. » Les choix ci-dessous sont ceux de Claude.

## Règle

- Un niveau est une suite de leçons et de dialogues fermée par un boss.
- **Battre le boss** (score de 70 ou plus, c'est-à-dire gagner le combat) ouvre le niveau suivant. Rien d'autre : ni XP, ni xu, ni étoiles.
- Le niveau suivant suit sur le même chemin, sous une bannière. Il reste visible, verrouillé, pour donner envie.
- Après la victoire, l'écran de résultat annonce « Niveau 2 ouvert ! ».

## Contenu de la 2.3.0

| Langue | Niveau 2 | Leçons | Boss |
|---|---|---|---|
| Vietnamien | La vie de tous les jours | l11 à l16, d11 à d16 : maison, santé, goûts, vêtements, téléphone, repas de famille | Sơn Tinh, le rival de Thủy Tinh |
| Tagalog | Voyager plus loin | tl_l09 à tl_l14, tl_d09 à tl_d14 : hôtel, pharmacie, heure, bus et bateau, achats, amis | Le Tikbalang, qui égare les voyageurs |

Les questions du boss de niveau 2 sont les exercices des leçons de ce niveau (`level: 2` dans `exam.json`). Mêmes règles de combat : 15 gouttes, 5 vies.

## Architecture

- `tree.json` porte l'ordre : le premier cours d'un niveau `requires` le boss d'avant. Le nième nœud `boss` ferme le niveau n. `levels` donne le titre des bannières.
- `LANGUAGES[…].bossIds` liste les boss d'une langue, niveau 1 en premier.
- Ajouter un niveau : le contenu, les nœuds de l'arbre, une entrée dans `bossIds`, et une migration qui ajoute le boss à `exam_attempts.boss_id` et à `boss_unlocked`.
- Le niveau 1 ne change pas : événements `exam` / `tl_exam`, `exam_best`, `exam_bests.tl`, certificat, succès.
- Au-dessus du niveau 1 : l'événement `exam_finished` a pour `ref_id` l'identifiant du boss, le score va dans `exam_bests` sous cet identifiant.

## Serveur

- `start_exam_attempt(p_language, p_boss)` : 3 essais par jour et par boss, refus `boss_locked` tant que le boss d'avant n'est pas battu.
- `apply_event` : XP et xu se calculent sur le meilleur score du boss de l'essai. Chaque boss paie sa première victoire.

## Écrans

- Accueil : les boss au bout de leur niveau, la bannière entre les deux. Un cours verrouillé par un boss l'explique au toucher.
- `/exam` reste le boss du niveau 1, `/exam/<boss>` les suivants.
- « Moi » et le profil public montrent le boss le plus haut battu de chaque langue. Le certificat dit le niveau.

## Laissé de côté

- Pas de succès propres au niveau 2.
- Les duels piochent dans toutes les leçons communes, tous niveaux confondus.
