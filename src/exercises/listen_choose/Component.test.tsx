import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { Component } from "./Component";

const ex = lessonFixture.exercises.find((e) => e.type === "listen_choose")!;
const vocabIndex = new Map(lessonFixture.vocab.map((v) => [v.id, v]));
const props = (over: { tts?: boolean; onAnswer?: () => void } = {}) => ({
  exercise: ex,
  disabled: false,
  onAnswer: over.onAnswer ?? (() => {}),
  services: { tts: new FakeSpeechSynthesizer(), stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() },
  vocabIndex,
  voiceRate: 1,
  seed: 7,
  capabilities: { tts: over.tts ?? true, stt: true, recorder: true },
});

test("renders four French options and Vérifier disabled until a selection", async () => {
  renderWithServices(<Component {...props()} />);
  const options = screen.getAllByRole("button", { pressed: false });
  expect(options).toHaveLength(4);
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
  await userEvent.click(options[0]!);
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeEnabled();
});

test("key 1 selects the first option and Enter validates it", async () => {
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props({ onAnswer })} />);
  const first = screen.getAllByRole("button", { pressed: false })[0]!;
  await userEvent.keyboard("1");
  expect(first).toHaveAttribute("aria-pressed", "true");
  await userEvent.keyboard("{Enter}");
  expect(onAnswer).toHaveBeenCalledWith({ vocabId: expect.any(String) });
});

test("without TTS the Vietnamese word is shown with a caption", () => {
  renderWithServices(<Component {...props({ tts: false })} />);
  expect(screen.getByText("cà phê sữa đá")).toHaveAttribute("lang", "vi");
  expect(screen.getByText(/pas de voix vietnamienne/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^écouter$/i })).not.toBeInTheDocument();
});

test("Enter on a focused speaker button does not submit the selection", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent); // jsdom lacks it; motion's keyboard press handler needs it
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props({ onAnswer })} />);
  await userEvent.keyboard("1");
  const speaker = screen.getByRole("button", { name: /^écouter$/i });
  speaker.focus();
  fireEvent.keyDown(speaker, { key: "Enter" });
  expect(onAnswer).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("a rejecting tts.speak causes no unhandled rejection", async () => {
  class FailingTts extends FakeSpeechSynthesizer {
    override async speak(): Promise<void> {
      throw new Error("tts down");
    }
  }
  const p = props();
  renderWithServices(<Component {...p} services={{ ...p.services, tts: new FailingTts() }} />);
  await userEvent.click(screen.getByRole("button", { name: /^écouter$/i }));
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
});

test("cancels speech on unmount", () => {
  const p = props();
  const cancel = vi.spyOn(p.services.tts, "cancel");
  renderWithServices(<Component {...p} />).unmount();
  expect(cancel).toHaveBeenCalled();
});
