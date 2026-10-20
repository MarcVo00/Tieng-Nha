import { render, screen } from "@testing-library/react";
import { bossFixture } from "@/adapters/fakes/seed/tree";
import { BossPortrait, BossSprite } from "@/features/exam/BossPortrait";

test("shows the boss on its paper medallion with an accessible name", () => {
  render(<BossPortrait boss={bossFixture} size={160} />);
  expect(screen.getByRole("img", { name: "Thủy Tinh, le dieu des eaux" })).toBeInTheDocument();
});

test("the boss sprite swaps to its own « defeated » art for the K.-O. face, never a tilted tile", () => {
  const { container, rerender } = render(<BossSprite illustration={bossFixture.illustration} size={96} facing={-1} expression="idle" />);
  const idle = container.querySelector("img[data-art='idle']");
  expect(idle).not.toBeNull();
  expect(container.querySelector("img[data-art='defeated']")).toHaveClass("invisible");
  rerender(<BossSprite illustration={bossFixture.illustration} size={96} facing={-1} expression="ko" pose="bow" />);
  expect(container.querySelector("img[data-art='defeated']")).not.toHaveClass("invisible");
  expect(container.querySelector("[data-pose]")).toHaveAttribute("data-pose", "bow");
});
