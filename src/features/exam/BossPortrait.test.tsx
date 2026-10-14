import { render, screen } from "@testing-library/react";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { BossPortrait } from "@/features/exam/BossPortrait";

test("shows the boss on its paper medallion with an accessible name", () => {
  render(<BossPortrait boss={bossFixture} size={160} hits={0} defeated={false} />);
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeInTheDocument();
});

test("a defeated boss says so", () => {
  render(<BossPortrait boss={bossFixture} size={160} hits={3} defeated />);
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux — vaincu" })).toBeInTheDocument();
});
