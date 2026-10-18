import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Avatar, BadgeMedal, Button, Sheet, ToneMark, Hearts, ConfirmDialog, FeedbackSheet, ProgressBar } from "@/ui";

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

describe("modal focus", () => {
  test("ConfirmDialog moves focus in, Escape cancels, focus returns on close", async () => {
    const onCancel = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <ConfirmDialog open={open} title="Sûr ?" confirmLabel="Oui" cancelLabel="Non" onConfirm={() => {}} onCancel={() => { onCancel(); setOpen(false); }} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    await userEvent.click(opener);
    expect(screen.getByRole("alertdialog")).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });
  test("Sheet traps Tab inside and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="Feuille" onClose={onClose}>
        <button>a</button>
        <button>b</button>
      </Sheet>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "a" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "a" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "b" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Avatar frames", () => {
  const ringOf = (el: HTMLElement) => el.className;
  test("each known frame renders a 3 px ring in its colour", () => {
    const { container } = render(
      <>
        <Avatar emoji="🐯" frame="frame_bronze" />
        <Avatar emoji="🐯" frame="frame_jade" />
        <Avatar emoji="🐯" frame="frame_son_mai" />
      </>,
    );
    const [bronze, jade, sonMai] = Array.from(container.querySelectorAll<HTMLElement>("span"));
    expect(ringOf(bronze!)).toContain("ring-frame-bronze");
    expect(ringOf(bronze!)).toContain("ring-[3px]");
    expect(ringOf(jade!)).toContain("ring-frame-jade");
    expect(ringOf(sonMai!)).toContain("ring-frame-sonmai");
    expect(ringOf(sonMai!)).toContain("border-ink");
    expect(bronze).toHaveAttribute("aria-hidden", "true");
  });
  test("a frame wins over the ring prop", () => {
    const { container } = render(<Avatar emoji="🐯" ring="gold" frame="frame_jade" />);
    expect(ringOf(container.firstElementChild as HTMLElement)).not.toContain("ring-gold");
  });
  test("null or unknown frames leave the avatar unchanged", () => {
    const { container } = render(
      <>
        <Avatar emoji="🐯" ring="gold" frame={null} />
        <Avatar emoji="🐯" ring="gold" frame="frame_unknown" />
        <Avatar emoji="🐯" ring="gold" />
      </>,
    );
    const [a, b, c] = Array.from(container.querySelectorAll<HTMLElement>("span"));
    expect(ringOf(a!)).toBe(ringOf(c!));
    expect(ringOf(b!)).toBe(ringOf(c!));
    expect(ringOf(a!)).toContain("ring-gold");
  });
});

describe("Profile effects", () => {
  test("Avatar with fx_embers renders the effect layer", () => {
    const { container } = render(<Avatar emoji="🐯" fx="fx_embers" />);
    const layer = container.querySelector('[data-fx="fx_embers"]');
    expect(layer).not.toBeNull();
    expect(layer?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
  test("Avatar with an unknown fx renders no effect layer", () => {
    const { container } = render(
      <>
        <Avatar emoji="🐯" fx="fx_unknown" />
        <Avatar emoji="🐯" fx={null} />
      </>,
    );
    expect(container.querySelector("[data-fx]")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });
  test("each known effect draws its own shapes", () => {
    const { container } = render(
      <>
        <Avatar emoji="🐯" fx="fx_ink" />
        <Avatar emoji="🐯" fx="fx_lightning" />
        <Avatar emoji="🐯" fx="fx_embers" />
      </>,
    );
    const counts = ["fx_ink", "fx_lightning", "fx_embers"].map((id) => container.querySelectorAll(`[data-fx="${id}"] svg ${id === "fx_embers" ? "circle" : "g[transform]"}`).length);
    expect(counts[0]).toBe(3);
    expect(counts[1]).toBe(3);
    expect(counts[2]).toBe(8);
  });
  test("BadgeMedal shows the reward caption", () => {
    render(<BadgeMedal icon="☕" title="Premier café" unlocked reward="+ Cadre jade" />);
    expect(screen.getByText("+ Cadre jade")).toBeInTheDocument();
  });
  test("BadgeMedal without reward shows no caption", () => {
    render(<BadgeMedal icon="☕" title="Premier café" unlocked />);
    expect(screen.queryByText(/Cadre/)).toBeNull();
  });
});
