import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { Component } from "./Component";

const ex = { id: "e", type: "word_order" as const, fr: "Un café au lait glacé, s'il te plaît.", tokensVi: ["Cho", "tui", "ly", "ly"], extraTokens: ["đen"] };
const props = (onAnswer: () => void = () => {}) => ({
  exercise: ex,
  disabled: false,
  onAnswer,
  services: { tts: new FakeSpeechSynthesizer(), stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() },
  vocabIndex: new Map(),
  voiceRate: 1,
  seed: 5,
  capabilities: { tts: true, stt: true, recorder: true },
});
const bank = () => within(screen.getByRole("group", { name: "Mots disponibles" }));
const line = () => within(screen.getByRole("group", { name: "Ta phrase" }));

test("shows the French sentence, all tiles in the bank (including extras) and Vérifier disabled", () => {
  renderWithServices(<Component {...props()} />);
  expect(screen.getByText(ex.fr)).toBeInTheDocument();
  expect(bank().getAllByRole("button")).toHaveLength(5);
  bank().getAllByRole("button").forEach((b) => expect(b).toHaveAttribute("lang", "vi"));
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
});

test("clicking tiles builds the answer in click order, duplicates included", async () => {
  const onAnswer = vi.fn();
  renderWithServices(<Component {...props(onAnswer)} />);
  await userEvent.click(bank().getByRole("button", { name: "tui" }));
  const lys = bank().getAllByRole("button", { name: "ly" });
  expect(lys).toHaveLength(2);
  await userEvent.click(lys[0]!);
  await userEvent.click(bank().getByRole("button", { name: "ly" }));
  await userEvent.click(bank().getByRole("button", { name: "Cho" }));
  expect(line().getAllByRole("button").map((b) => b.textContent)).toEqual(["tui", "ly", "ly", "Cho"]);
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(onAnswer).toHaveBeenCalledWith({ tokens: ["tui", "ly", "ly", "Cho"] });
});

test("clicking an answer tile returns it to the bank", async () => {
  renderWithServices(<Component {...props()} />);
  await userEvent.click(bank().getByRole("button", { name: "Cho" }));
  expect(bank().queryByRole("button", { name: "Cho" })).not.toBeInTheDocument();
  await userEvent.click(line().getByRole("button", { name: "Cho" }));
  expect(bank().getByRole("button", { name: "Cho" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
});

test("disabled disables the tiles and Vérifier", () => {
  renderWithServices(<Component {...props()} disabled />);
  bank().getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
});
