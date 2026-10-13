# ADR 0011 — Packs de voix pré-générés (accent Sud / Nord)

- Statut : accepté (2026-10-13)

## Contexte
Les voix `vi-VN` des téléphones sont presque toutes du Nord, alors que l'app enseigne le vietnamien du Sud. L'apprenant doit pouvoir choisir l'accent. Budget 0 €, app hors ligne d'abord, pas de backend audio.

## Décision
- Les ~380 textes que l'app peut prononcer (vocabulaire, exercices, dialogues, examen, phrases de test) sont **pré-générés une fois** avec VieNeu-TTS (local, gratuit, Apache-2.0) pour 4 voix : `south-f` (Mỹ Duyên, défaut), `south-m` (Thái Sơn), `north-f` (Đoan Trang), `north-m` (Phạm Tuyên). Le choix `device` conserve la voix du navigateur.
- Fichiers statiques `public/audio/<voiceId>/<key>.mp3` (mono, 24 kHz, 32 kbit/s, ≈ 3 Mo par voix) + `public/audio/manifest.json`. `key` = 16 premiers caractères hexadécimaux du SHA-256 du texte normalisé (NFC, sans espaces autour) ; même fonction en Python (`scripts/tts/generate_audio.py`) et en TS (`src/services/speechKey.ts`, vecteur de test partagé). Le manifeste (version 2) contient aussi une table texte normalisé → clé : l'adaptateur la charge au démarrage et lance `audio.play()` de façon synchrone dans le geste utilisateur (iOS), le hachage asynchrone ne servant que pour un texte absent de la table.
- Port inchangé : `AudioPackSynthesizer` (adaptateur) enveloppe `WebSpeechSynthesizer`. Il joue le MP3 si le manifeste le contient, sinon (clé absente, erreur audio, voix `device`, manifeste illisible) il délègue à la voix de l'appareil. `SpeakOptions.voice` permet d'écouter un aperçu sans enregistrer le réglage.
- Le réglage `Settings.voice` (défaut `south-f`) est stocké comme les autres réglages (Dexie ; les anciennes lignes reçoivent le défaut).
- PWA : `audio/**` n'est pas pré-caché. Les MP3 passent par un cache d'exécution `CacheFirst` (noms = empreintes, donc jamais périmés ; `rangeRequests` pour l'élément audio de Safari). `manifest.json` passe par `StaleWhileRevalidate` : disponible hors ligne tout de suite, mis à jour au chargement suivant après une régénération. Le service worker prend le contrôle dès la première installation (`clientsClaim: true`, sans `skipWaiting` : les mises à jour passent toujours par l'invite), pour que le préchargement de la première session soit mis en cache. La voix choisie est téléchargée en arrière-plan (6 requêtes en parallèle), une fois par voix et par session.
- Génération hors build npm (Python, venv hors dépôt) ; les MP3 sont commités. Régénération après un changement de contenu : `node scripts/tts/extract_texts.mjs` puis `generate_audio.py` (les fichiers existants sont ignorés).

## Alternatives écartées
- **FPT.AI / Viettel AI** : bonnes voix du Sud, mais clé d'API, quotas et appels réseau à l'exécution (ou génération soumise à des conditions d'usage) ; incompatible avec « 0 € et hors ligne ».
- **Voix de l'appareil seule** : accent du Nord, qualité variable, parfois absente (le test d'appareil de l'onboarding existe pour cela) ; reste le repli.
- **Génération côté navigateur (modèle ONNX embarqué)** : plusieurs dizaines de Mo de modèle et un calcul lourd sur téléphone.

## Conséquences
+ Accent choisi par l'utilisateur, qualité constante, fonctionne hors ligne une fois la voix téléchargée.
+ Aucune dépendance npm ni service externe ; repli automatique sur la voix de l'appareil.
− ≈ 12 Mo de MP3 dans le dépôt (4 voix) et ≈ 3 Mo à télécharger par voix choisie.
− Un nouveau texte n'a pas de voix pré-générée tant que le pack n'est pas régénéré (il est alors lu par la voix de l'appareil).
