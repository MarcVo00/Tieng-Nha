import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { Component } from "./Component";

const ex = { id: "e", type: "tone_pick" as const, syllable: "đá", answerTone: "sac" as const };
const props = (over: { onAnswer?: () => void; disabled?: boolean; tts?: FakeSpeechSynthesizer } = {}) => ({
  exercise: ex,
  disabled: over.disabled ?? false,
  onAnswer: over.onAnswer ?? (() => {}),
  services: { tts: over.tts ?? new FakeSpeechSynthesizer(), stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() },
  vocabIndex: new Map(),
  voiceRate: 1,
  seed: 1,
  capabilities: { tts: true, stt: true, recorder: true },
});

test("shows the toneless syllable and six tone buttons in order", () => {
  renderWithServices(<Component {...props()} />);
  expect(screen.getByText("đa")).toHaveAttribute("lang", "vi");
  for (const name of ["ngang", "huyền", "sắc", "hỏi", "ngã", "nặng"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  }
});

test("selecting a tone then Vérifier answers with it", async () => {
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props({ onAnswer })} />);
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "sắc" }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(onAnswer).toHaveBeenCalledWith({ tone: "sac" });
});

test("key 3 selects sắc and Enter validates", async () => {
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props({ onAnswer })} />);
  await userEvent.keyboard("3");
  await userEvent.keyboard("{Enter}");
  expect(onAnswer).toHaveBeenCalledWith({ tone: "sac" });
});

test("speaks the full syllable once on mount and cancels on unmount", () => {
  const tts = new FakeSpeechSynthesizer();
  const cancel = vi.spyOn(tts, "cancel");
  renderWithServices(<Component {...props({ tts })} />).unmount();
  expect(tts.spoken).toEqual(["đá"]);
  expect(cancel).toHaveBeenCalled();
});

test("a rejecting tts.speak causes no unhandled rejection", async () => {
  class FailingTts extends FakeSpeechSynthesizer {
    override async speak(): Promise<void> {
      throw new Error("tts down");
    }
  }
  renderWithServices(<Component {...props({ tts: new FailingTts() })} />);
  await userEvent.click(screen.getByRole("button", { name: /^écouter$/i }));
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
});

test("after the answer the correct tone shows success and the wrong pick shows error", async () => {
  function Harness() {
    const [done, setDone] = useState(false);
    return <Component {...props({ disabled: done })} onAnswer={() => setDone(true)} />;
  }
  renderWithServices(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "huyền" }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(screen.getByRole("button", { name: "sắc" }).className).toContain("border-success");
  expect(screen.getByRole("button", { name: "huyền" }).className).toContain("border-error");
  expect(screen.getByRole("button", { name: "ngã" }).className).not.toMatch(/border-(success|error)/);
});

test("the tone recap sheet lists the six descriptions", async () => {
  renderWithServices(<Component {...props()} />);
  await userEvent.click(screen.getByRole("button", { name: "Rappel des tons" }));
  const dialog = await screen.findByRole("dialog", { name: "Rappel des tons" });
  expect(dialog).toHaveTextContent("monte vers l'aigu");
  expect(dialog).toHaveTextContent("bref, tombe et s'arrête");
});
