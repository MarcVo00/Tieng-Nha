import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProfileFx } from "@/ui";

// Own file: motion caches the reduced-motion preference on first use, so the media query must be set before any render.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

test("ProfileFx under reduced motion renders static", () => {
  const { container } = render(
    <>
      <ProfileFx id="fx_ink"><span>a</span></ProfileFx>
      <ProfileFx id="fx_lightning"><span>b</span></ProfileFx>
      <ProfileFx id="fx_embers"><span>c</span></ProfileFx>
    </>,
  );
  expect(container.querySelectorAll("svg")).toHaveLength(3);
  expect(container.querySelector("[data-fx-motion]")).toBeNull();
});
