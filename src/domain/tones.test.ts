import { toneOfSyllable } from "@/domain/tones";

test.each([
  ["ma", "ngang"], ["mà", "huyen"], ["má", "sac"], ["mả", "hoi"], ["mã", "nga"], ["mạ", "nang"],
  ["đá", "sac"], ["sữa", "nga"], ["phở", "hoi"], ["cà", "huyen"], ["ơi", "ngang"], ["được", "nang"], ["Việt", "nang"],
])("toneOfSyllable(%s) = %s", (syl, tone) => {
  expect(toneOfSyllable(syl)).toBe(tone);
});
