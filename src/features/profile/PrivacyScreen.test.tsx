import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { PrivacyScreen } from "@/features/profile";
import { fr } from "@/i18n/fr";
import "@/test/routerTestEnv";

function show(contact: string | null | Error) {
  const services = createFakeServices();
  services.auth.getPrivacyContact = async () => {
    if (contact instanceof Error) throw contact;
    return contact;
  };
  render(
    <ServicesProvider services={services}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PrivacyScreen />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

test("it names the contact of the group", async () => {
  show("Marc, marc@test.fr");
  expect(await screen.findByText(fr.privacy.who.body("Marc, marc@test.fr"))).toBeInTheDocument();
  for (const s of fr.privacy.sections) expect(screen.getByRole("heading", { name: s.title })).toBeInTheDocument();
});

test("offline, or without a contact, it points to whoever invited you", async () => {
  show(new Error("offline"));
  expect(await screen.findByText(fr.privacy.who.fallback)).toBeInTheDocument();
});
