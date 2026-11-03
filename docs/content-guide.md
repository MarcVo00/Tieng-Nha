# Guide de rédaction du contenu (vietnamien du Sud)

> Le contenu est généré **sans relecture humaine**. Ce guide sert à minimiser le risque d'erreur. En cas de doute sur un mot ou une tournure : **choisir plus simple et plus fréquent**, ou ne pas l'utiliser.

## 0. Où vivent les fichiers
- Un dossier par langue : `src/content/vi/` (vietnamien, ids inchangés `l01`…) et `src/content/tl/` (tagalog, ids préfixés `tl_` : `tl_l01`, `tl_d01`, `tl_v_*`). Chacun contient `lessons/`, `dialogues/`, `exam.json`, `tree.json`, `bosses.json`.
- Les catalogues partagés restent à la racine de `src/content/` : `badges.json`, `shop.json`, `changelog.json`.
- Les textes parlés sont extraits par langue dans `scripts/tts/texts.json` (`{ "vi": [...], "tl": [...] }`).

## 1. Règles absolues
1. **Unicode NFC** pour tout texte vietnamien (`str.normalize("NFC")`). `validate-content` rejette le NFD.
2. **Vocabulaire du Sud** (Sài Gòn) quand il diffère du Nord (tableau §3). Ajouter une `note` FR quand la différence est notable.
3. **Fréquence avant tout** : uniquement des mots du quotidien très courants. Pas d'expressions idiomatiques, pas de proverbes, pas d'argot, pas de jeux de mots.
3 bis. **Registre oral** : l'appli apprend à **parler**. Écrire comme on parle à Sài Gòn, pas comme un manuel : `Mấy giờ rồi?` (pas `Bây giờ là mấy giờ?`), `Mình ở Pháp` (pas `sống ở Pháp`), `ba mình` / `gia đình mình` (sans `của` pour la famille), `Bạn tên gì?`, `Dừng ở đây nha` (pas `Dừng lại!`, trop sec). Chaque mot de politesse ou pronom a une `note` qui explique **pourquoi** et **à qui** on le dit.
4. **Phrases courtes** : ≤ 8 syllabes pour `speak`, ≤ 10 pour `translate_choose` / `word_order`, ≤ 12 pour les répliques de dialogue.
5. **Traductions françaises naturelles**, tutoiement pour s'adresser à l'apprenant dans les consignes.
6. **Pronoms selon la personne en face** (jamais `tui`, jugé trop familier). L'apprenant parle de lui avec :
   - **`mình`** face à un·e ami·e ou quelqu'un de son âge (`bạn`) ;
   - **`em`** face à un `anh` / une `chị` ;
   - **`con`** face à un `cô`, `chú`, `ông`, `bà` (qui l'appellent aussi `con`) ;
   - **aucun pronom** quand c'est naturel : `Em ơi, cho một ly trà đá.`, `Đói quá!`.
   On ne connaît pas le genre de l'apprenant : il ne parle jamais de lui avec `anh`/`chị`, et les PNJ de son âge ou plus jeunes l'appellent `bạn`. Chaque pronom a une `note` qui explique à qui on le dit.
7. Une leçon n'utilise dans ses exercices **que** son vocabulaire et celui des leçons précédentes (plus les mots-outils listés §4). `validate-content` vérifie que chaque `vocabId` existe.
8. Aucun contenu sensible : politique, religion, alcool en excès, stéréotypes.

## 2. Les tons (rappel pour générer les `tone_pick` et les notes)
| Ton (`Tone`) | Nom VI | Signe | Exemple | Description FR pour l'UI |
|---|---|---|---|---|
| `ngang` | thanh ngang | aucun | ma (fantôme) | plat, voix moyenne |
| `huyen` | thanh huyền | à | mà (mais) | descend doucement, voix grave |
| `sac` | thanh sắc | á | má (maman, Sud) | monte vers l'aigu |
| `hoi` | thanh hỏi | ả | mả (tombe) | descend puis remonte |
| `nga` | thanh ngã | ã | mã (cheval, chiffre) | monte avec une cassure |
| `nang` | thanh nặng | ạ | mạ (jeune riz) | bref, tombe et s'arrête |

- `tone_pick.syllable` = la syllabe complète avec ton ; `answerTone` doit correspondre au signe présent. Ne choisir que des syllabes avec **une seule** voyelle porteuse de ton évidente.
- **Particularité du Sud** : à l'oral, `hỏi` et `ngã` se prononcent quasiment pareil. La leçon 1 doit le signaler dans une note. Les `tone_pick` restent valables (on apprend l'orthographe des tons).
- Autres traits du Sud à mentionner dans les notes de la leçon 1 : `v` se prononce comme un « y » (`vui` ≈ « yui ») ; `d`/`gi` ≈ « y » ; finales `-n`/`-ng` souvent confondues.

## 3. Lexique Sud ↔ Nord (utiliser la colonne Sud)
| Sens | **Sud (à utiliser)** | Nord (ne pas utiliser, citer en note si utile) |
|---|---|---|
| bonjour / au revoir | **chào** + la personne (`chào bạn`, `chào anh`, `chào chị`, `chào em`, `chào chú`…), pour saluer comme pour partir | `xin chào`, `tạm biệt` : corrects mais formels, « manuel scolaire » — ne pas les utiliser |
| je / moi | `mình` (ami·e), `em` (face à anh/chị), `con` (face à cô/chú/ông/bà) | `tôi` (neutre, distant) ; `tui` (Sud, trop familier : ne pas utiliser) |
| oui (poli) | dạ | vâng |
| papa / maman | ba / má | bố / mẹ |
| aîné(e) de la fratrie | anh hai / chị hai | anh cả / chị cả |
| verre (à boire) | ly | cốc |
| bol | chén | bát |
| cuillère | muỗng | thìa |
| assiette | dĩa | đĩa |
| fruit | trái (cây) | quả |
| cochon / porc | heo | lợn |
| maïs | bắp | ngô |
| cher | mắc | đắt |
| mille | ngàn | nghìn |
| tourner (direction) | quẹo | rẽ |
| entrer | vô | vào |
| appeler (quelqu'un) | kêu | gọi |
| particule « hein / d'accord ? » | nha | nhé |
| ananas | thơm | dứa |

## 4. Mots-outils autorisés partout (sans être dans `vocab`)
`không` (non / ne… pas), `có` (avoir / oui), `là` (être), `và` (et), `một` (un), `cái` (classificateur), `rồi` (déjà), `ơi` (interpellation), `nha`, `dạ`, `gì` (quoi), `đâu` (où), `rất` (très), `quá` (trop / tellement), `lắm` (très, après l'adjectif), `đây` (ici / voici), `chút` (un peu), `của` (de, possession).

Les **répliques PNJ** des dialogues peuvent contenir quelques mots hors vocabulaire (leur traduction est toujours disponible) ; les **options utilisateur** et les **exercices** ne le peuvent pas.

## 5. Curriculum V1
| Leçon | Thème | Vocabulaire indicatif (12–18 items) | Dialogue |
|---|---|---|---|
| l01 | Les 6 tons & saluer | chào, chào bạn, chào anh, chào chị, chào em, chào chú, cảm ơn, dạ, không, vui, ma, mà, má, mả, mã, mạ | d01 — Première rencontre |
| l02 | Pronoms & politesse | mình, con (je), bạn, anh, chị, em, cô, chú, ông, bà, xin lỗi, không sao, khỏe không | d02 — Saluer un voisin |
| l03 | Chiffres | một … mười, trăm, ngàn, mấy, số | d03 — Donner son numéro |
| l04 | Famille | ba, má, anh hai, chị hai, em, ông bà, con, gia đình, có, mấy người | d04 — Montrer une photo de famille |
| l05 | Au café | cà phê, cà phê sữa đá, cà phê đen, trà đá, ly, đá, đường, cho, em ơi, tính tiền, ngon | d05 — Commander au café |
| l06 | Manger | phở, cơm tấm, bánh mì, hủ tiếu, ăn, uống, đói, no, chén, muỗng, đũa, ngon quá | d06 — Au restaurant |
| l07 | Au marché | bao nhiêu tiền, mắc quá, rẻ, bớt, mua, bán, trái cây, xoài, thơm, chuối, ký | d07 — Marchander des fruits |
| l08 | Se déplacer | xe ôm, đi, ở đâu, quẹo trái, quẹo phải, đi thẳng, dừng, gần, xa, đây, đó | d08 — Prendre un xe ôm |
| l09 | Le temps | hôm nay, ngày mai, hôm qua, bây giờ, mấy giờ, giờ, sáng, trưa, chiều, tối | d09 — Fixer un rendez-vous |
| l10 | Se présenter | tên, tên là, người Pháp, người Việt, ở (habiter), tuổi, học, tiếng Việt, rất vui được gặp bạn | d10 — Se présenter à la famille |

Composition d'une leçon (8–12 exercices) : ≥ 2 `listen_choose`, ≥ 2 `translate_choose`, ≥ 1 `tone_pick` (≥ 4 pour l01), ≥ 1 `word_order`, ≥ 2 `speak`. Ordre : du plus facile (écoute) au plus difficile (oral).

Examen (`exam.json`) : ≥ 60 questions réparties (≥ 20 `listening` [listen_choose], ≥ 16 `translation` [translate_choose ou word_order], ≥ 12 `tones` [tone_pick], ≥ 12 `speaking` [speak]), couvrant les 10 leçons de façon équilibrée, ids `exam_q001`…

## 6. Exemple complet — leçon `l05` (extrait valide)
```json
{
  "id": "l05",
  "contentVersion": 1,
  "title": "Au café",
  "description": "Commander un café glacé comme à Sài Gòn.",
  "emoji": "☕",
  "dialogueId": "d05",
  "vocab": [
    { "id": "v_ca_phe", "vi": "cà phê", "fr": "café", "dialect": "south" },
    { "id": "v_ca_phe_sua_da", "vi": "cà phê sữa đá", "fr": "café au lait glacé", "dialect": "south", "note": "La boisson emblématique de Sài Gòn : café fort et lait concentré sucré sur glace." },
    { "id": "v_ca_phe_den", "vi": "cà phê đen", "fr": "café noir", "dialect": "south" },
    { "id": "v_tra_da", "vi": "trà đá", "fr": "thé glacé", "dialect": "south" },
    { "id": "v_ly", "vi": "ly", "fr": "verre", "dialect": "south", "note": "Au Nord on dit « cốc »." },
    { "id": "v_da", "vi": "đá", "fr": "glace (glaçons)", "dialect": "south" },
    { "id": "v_cho", "vi": "cho", "fr": "donner ; « pour moi » quand on commande", "dialect": "south", "note": "Pour commander, pas besoin de « je » : « Em ơi, cho một ly trà đá »." },
    { "id": "v_tinh_tien", "vi": "tính tiền", "fr": "l'addition", "dialect": "south" }
  ],
  "exercises": [
    { "id": "l05_e01", "type": "listen_choose", "vocabId": "v_ca_phe_sua_da", "choices": ["v_ca_phe_sua_da", "v_ca_phe_den", "v_tra_da", "v_ly"] },
    { "id": "l05_e02", "type": "tone_pick", "syllable": "đá", "answerTone": "sac" },
    { "id": "l05_e03", "type": "translate_choose", "promptFr": "Un café noir, s'il te plaît.", "answerVi": "Em ơi, cho một ly cà phê đen.", "distractorsVi": ["Em ơi, cho một ly trà đá.", "Em ơi, cho một ly cà phê sữa đá.", "Em ơi, tính tiền."] },
    { "id": "l05_e04", "type": "word_order", "fr": "Un café au lait glacé, s'il te plaît.", "tokensVi": ["Em ơi", "cho", "một", "ly", "cà phê", "sữa", "đá"], "extraTokens": ["đen"] },
    { "id": "l05_e05", "type": "speak", "vi": "Em ơi, cho một ly trà đá.", "fr": "Un thé glacé, s'il te plaît.", "vocabIds": ["v_cho", "v_ly", "v_tra_da"] },
    { "id": "l05_e06", "type": "speak", "vi": "Em ơi, tính tiền!", "fr": "S'il te plaît, l'addition !", "vocabIds": ["v_tinh_tien"] }
  ]
}
```
(Une vraie leçon contient 12–18 vocabulaires et 8–12 exercices.)

`word_order` : `tokensVi` est l'ordre correct ; l'UI mélange `tokensVi + extraTokens`. Un mot composé fréquent (« cà phê ») peut être une seule tuile.
`speak` : `vocabIds` liste les mots du Leitner mis à jour par l'exercice.
« Em ơi » sert à interpeller un serveur plus jeune : c'est l'usage courant, à signaler dans une note de leçon.

## 7. Exemple complet — dialogue `d05`
```json
{
  "id": "d05",
  "contentVersion": 1,
  "title": "Commander au café",
  "scene": "Quán cà phê — un petit café de trottoir à Sài Gòn",
  "turns": [
    { "id": "t1", "speaker": "npc", "vi": "Chào bạn! Bạn uống gì?", "fr": "Bonjour ! Tu bois quoi ?", "next": "t2" },
    { "id": "t2", "speaker": "user", "options": [
      { "id": "o1", "vi": "Em ơi, cho một ly cà phê sữa đá.", "fr": "Un café au lait glacé, s'il te plaît.", "next": "t3" },
      { "id": "o2", "vi": "Em ơi, cho một ly trà đá.", "fr": "Un thé glacé, s'il te plaît.", "next": "t3" }
    ] },
    { "id": "t3", "speaker": "npc", "vi": "Dạ, bạn đợi chút nha.", "fr": "D'accord, attends un instant.", "next": "t4" },
    { "id": "t4", "speaker": "user", "options": [
      { "id": "o1", "vi": "Cảm ơn em.", "fr": "Merci.", "next": "t5" },
      { "id": "o2", "vi": "Dạ, cảm ơn.", "fr": "Oui, merci.", "next": "t5" }
    ] },
    { "id": "t5", "speaker": "npc", "vi": "Của bạn đây. Ngon lắm nha!", "fr": "Voilà pour toi. C'est très bon !", "next": null }
  ]
}
```
Règles dialogue : 4–8 tours ; alternance PNJ/utilisateur ; commence par le PNJ ; dernier tour `next: null` ; les options d'un même tour peuvent converger vers le même `next` (graphe simple, sans cycle).

## 8. Auto-vérification avant de livrer du contenu
- [ ] `npm test` vert (validate-content).
- [ ] Chaque mot est dans le curriculum §5 ou est un mot-outil §4, ou est d'usage quotidien évident.
- [ ] Aucune forme du Nord de la colonne de droite §3.
- [ ] Les phrases respectent les longueurs §1.4.
- [ ] Chaque `answerTone` correspond au signe de `syllable`.
- [ ] Les distracteurs sont plausibles mais **sans ambiguïté** (une seule bonne réponse possible).
- [ ] Après toute modification du contenu : régénérer les voix (`node scripts/tts/extract_texts.mjs` puis `generate_audio.py`, voir `scripts/tts/README.md`) ; sans cela le nouveau texte est lu par la voix de l'appareil.

## 9. Tagalog (`src/content/tl/`)

Les §1 à §8 valent pour le tagalog, sauf ce qui touche aux tons et au Sud du Vietnam. Le but est le même que pour Marc au Vietnam : **parler** en voyage aux Philippines (saluer, commander, payer, demander son chemin, prendre un taxi).

### 9.1 Règles propres au tagalog
1. **Identifiants préfixés** : `tl_l01`, `tl_d01`, `tl_v_salamat`, exercices `tl_l01_e01`. Champ `dialect: "manila"`. Le texte tagalog va dans les champs `vi` / `answerVi` / `tokensVi` (noms hérités du schéma).
2. **Le tagalog qu'on entend vraiment** (anti-objectif de la spec : pas de tagalog de manuel) :
   - le **taglish** est normal : `discount`, `card`, `cash`, `excuse me po`, `okay lang`, `hindi ko gets`, `taga-France ako` ;
   - les **prix** se disent en espagnol (`bente`, `singkuwenta`, `dosyentos`, `siyento singkuwenta`) ou en anglais ; le tagalog sert à compter les choses (`isa`, `dalawa`…) ;
   - **`po`** partout où l'on parle à un inconnu, un vendeur, un chauffeur ou un aîné, et **`opo`** pour le oui poli. L'apprenant dit `po` à tout inconnu qui ne le tutoie pas (un `ka` ou un `mo` en face autorise à s'en passer).
3. **Accent tonique sourcé** : l'accent ne s'écrit pas en tagalog. Chaque mot enseigné a une ligne dans `docs/content/tagalog-sources.md` (mot → transcription → prononciation de la source → URL, en priorité l'API du Wiktionnaire anglais). **Un mot sans source n'est pas enseigné**, ni dans le vocabulaire, ni dans un exercice, ni dans une réplique de dialogue.
4. **`pron` obligatoire** sur chaque vocabulaire, chaque exercice `speak` et chaque réplique de dialogue (PNJ et options). Format : syllabes séparées par `·`, syllabe accentuée en capitales, mots séparés par une espace (`sa·LA·mat PO`, `ma·gan·DANG u·MA·ga`). La transcription d'une phrase est la suite des transcriptions de ses mots ; `ng` s'écrit `NANG`, un mot d'une syllabe est en capitales, un mot anglais est réécrit avec les lettres du tagalog (`DIS·kawnt`). Un mot redoublé s'écrit en deux mots (`DA·han DA·han`) : le schéma exige une syllabe en capitales entre deux espaces.
5. **Exercices** : seulement `listen_choose`, `translate_choose`, `word_order`, `speak` (pas de `tone_pick` : le registre `src/domain/languages.ts` en décide). Par leçon : ≥ 2 `listen_choose`, ≥ 2 `translate_choose`, ≥ 1 `word_order`, ≥ 2 `speak`.
6. **Mots-outils autorisés partout** (au lieu du §4) : `po`, `ang`, `ng`, `sa`, `na`, `ba`, `bang`, `ko`, `ka`, `mo`, `si`, `lang`, `pa`, `may`, `ako`. Ils ont tout de même leur ligne de source.
7. **Notes en français** : elles expliquent l'usage (à qui on dit `po`, que le taglish est normal, comment on paie dans le jeepney). Mêmes règles typographiques que l'interface : espace fine insécable (U+202F) avant `? ! : ;` et à l'intérieur de « ». Les guillemets entourent le tagalog cité.

### 9.2 Curriculum
| Leçon | Thème | Vocabulaire | Dialogue |
|---|---|---|---|
| tl_l01 | Salutations et politesse | kumusta, mabuti (naman), ka, kayo, po, opo, oo, hindi, salamat, maraming salamat, walang anuman, magandang umaga / hapon / gabi, paalam, ingat | tl_d01 — Bonjour à l'hôtel |
| tl_l02 | Se présenter, survivre | ako, ako si, pangalan, ikaw, Pranses, taga-France ako, hindi ko alam, pakiulit po, dahan-dahan po, ano po?, marunong, mag-Ingles, Tagalog, hindi ko maintindihan, hindi ko gets, konti lang | tl_d02 — Faire connaissance |
| tl_l03 | Les nombres et les prix | isa … sampu, bente, singkuwenta, sandaan, dosyentos, piso, pesos | tl_d03 — Acheter des mangues |
| tl_l04 | Commander à manger | gusto ko, isa pa po, pahingi, tubig, kanin, manok, baboy, isda, adobo, kape, yelo, walang yelo, masarap, maanghang, ito | tl_d04 — À la cantine |
| tl_l05 | Payer | magkano, bayad, sukli, barya, mahal, ang mahal!, mura, may, discount, pwede, card, cash, wala | tl_d05 — Payer un souvenir |
| tl_l06 | Demander son chemin | nasaan, saan, kaliwa, kanan, diretso, malapit, malayo, dito, doon, CR, palengke, hotel, mall, tapos | tl_d06 — Trouver les toilettes |
| tl_l07 | Prendre un taxi | sa, airport, para po!, dito na lang po, sa tabi lang po, hanggang, metro, pakibuksan po ang metro, jeepney, tricycle, Grab, taxi | tl_d07 — En tricycle |
| tl_l08 | Une journée de voyageur | excuse me po, pasensya na, okay lang, sige, tara, gutom, busog, teka lang, mainit, ang init!, sarado, bukas, meron, kain tayo! | tl_d08 — Déjeuner et addition |

`tl_l08` révise les leçons 1 à 7 dans des situations mélangées ; comme tout vocabulaire a un identifiant unique, elle apporte aussi ses propres mots de « journée de voyage ».

### 9.3 Auto-vérification tagalog
- [ ] Chaque mot de chaque texte tagalog a sa ligne dans `docs/content/tagalog-sources.md`, et le `pron` correspond à l'accent de la source.
- [ ] `po` / `opo` dans chaque phrase adressée à un inconnu.
- [ ] Les options utilisateur et les exercices n'utilisent que le vocabulaire de la leçon, des leçons précédentes et les mots-outils §9.1.
- [ ] `npx tsx scripts/validate-content.ts --strict` et `node scripts/tts/extract_texts.mjs` (chaque texte tagalog listé sous `tl`).
