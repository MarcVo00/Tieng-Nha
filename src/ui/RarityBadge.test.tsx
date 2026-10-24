import { render, screen } from "@testing-library/react";
import { fr } from "@/i18n/fr";
import { RarityBadge } from "@/ui/RarityBadge";

test.each([
  ["common", "bg-frame-bronze"],
  ["rare", "bg-frame-jade"],
  ["epic", "bg-fx-vermilion"],
  ["legendary", "bg-gold"],
] as const)("%s is the word plus a %s stick (the colour never carries the meaning alone)", (rarity, stick) => {
  const { container } = render(<RarityBadge rarity={rarity} />);
  expect(screen.getByText(fr.shop.rarities[rarity])).toBeInTheDocument();
  const mark = container.querySelector('[aria-hidden="true"]');
  expect(mark).toHaveClass(stick);
});
