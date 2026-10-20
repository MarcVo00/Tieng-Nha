import { render } from "@testing-library/react";
import { Button, DropNumber } from "@/ui";

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

test("reduced motion: no glint when the primary button becomes enabled", () => {
  const { rerender, container } = render(<Button disabled>Valider</Button>);
  rerender(<Button>Valider</Button>);
  expect(container.querySelector("button > span[aria-hidden]")).toBeNull();
});

test("reduced motion: a changed balance is rendered in place, no drop-in start state", () => {
  const { rerender, getByText } = render(<DropNumber>120 xu</DropNumber>);
  rerender(<DropNumber>80 xu</DropNumber>);
  expect(getByText("80 xu").style.opacity).not.toBe("0");
});
