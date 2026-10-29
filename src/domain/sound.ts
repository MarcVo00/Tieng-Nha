/** Every sound effect the app can play. Recipes (how each one sounds) live in the audio adapter. */
export const SOUND_CUES = [
  "answer.correct", "answer.wrong", "lesson.won", "lesson.lost", "heart.lost",
  "gacha.shake", "gacha.omen.common", "gacha.omen.rare", "gacha.omen.epic", "gacha.omen.legendary",
  "gacha.flip.common", "gacha.flip.rare", "gacha.flip.epic", "gacha.flip.legendary",
  "sig.wind", "sig.brush", "sig.gong", "sig.roar", "sig.blade", "sig.lantern", "sig.foxfire", "sig.bells",
  "blow.blade", "blow.staff", "blow.fan", "blow.fist", "blow.acc_thuan_thien", "blow.char_phap_su", "blow.char_kiem_khach",
  "blow.acc_kiem_rong", "blow.char_ho_ly", "blow.char_lac_long_quan",
  "fight.hurt", "fight.miss", "arena.start", "arena.victory", "arena.defeat", "arena.coins",
] as const;
export type SoundCue = (typeof SOUND_CUES)[number];
export type PlayOptions = { strong?: boolean }; // strong: louder, sharper attack (critical hit)
