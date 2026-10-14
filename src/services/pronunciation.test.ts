import { normalizeVi, stripTones, scorePronunciation, PASS_THRESHOLD, saidExactly } from "@/services/pronunciation";

test("normalizeVi", () => {
  expect(normalizeVi("  Cho tui một ly Cà Phê, nha!  ")).toBe("cho tui một ly cà phê nha");
  expect(normalizeVi("Cà phê".normalize("NFD"))).toBe("cà phê");
  expect(normalizeVi("1 2 10")).toBe("một hai mười");
});
test("stripTones keeps vowel modifiers and đ", () => {
  expect(stripTones("cà phê sữa đá")).toBe("ca phê sưa đa");
  expect(stripTones("Việt Nam")).toBe("Viêt Nam");
  expect(stripTones("ơi ăn ấm")).toBe("ơi ăn âm");
});
test("perfect match", () => {
  const r = scorePronunciation("Cho tui một ly trà đá.", ["cho tui một ly trà đá"]);
  expect(r.score).toBe(1);
  expect(r.diff.every((d) => d.status === "ok")).toBe(true);
});
test("one wrong tone costs half a syllable", () => {
  const r = scorePronunciation("trà đá", ["trà đà"]);
  expect(r.score).toBe(0.75);
  expect(r.diff[1]).toEqual({ expected: "đá", heard: "đà", status: "tone" });
});
test("missing syllable", () => {
  const r = scorePronunciation("cho tui một ly", ["cho tui ly"]);
  expect(r.score).toBe(0.75);
  expect(r.diff.find((d) => d.status === "missing")?.expected).toBe("một");
});
test("best alternative wins", () => {
  expect(scorePronunciation("xin chào", ["sin chao", "xin chào"]).score).toBe(1);
});
test("garbage scores low and is clamped at 0", () => {
  const r = scorePronunciation("xin chào", ["hello world how are you"]);
  expect(r.score).toBe(0);
  expect(r.score).toBeLessThan(PASS_THRESHOLD);
});
test("no alternatives → score 0", () => expect(scorePronunciation("xin chào", []).score).toBe(0));

test("normalizeVi spells out long digit runs digit by digit", () => {
  expect(normalizeVi("889362")).toBe("tám tám chín ba sáu hai");
  expect(normalizeVi("889 362")).toBe("tám tám chín ba sáu hai");
  expect(normalizeVi("Số của tui là 973256.")).toBe("số của tui là chín bảy ba hai năm sáu");
});
test("scorePronunciation matches a recognised digit run", () => {
  expect(scorePronunciation("Số của tui là tám tám chín ba sáu hai.", ["số của tui là 889362"]).score).toBe(1);
});

test("saidExactly accepts only the whole sentence, every tone right (early acceptance must never cut a sentence short)", () => {
  expect(saidExactly("Em ơi, cho một ly trà đá.", ["em ơi cho một ly trà đá"])).toBe(true);
  expect(saidExactly("Em ơi, cho một ly trà đá.", ["em ơi cho một ly trà"])).toBe(false); // still speaking
  expect(saidExactly("Chào anh!", ["chào ánh"])).toBe(false); // wrong tone: let the normal grading decide
  expect(saidExactly("Chào anh!", ["chào em", "chào anh"])).toBe(true); // any alternative
});
