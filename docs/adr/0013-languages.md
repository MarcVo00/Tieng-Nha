# ADR 0013 — Plusieurs langues : registre, ids préfixés, contenu par langue, voix edge-tts

- Statut : accepté (2026-11-02)

## Contexte
L'app enseignait uniquement le vietnamien du Sud. Le tagalog de voyage (oral) s'ajoute, sans casser les données existantes ni la parité de contenu (ADR 0003).

## Décision
- **Registre des langues** (`src/domain/languages.ts`, `LANGUAGES`) : tout ce qui dépend de la langue y est rattaché (noms, attribut `lang`, code BCP 47 de la synthèse et de la reconnaissance, préfixe d'ids, types d'exercices, boss final, voix du pack). Aucun `if (lang === "vi")` dispersé ; les composants lisent le registre.
- **Ids préfixés** : les ids existants du vietnamien ne changent jamais (`l01`…, `d01`…, `v_*`, `exam_q*`, `boss_thuy_tinh`) car ils sont stockés dans les événements et la progression (ADR 0004). Les ids tagalog commencent par `tl_`.
- **Contenu par langue** : `src/content/<langue>/{lessons,dialogues,exam.json}` ; badges, révisions, duels et compteurs restent rattachés à leur langue.
- **Voix tagalog pré-générées** avec `edge-tts` (voix neuronales Microsoft gratuites, Python, réseau nécessaire une seule fois) : `tl-f` = `fil-PH-BlessicaNeural`, `tl-m` = `fil-PH-AngeloNeural`. Même format de pack que l'ADR 0011 : `public/audio/<voiceId>/<key>.mp3`, clé = SHA-256 NFC tronqué (`speechKey`), ré-encodage ffmpeg en mono 24 kHz 32 kbit/s. `scripts/tts/generate_audio_edge.py` est reprenable (fichiers existants ignorés) ; le manifeste (version 2) garde les entrées vietnamiennes telles quelles et ajoute `tl-f` / `tl-m`. Pas de choix de voix pour le tagalog : la première voix du registre (`tl-f`) est lue.
- venv `edge-tts` hors dépôt (`../tts-tools/edge-venv`), hors build npm ; les MP3 sont commités.

## Alternatives écartées
- **Voix de l'appareil seule** pour `fil-PH` : souvent absente ou de qualité très inégale.
- **Un seul fichier de contenu mêlant les langues** : casse la parité et les ids existants.
- **Autre moteur payant ou à clé d'API** : incompatible avec « 0 € ».

## Conséquences
+ Voix tagalog constante et hors ligne, sans dépendance npm.
− edge-tts s'appuie sur un point d'accès non officiel de Microsoft : il peut changer ; les MP3 déjà générés restent valables, et le repli sur la voix de l'appareil subsiste.
− Quelques Mo de MP3 supplémentaires dans le dépôt.
