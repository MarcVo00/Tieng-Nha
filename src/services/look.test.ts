import { characterSlotOf, lookOf } from "@/services/look";

describe("lookOf", () => {
  test("keeps only the four character slots", () => {
    expect(lookOf({ frame: "frame_jade", profile_fx: "fx_ink", hat: "hat_thuy_tinh", aura: "aura_waves" })).toEqual({
      hat: "hat_thuy_tinh",
      aura: "aura_waves",
    });
  });
  test("keeps the character", () => {
    expect(lookOf({ character: "char_phap_su", frame: "frame_jade" })).toEqual({ character: "char_phap_su" });
  });
  test("character is a character slot", () => {
    expect(characterSlotOf({ slot: "character" })).toBe("character");
    expect(characterSlotOf({ slot: "frame" })).toBeNull();
  });
  test("empty equipment gives an empty look", () => {
    expect(lookOf({})).toEqual({});
  });
});
