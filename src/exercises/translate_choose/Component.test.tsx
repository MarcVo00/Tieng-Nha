import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { Component } from "./Component";

const ex = lessonFixture.exercises.find((e) => e.type === "translate_choose")!;
const vocabIndex = new Map(lessonFixture.vocab.map((v) => [v.id, v]));
const tts = new FakeSpeechSynthesizer();
const props = (onAnswer: () => void = () => {}) => ({
  exercise: ex,
  disabled: false,
  onAnswer,
  vocabIndex,
  voiceRate: 1,
  seed: 3,
  services: { tts, stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() },
  capabilities: { tts: true, stt: true, recorder: true },
});

test("renders four Vietnamese options and Vérifier disabled until a selection", async () => {
  renderWithServices(<Component {...props()} />);
  const options = screen.getAllByRole("button", { pressed: false });
  expect(options).toHaveLength(4);
  options.forEach((o) => expect(o.querySelector("[lang=vi]")).not.toBeNull());
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
  await userEvent.click(options[0]!);
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeEnabled();
});

test("key 1 selects the first option and Enter validates it", async () => {
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props(onAnswer)} />);
  const first = screen.getAllByRole("button", { pressed: false })[0]!;
  await userEvent.keyboard("1");
  expect(first).toHaveAttribute("aria-pressed", "true");
  await userEvent.keyboard("{Enter}");
  expect(onAnswer).toHaveBeenCalledWith({ vi: expect.any(String) });
});

test("each option has a speaker button that speaks it", async () => {
  tts.spoken = [];
  renderWithServices(<Component {...props()} />);
  await userEvent.click(screen.getByRole("button", { name: "Écouter\u202f: Cho tui một ly cà phê đen." }));
  expect(tts.spoken).toEqual(["Cho tui một ly cà phê đen."]);
});
