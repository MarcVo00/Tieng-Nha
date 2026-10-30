# Aide quand on bloque sur une leçon — design

Statut : proposé par Claude le 2026-10-30, en réponse à Marc (« Qu'est-ce qu'on pourrait ajouter lorsqu'une personne est bloquée sur un cours et l'a déjà tenté 3-5 fois ? »). Marc a validé : « C'est parfait comme ça. » Cette version contient les deux étapes recommandées et les encouragements. Les indices en leçon (50/50, premier mot placé) et le succès caché « Persévérance » viendront plus tard. Cible : version 1.11.0.

## 1. Intention

Celui qui perd plusieurs fois la même leçon ne doit ni abandonner ni payer chaque essai en énergie. L'aide cible ce qui bloque vraiment, les mots ratés, et la leçon reste à réussir pour de vrai : on ne la saute pas.

## 2. Règles

- **Un échec** = la leçon perdue faute de cœurs. Il est noté dans le journal local par un événement `lesson_failed`, avec les mots et les exercices ratés pendant la tentative. Cet événement n'est jamais envoyé au serveur, comme `session_started`.
- **Ce qui compte :** seuls les échecs depuis la dernière réussite de cette leçon.
- **Après 2 échecs :** l'écran d'échec montre « Les mots qui te résistent », les 5 mots les plus ratés au maximum. Chacun affiche le vietnamien (`lang="vi"`), la traduction et le son.
- **Après 3 échecs : l'écran d'échec propose en action principale « M'entraîner sur mes erreurs ».** « Réessayer » passe en secondaire.
  - **L'entraînement :**
    - il rejoue les exercices ratés, sans cœurs (on ne peut pas le perdre), et une erreur repasse une fois en fin de file ;
    - il ne coûte pas d'énergie, ne donne ni XP ni xu et ne compte pas comme une leçon terminée ;
    - les réponses alimentent les révisions, comme en leçon.
  - **La récompense : le talisman « Bùa hộ mệnh ».** Une fois l'entraînement fini, il est noté par un événement local `training_done`. La tentative suivante de cette leçon commence alors avec **5 cœurs au lieu de 3** et **ne coûte pas d'énergie**. Le talisman est consommé au démarrage de cette tentative, qu'elle réussisse ou non.
- **Encouragements :** le texte de l'écran d'échec change avec le nombre d'échecs (1, 2, puis 3 et plus).

## 3. Côté technique

- `src/services/struggle.ts` (pur) calcule, depuis le journal, ce qui suit pour une leçon :
  - `failures` ;
  - `missedVocab` (5 au maximum, du plus raté au moins raté) ;
  - `missedExercises` ;
  - `talisman`.
- Une tentative gratuite est un `session_started` avec `free: true`, et l'énergie l'ignore.
- Aucune migration : tout reste dans le journal local, et le serveur ne vérifie pas l'énergie.
