# Phase 4 — Content (T29–T32)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read **Global Constraints** first.
> **Mandatory reading for every content task:** `docs/content-guide.md` in full (rules, Southern lexicon, tones, curriculum, JSON examples, self-check).
> These tasks only touch `src/content/**`. They can start as soon as T02 is merged. Order: T29 → T30 → T31 → T32 (each reuses the vocabulary ids of the previous ones).
> Content is shipped **without human review**: when unsure about a word, a tone mark or a Southern usage, choose a simpler, more frequent alternative or leave it out. Never invent words.

## Common rules for T29–T32

**Vocabulary ids:** `v_` + ASCII slug of the Vietnamese: lowercase, remove all diacritics, `đ → d`, spaces and hyphens → `_` (`cà phê sữa đá` → `v_ca_phe_sua_da`). Homographs that differ only by tone get a French suffix: `ma` → `v_ma_fantome`, `mà` → `v_ma_mais`, `má` → `v_ma_maman`, `mả` → `v_ma_tombe`, `mã` → `v_ma_cheval`, `mạ` → `v_ma_riz`.

**Each word is defined once**, in the first lesson where it appears. Later lessons may use it in exercises (by id or in sentences) without redefining it. Before adding a vocab item, search existing lesson files for the same `vi` (`grep -rn '"vi": "cà phê"' src/content/lessons`).

**Exercise ids:** `<lessonId>_e01`, `_e02`, … in order. **Exam ids:** `exam_q001` … sequential.

**Typing Vietnamese:** write the characters directly in UTF-8 (no escapes). After writing a file, normalise it once to NFC with:
```bash
node -e "const f=process.argv[1];const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').normalize('NFC'))" src/content/lessons/l01.json
```

**Distractors:** plausible (same theme, similar length) but unambiguous — exactly one correct answer. For `listen_choose`, choices are 4 distinct vocab ids from the current or earlier lessons. For `translate_choose`, the three distractors must not be valid translations of the French prompt.

**Validation loop (every file):** `npx tsx scripts/validate-content.ts` must print `✓ Content valid`. Fix every reported error before moving on.

**Report:** in your task report, list every vocab item you were less than fully confident about (word, tone, Southern usage) under "Écarts / remarques" so Marc can check them later.

---

### Task T29: Lessons l01–l05

**Files:** Create `src/content/lessons/l01.json` … `l05.json`; delete `src/content/lessons/.gitkeep`.

| Lesson | Title | Emoji | Required vocabulary (add up to 18 items total per lesson, all frequent) | Dialogue |
|---|---|---|---|---|
| l01 | Les 6 tons & bonjour | 🎵 | xin chào, chào bạn, tạm biệt, cảm ơn, dạ, không, ma (fantôme), mà (mais), má (maman), mả (tombe), mã (cheval), mạ (jeune riz) | d01 |
| l02 | Politesse & pronoms | 🙏 | tui, bạn, anh, chị, em, cô, chú, ông, bà, xin lỗi, không sao, khỏe không | d02 |
| l03 | Les chiffres | 🔢 | một, hai, ba, bốn, năm, sáu, bảy, tám, chín, mười, trăm, ngàn, mấy, số | d03 |
| l04 | La famille | 👨‍👩‍👧 | ba (papa), anh hai, chị hai, ông bà, con, gia đình, có, người | d04 |
| l05 | Au café | ☕ | cà phê, cà phê sữa đá, cà phê đen, trà đá, ly, đá, đường, sữa, nước, cho tui, tính tiền, ngon | d05 |

Notes:
- l01: description explains the 6 tones; vocab notes explain: `má` = maman au Sud; the Southern merge of `hỏi`/`ngã`; `v` pronounced like "y" in the South. At least **4** `tone_pick` exercises (one per demo syllable is fine). `listen_choose` on the 6 "ma" words is the core exercise.
- l03: `ba` (trois) already conflicts with `ba` (papa) in l04: define `v_ba_trois` in l03 and `v_ba_papa` in l04, with a note in l04 ("même mot que trois, le ton est identique : le contexte décide").
- l03: `bốn` note: "Au Sud on entend aussi « tư » dans certains nombres (24 = hai mươi tư)." Do not teach numbers above 10 except `trăm`, `ngàn` as words.
- l04: `má` is already defined in l01 (`v_ma_maman`): reuse it in exercises, do not redefine.
- l05: use exactly the example in `docs/content-guide.md` §6 as a starting point, completed to ≥ 12 vocab and 8–12 exercises.
- Exercise mix per lesson (content-guide §5): ≥ 2 `listen_choose`, ≥ 2 `translate_choose`, ≥ 1 `tone_pick` (≥ 4 in l01), ≥ 1 `word_order`, ≥ 2 `speak`; order from easiest (listening) to hardest (speaking).

- [ ] **Step 1:** Write l01.json → validate → fix.
- [ ] **Step 2–5:** Same for l02 … l05 (validate after each).
- [ ] **Step 6:** Run the self-check of `content-guide.md` §8 for each lesson and paste it in the report.
- [ ] **Step 7:** `npm run verify` → PASS. **Commit:** `content: add lessons l01-l05`

**Acceptance:** 5 valid lesson files; `listen_choose` choices all resolve; no Northern word from content-guide §3 right column (`grep -nE '"(tôi|vâng|bố|mẹ|cốc|bát|thìa|quả|lợn|ngô|đắt|nghìn|rẽ|vào|gọi|nhé|dứa)"' src/content/lessons/*.json` → no match outside `note` fields).

---

### Task T30: Lessons l06–l10

**Files:** Create `src/content/lessons/l06.json` … `l10.json`. **Depends on:** T29 (reuse its ids).

| Lesson | Title | Emoji | Required vocabulary | Dialogue |
|---|---|---|---|---|
| l06 | Manger | 🍜 | phở, cơm tấm, bánh mì, hủ tiếu, ăn, uống, đói, no, chén, muỗng, đũa, ngon quá | d06 |
| l07 | Au marché | 🥭 | bao nhiêu tiền, mắc quá, rẻ, bớt, mua, bán, trái cây, xoài, thơm (ananas), chuối, ký | d07 |
| l08 | Se déplacer | 🛵 | xe ôm, đi, ở đâu, quẹo trái, quẹo phải, đi thẳng, dừng lại, gần, xa, đây, đó | d08 |
| l09 | Le temps | 🕰️ | hôm nay, ngày mai, hôm qua, bây giờ, mấy giờ, giờ, sáng, trưa, chiều, tối | d09 |
| l10 | Se présenter | 🤝 | tên, tên là, người Pháp, người Việt, sống ở, tuổi, học, tiếng Việt, rất vui được gặp bạn | d10 |

Notes:
- l06 note on `chén` (bol, Nord « bát »), `muỗng` (cuillère, Nord « thìa »).
- l07 note: `thơm` = ananas au Sud (aussi « qui sent bon »), `mắc` = cher (Nord « đắt »), `ký` = kilo. Prices use only number words from l03: `năm ngàn`, `mười ngàn`, `một trăm ngàn` (do not use `chục`, it is not taught).
- l08 note: `quẹo` (Sud) vs `rẽ` (Nord); `xe ôm` = moto-taxi.
- l09: avoid full clock times above 10 (`mấy giờ?` / `mười giờ` are fine).
- l10: `người Pháp` = Français(e). `rất vui được gặp bạn` is one vocab item (expression).
- Same exercise mix as T29.

- [ ] **Steps:** one file at a time, validate after each, self-check §8, `npm run verify`. **Commit:** `content: add lessons l06-l10`

**Acceptance:** 10 lesson files valid; `npx tsx scripts/validate-content.ts` passes (non-strict); same Northern-word grep as T29 returns nothing outside notes.

---

### Task T31: Dialogues d01–d10

**Files:** Create `src/content/dialogues/d01.json` … `d10.json`; delete `.gitkeep`. **Depends on:** T30.

| Id | Title | Scene (FR, with Vietnamese place name) | Uses vocabulary of |
|---|---|---|---|
| d01 | Première rencontre | Dans la rue — Trên đường | l01 |
| d02 | Saluer un voisin | Devant la maison — Trước nhà | l01–l02 |
| d03 | Donner son numéro | Au téléphone — Gọi điện thoại | l01–l03 |
| d04 | Montrer une photo de famille | Chez des amis — Nhà bạn | l01–l04 |
| d05 | Commander au café | Quán cà phê | l01–l05 (use content-guide §7 verbatim) |
| d06 | Au restaurant | Quán cơm tấm | l01–l06 |
| d07 | Marchander des fruits | Chợ Bến Thành | l01–l07 |
| d08 | Prendre un xe ôm | Ngã tư — au carrefour | l01–l08 |
| d09 | Fixer un rendez-vous | Au téléphone | l01–l09 |
| d10 | Se présenter à la famille | Repas de famille — Bữa cơm gia đình | l01–l10 |

Rules (content-guide §1 and §7): 4–8 turns; starts with `npc`; ends with `next: null`; no cycles; NPC addresses the learner with `bạn`; **user options** use only vocabulary of the lessons listed (plus tool words §4); NPC lines may contain a few extra words (translation always provided). Each user turn has 2–3 options that are all valid replies (no trick options).

- [ ] **Steps:** write each file, validate (`validate-content` checks graph and references), then `npx tsx scripts/validate-content.ts --strict` must report **only** exam-related errors (lessons and dialogues complete). **Commit:** `content: add dialogues d01-d10`

---

### Task T32: Final exam pool

**Files:** Create `src/content/exam.json`. **Depends on:** T31.

- `{ "contentVersion": 1, "questions": [...] }` with **72 questions**: 24 `listening` (`listen_choose`), 18 `translation` (12 `translate_choose` + 6 `word_order`), 15 `tones` (`tone_pick`), 15 `speaking` (`speak`) — above the minimums so random draws vary.
- Coverage: each lesson contributes 6–8 questions spread across sections. Questions are **new** (not copies of lesson exercises), but only use vocabulary from the lessons.
- Exercise ids inside questions: `exam_e001` …; question ids `exam_q001` … (sequential).
- `speak` sentences ≤ 8 syllables; `tone_pick` syllables from lesson vocabulary (each of the 6 tones appears at least twice).

- [ ] **Step 1:** write the file; **Step 2:** `npx tsx scripts/validate-content.ts --strict` → `✓ Content valid (strict)`; **Step 3:** `npm run verify`. **Commit:** `content: add final exam pool`

**Acceptance:** strict validation passes; tone distribution check: `node -e "const q=require('./src/content/exam.json').questions.filter(q=>q.section==='tones');const c={};q.forEach(x=>c[x.exercise.answerTone]=(c[x.exercise.answerTone]||0)+1);console.log(c)"` shows all 6 tones with ≥ 2.
