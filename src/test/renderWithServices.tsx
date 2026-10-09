import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { createFakeServices } from "@/adapters/fakes";

export function renderWithServices(
  ui: ReactElement,
  opts: { services?: Partial<Services>; route?: string } & Omit<RenderOptions, "wrapper"> = {},
) {
  const { services: overrides, route, ...renderOpts } = opts;
  const services = createFakeServices(overrides);
  const result = render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[route ?? "/"]}>{ui}</MemoryRouter>
    </ServicesProvider>,
    renderOpts,
  );
  return { ...result, services };
}
