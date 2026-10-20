import { render, screen } from "@testing-library/react";
import { WaterDropHp } from "@/ui/WaterDropHp";

test("shows the HP as segmented water drops with a progressbar name and value", () => {
  render(<WaterDropHp value={12} max={15} label="PV de Thủy Tinh : 12 sur 15" />);
  const bar = screen.getByRole("progressbar", { name: "PV de Thủy Tinh : 12 sur 15" });
  expect(bar).toHaveAttribute("aria-valuenow", "12");
  expect(bar).toHaveAttribute("aria-valuemax", "15");
  expect(bar.querySelectorAll("[data-drop]")).toHaveLength(15);
  expect(bar.querySelectorAll("[data-drop='full']")).toHaveLength(12);
  expect(bar.querySelectorAll("[data-drop='empty']")).toHaveLength(3);
});

test("a lost drop detaches: it leaves the row, the others stay", () => {
  const { rerender, container } = render(<WaterDropHp value={15} max={15} label="PV" />);
  rerender(<WaterDropHp value={14} max={15} label="PV" />);
  expect(container.querySelectorAll("[data-drop='empty']")).toHaveLength(1);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "14");
});

test("a decorative row is hidden from assistive tech", () => {
  const { container } = render(<WaterDropHp value={15} max={15} decorative />);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
});
