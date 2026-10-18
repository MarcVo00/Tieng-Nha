import { lookOf } from "@/services/look";

describe("lookOf", () => {
  test("keeps only the four character slots", () => {
    expect(lookOf({ frame: "frame_jade", profile_fx: "fx_ink", hat: "hat_thuy_tinh", aura: "aura_waves" })).toEqual({
      hat: "hat_thuy_tinh",
      aura: "aura_waves",
    });
  });
  test("empty equipment gives an empty look", () => {
    expect(lookOf({})).toEqual({});
  });
});
