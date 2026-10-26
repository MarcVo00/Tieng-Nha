# ADR 0012 — Effets sonores synthétisés

- Statut : accepté (2026-10-26)

## Contexte
L'app est muette. La spec « Sons et nouvelle révélation du gacha » (`docs/superpowers/specs/2026-10-26-sound-and-gacha-reveal-design.md` §3–4) demande des sons pour les leçons, les combats, l'arène et le gacha, dans un timbre d'instruments vietnamiens stylisés. Contraintes : budget 0 €, aucune dépendance nouvelle, rien d'ajouté au pré-cache, la voix vietnamienne passe toujours en premier, iOS ne démarre l'audio qu'après un geste, et une absence de Web Audio ne doit rien casser.

## Décision
- **Synthèse Web Audio, sans fichiers.** Chaque son est une « recette » (`src/adapters/audio/recipes.ts`) jouée en direct : bloc de bois (mõ : bruit filtré résonant + sinus bref), cordes pincées façon đàn tranh (Karplus–Strong calculé une fois par note, avec ses glissés nhấn/luyến), clochettes (partiels inharmoniques), gongs (partiels qui s'ouvrent l'un après l'autre, léger glissement vers le grave), souffles (bruit filtré balayé). Les sons des leçons restent courts et doux, car la bonne réponse revient des centaines de fois.
- **Port / adaptateur / fake.** Catalogue fermé des sons dans `src/domain/sound.ts` (`SOUND_CUES`), port `SoundPlayer` (`play`, `stopAll`, `unlock`, `setEnabled`) dans `src/ports/`, adaptateur `WebAudioSoundPlayer`, fake `FakeSoundPlayer` qui enregistre ce qui aurait été joué (`played`, `stopped`). Les composants appellent `useServices().sound`, jamais l'adaptateur. `play` n'émet jamais d'erreur.
- **La voix d'abord.** Le conteneur enveloppe la voix dans `trackSpeaking` (`src/app/speakingTracker.ts`), qui compte les `speak` en cours. Pendant que la voix parle, un son est joué à 20 % de son volume : il reste audible sans jamais couvrir ni couper la voix (Web Audio et l'élément `<audio>` des packs se mélangent).
- **Garde-fous.** Le même son n'est pas rejoué dans les 50 ms ; 6 sons au plus en même temps (le plus ancien s'éteint en fondu) ; `stopAll` éteint tout en 60 ms ; un limiteur doux sur la sortie évite la saturation. Un coup critique (`strong`) joue plus fort, avec une attaque plus sèche.
- **Déverrouillage par geste.** Aucun `AudioContext` n'est créé avant le premier geste. `SoundSync` (monté une fois dans `Root`) appelle `unlock()` sur `pointerdown`, `pointerup`, `touchend`, `click` et `keydown` (sur iPhone, le toucher n'accorde l'audio qu'au relâchement), puis se réarme quand l'app revient au premier plan, car iOS suspend le contexte en arrière-plan. Tant que le contexte ne tourne pas, les sons sont ignorés (ils ne s'empilent pas pour jouer tous ensemble ensuite). Sans Web Audio, l'app reste muette.
- **Mode silencieux de l'iPhone.** Pas de traitement particulier : les effets se comportent comme la voix (choix de la spec), et l'interrupteur « Sons » permet de les couper.
- **Réglage.** `Settings.sound` (défaut : activé), enregistré avec les autres réglages. Les réglages enregistrés avant la 1.7 n'ont pas la clé et la relisent à « activé ». `SoundSync` le transmet au lecteur par `setEnabled`, qui coupe aussi ce qui sonne.
- **Tests et e2e.** Les builds e2e (`VITE_FAKE_SPEECH` + `VITE_USE_FAKES`) utilisent le fake, exposé en `window.__sounds` (lu par `playedSounds()` dans `e2e/helpers.ts`) ; le fake note `soft: true` quand la voix parlait. Les builds de production et de démo jouent les vrais sons.

## Alternatives écartées
- **Fichiers audio (MP3/OGG) enregistrés ou sous licence** : poids au téléchargement, licences à vérifier, et un timbre « laque et estampe » difficile à trouver tel quel.
- **Bibliothèque audio (Tone.js, Howler)** : nouvelle dépendance pour ce que l'API du navigateur fait déjà.
- **Couper la voix ou la baisser pendant un son** : contraire à la priorité de l'apprentissage.

## Conséquences
+ 0 octet de son à télécharger, fonctionne hors ligne, aucune dépendance.
+ Chaque son est du code testable (durées bornées, chaque son du catalogue a sa recette).
− Le rendu dépend du navigateur et du haut-parleur ; il se valide à l'oreille (panneau d'écoute en mode démo).
− Un son ajouté au catalogue exige une recette, que le test « every cue has a recipe » rappelle.
