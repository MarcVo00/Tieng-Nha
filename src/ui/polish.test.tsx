import { render, screen } from "@testing-library/react";
import { Button, DropNumber, SectionTitle } from "@/ui";

test("SectionTitle keeps a level-2 heading with the plain accessible name and hides the decoration", () => {
  const { container } = render(
    <section aria-labelledby="t">
      <SectionTitle id="t" overline="Huy hiệu">Badges</SectionTitle>
    </section>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Badges" })).toHaveAttribute("id", "t");
  expect(screen.getByRole("region", { name: "Badges" })).toBeInTheDocument();
  expect(screen.getByText("Huy hiệu")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("Huy hiệu")).toHaveAttribute("lang", "vi");
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

test("disabled primary button is greyed (not red) and keeps its disabled semantics", () => {
  render(<Button disabled>Valider</Button>);
  const b = screen.getByRole("button", { name: "Valider" });
  expect(b).toBeDisabled();
  expect(b.className).toContain("bg-surface-2");
  expect(b.className).toContain("text-ink-muted");
  expect(b.className).not.toContain("bg-primary");
  expect(b.className).not.toContain("disabled:opacity-50");
});

test("primary button glints once when it becomes enabled, not on first render nor on re-renders", () => {
  const { rerender, container } = render(<Button disabled>Valider</Button>);
  expect(container.querySelector("button span[aria-hidden]")).toBeNull();
  rerender(<Button>Valider</Button>);
  expect(container.querySelectorAll("button > span[aria-hidden]")).toHaveLength(1);
  rerender(<Button>Valider</Button>);
  expect(container.querySelectorAll("button > span[aria-hidden]")).toHaveLength(1);
});

test("every enable gives a fresh glint (enable, disable, enable)", () => {
  const { rerender, container } = render(<Button disabled>Valider</Button>);
  rerender(<Button>Valider</Button>);
  const first = container.querySelector("button > span[aria-hidden]");
  expect(first).not.toBeNull();
  rerender(<Button disabled>Valider</Button>);
  rerender(<Button>Valider</Button>);
  const second = container.querySelector("button > span[aria-hidden]");
  expect(second).not.toBeNull();
  expect(second).not.toBe(first);
});

test("an enabled-from-start button never glints", () => {
  const { container } = render(<Button>Valider</Button>);
  expect(container.querySelector("button > span[aria-hidden]")).toBeNull();
});

test("DropNumber renders its text and re-renders with the new value", () => {
  const { rerender } = render(<DropNumber>120 xu</DropNumber>);
  expect(screen.getByText("120 xu")).toBeInTheDocument();
  rerender(<DropNumber>80 xu</DropNumber>);
  expect(screen.getByText("80 xu")).toBeInTheDocument();
  expect(screen.getByText("80 xu").style.opacity).toBe("0"); // drop-in starts invisible, above its resting place
  expect(screen.queryByText("120 xu")).toBeNull();
});
