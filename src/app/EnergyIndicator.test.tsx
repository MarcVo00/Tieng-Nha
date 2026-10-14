import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { EnergyIndicator } from "@/app/EnergyIndicator";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";

const NOW = "2026-10-14T10:00:00.000Z";
const IN_2H14 = new Date(Date.parse(NOW) + (2 * 60 + 14) * 60_000).toISOString();

function renderIndicator() {
  render(
    <ServicesProvider services={createFakeServices({ clock: () => NOW })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EnergyIndicator />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

afterEach(() => act(() => useAppState.setState({ energy: null, dueCount: 0 })));

test("opens the explanation sheet with the countdown and a review link", async () => {
  useAppState.setState({ energy: { current: 3, max: 5, nextAt: IN_2H14 }, dueCount: 4 });
  renderIndicator();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.label(3, 5) }));
  const dialog = await screen.findByRole("dialog", { name: fr.energy.title });
  expect(dialog).toHaveTextContent(fr.energy.explain);
  expect(dialog).toHaveTextContent(fr.energy.next(2, 14));
  expect(screen.getByRole("link", { name: fr.energy.review })).toHaveAttribute("href", "/review");
  expect(dialog).toHaveTextContent(fr.energy.label(3, 5));
});

test("hides the review link when no word is due", async () => {
  useAppState.setState({ energy: { current: 3, max: 5, nextAt: IN_2H14 }, dueCount: 0 });
  renderIndicator();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.label(3, 5) }));
  await screen.findByRole("dialog", { name: fr.energy.title });
  expect(screen.queryByRole("link", { name: fr.energy.review })).toBeNull();
});

test("says the energy is full when nothing is refilling", async () => {
  useAppState.setState({ energy: { current: 5, max: 5, nextAt: null } });
  renderIndicator();
  await userEvent.click(screen.getByRole("button", { name: fr.energy.label(5, 5) }));
  expect(await screen.findByText(fr.energy.full)).toBeInTheDocument();
});

test("renders nothing while energy is unknown", () => {
  useAppState.setState({ energy: null });
  renderIndicator();
  expect(screen.queryByRole("button")).toBeNull();
});
