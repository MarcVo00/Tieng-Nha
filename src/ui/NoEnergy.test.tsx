import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "@/i18n/fr";
import { NoEnergy } from "@/ui/NoEnergy";

test("shows the wait and wires both buttons", async () => {
  const onReview = vi.fn();
  const onBack = vi.fn();
  render(<NoEnergy wait={{ hours: 2, minutes: 14 }} onReview={onReview} onBack={onBack} />);
  expect(screen.getByRole("heading", { name: fr.energy.empty.title })).toBeInTheDocument();
  expect(screen.getByText(fr.energy.empty.body(2, 14))).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.review }));
  await userEvent.click(screen.getByRole("button", { name: fr.energy.empty.back }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("falls back to the no-wait text", () => {
  render(<NoEnergy wait={null} onReview={() => {}} onBack={() => {}} />);
  expect(screen.getByText(fr.energy.empty.bodyNoWait)).toBeInTheDocument();
});
