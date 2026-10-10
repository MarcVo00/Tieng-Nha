import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ToneMark, Hearts, ConfirmDialog, FeedbackSheet, ProgressBar } from "@/ui";

test("Button shows loading state and is disabled", () => {
  render(<Button loading>Valider</Button>);
  expect(screen.getByRole("button", { name: /valider/i })).toBeDisabled();
});
test("ToneMark never relies on colour alone", () => {
  render(<ToneMark tone="sac" showName />);
  expect(screen.getByText("sắc")).toBeInTheDocument();
  expect(screen.getByText("´")).toBeInTheDocument();
});
test("Hearts exposes remaining count to assistive tech", () => {
  render(<Hearts count={2} max={3} />);
  expect(screen.getByLabelText("2 vies sur 3")).toBeInTheDocument();
});
test("ConfirmDialog with requireText only enables confirm when typed", async () => {
  const onConfirm = vi.fn();
  render(<ConfirmDialog open title="Supprimer ?" confirmLabel="Supprimer" cancelLabel="Annuler" requireText="SUPPRIMER" danger onConfirm={onConfirm} onCancel={() => {}} />);
  const confirm = screen.getByRole("button", { name: "Supprimer" });
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByRole("textbox"), "SUPPRIMER");
  await userEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalled();
});
test("FeedbackSheet announces result and continues", async () => {
  const onContinue = vi.fn();
  render(<FeedbackSheet open correct={false} expected="Cho tui một ly trà đá." onContinue={onContinue} />);
  expect(screen.getByRole("status")).toHaveTextContent(/pas tout à fait/i);
  expect(screen.getByText("Cho tui một ly trà đá.")).toHaveAttribute("lang", "vi");
  await userEvent.click(screen.getByRole("button", { name: /continuer/i }));
  expect(onContinue).toHaveBeenCalled();
});
test("ProgressBar exposes progressbar role", () => {
  render(<ProgressBar value={0.5} label="Progression" />);
  expect(screen.getByRole("progressbar", { name: "Progression" })).toHaveAttribute("aria-valuenow", "50");
});

test("Toast store shows a status message", async () => {
  const { useToast, ToastViewport } = await import("@/ui");
  function Harness() {
    const { show } = useToast();
    return (
      <>
        <button onClick={() => show({ title: "Badge débloqué" })}>go</button>
        <ToastViewport />
      </>
    );
  }
  render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "go" }));
  expect(screen.getByRole("status")).toHaveTextContent("Badge débloqué");
});
