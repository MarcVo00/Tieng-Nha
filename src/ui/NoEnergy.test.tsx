import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "@/i18n/fr";
import { NoEnergy } from "@/ui/NoEnergy";

test("shows the wait and wires both buttons", async () => {
  const onReview = vi.fn();
  const onBack = vi.fn();
  render(<NoEnergy wait={{ hours: 2, minutes: 14 }} canReview onReview={onReview} onBack={onBack} />);
  expect(screen.getByRole("heading", { name: fr.energy.empty.title })).toBeInTheDocument();
  expect(screen.getByText(fr.energy.empty.body(2, 14))).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.review }));
  await userEvent.click(screen.getByRole("button", { name: fr.energy.empty.back }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("falls back to the no-wait text", () => {
  render(<NoEnergy wait={null} canReview onReview={() => {}} onBack={() => {}} />);
  expect(screen.getByText(fr.energy.empty.bodyNoWait)).toBeInTheDocument();
});

test("with nothing to review it offers no review button, only the wait and Retour", async () => {
  const onBack = vi.fn();
  render(<NoEnergy wait={{ hours: 2, minutes: 14 }} canReview={false} onReview={() => {}} onBack={onBack} />);
  expect(screen.getByText(fr.energy.empty.waitOnly(2, 14))).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: fr.energy.review })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.empty.back }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("with nothing to review and no known wait it still reads sensibly", () => {
  render(<NoEnergy wait={null} canReview={false} onReview={() => {}} onBack={() => {}} />);
  expect(screen.getByText(fr.energy.empty.later)).toBeInTheDocument();
});
