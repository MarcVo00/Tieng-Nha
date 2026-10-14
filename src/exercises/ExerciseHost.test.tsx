import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { getPlugin } from "@/exercises/registry";
import type { Exercise } from "@/domain/types";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";

const vocabIndex = new Map(lessonFixture.vocab.map((v) => [v.id, v]));
const ex = lessonFixture.exercises.find((e) => e.type === "listen_choose")!; // answer v_ca_phe_sua_da
const translate = lessonFixture.exercises.find((e) => e.type === "translate_choose")!;
const tts = new FakeSpeechSynthesizer();
const base = {
  vocabIndex,
  capabilities: { tts: true, stt: true, recorder: true },
  voiceRate: 1,
  services: { tts, stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() },
};

beforeEach(() => {
  tts.spoken = [];
});

test("practice: shows feedback then reports the result on Continuer", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /café au lait glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/đúng rồi/i);
  expect(onResult).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /continuer/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
});

test("practice: a double tap on Continuer emits one result", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /café au lait glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  await screen.findByRole("status");
  await userEvent.dblClick(screen.getByRole("button", { name: /continuer/i }));
  expect(onResult).toHaveBeenCalledTimes(1);
});

test("practice: a wrong answer shows the expected answer", async () => {
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /thé glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/pas tout à fait/i);
  expect(screen.getByText("cà phê sữa đá", { selector: "p" })).toHaveAttribute("lang", "vi");
});

test("exam: reports immediately without feedback", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="exam" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /thé glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("exam: a second submit of the same exercise is ignored", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="exam" onResult={onResult} />);
  await userEvent.keyboard("1{Enter}{Enter}");
  expect(onResult).toHaveBeenCalledTimes(1);
});

test("listen_choose auto-plays the word", async () => {
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={() => {}} />);
  await screen.findByRole("button", { name: /vérifier/i });
  expect(base.services.tts.spoken).toContain("cà phê sữa đá");
});

test("translate_choose works through the host", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={translate} mode="exam" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /^cho tui một ly cà phê đen\.$/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
});

test("getPlugin throws a clear error for an unregistered type", () => {
  expect(() => getPlugin("bogus" as never)).toThrow(/no exercise plugin registered for type "bogus"/i);
});

test("a new exercise starts with a clean state", async () => {
  const onResult = vi.fn();
  const { rerender } = renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={onResult} />);
  await userEvent.keyboard("1");
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(await screen.findByRole("status")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /continuer/i }));
  rerender(<ExerciseHost {...base} exercise={translate} mode="practice" onResult={onResult} />);
  expect(await screen.findByRole("button", { name: /^cho tui một ly cà phê đen\.$/i })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("the same exercise can be answered again with a new attempt", async () => {
  const onResult = vi.fn();
  const { rerender } = renderWithServices(<ExerciseHost {...base} exercise={ex} mode="exam" onResult={onResult} />);
  await userEvent.keyboard("1{Enter}");
  expect(onResult).toHaveBeenCalledTimes(1);
  rerender(<ExerciseHost {...base} exercise={ex} mode="exam" attempt={1} onResult={onResult} />);
  await screen.findByRole("button", { name: /vérifier/i });
  expect(screen.getByRole("button", { name: /vérifier/i })).toBeDisabled();
  await userEvent.keyboard("2{Enter}");
  expect(onResult).toHaveBeenCalledTimes(2);
});

test("a word_order exercise (layout-animated tiles) leaves so the next exercise can enter", async () => {
  const wordOrder = lessonFixture.exercises.find((e) => e.type === "word_order");
  if (wordOrder?.type !== "word_order") throw new Error("fixture has no word_order exercise");
  // Like the lesson player: the parent swaps the exercise as soon as the result is reported.
  function Sequence() {
    const [current, setCurrent] = useState<Exercise>(wordOrder as Exercise);
    return <ExerciseHost {...base} exercise={current} mode="practice" onResult={() => setCurrent(translate)} />;
  }
  renderWithServices(<Sequence />);
  const bank = () => within(screen.getByRole("group", { name: /mots disponibles/i }));
  for (const token of wordOrder.tokensVi) await userEvent.click(bank().getByRole("button", { name: token }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  await userEvent.click(await screen.findByRole("button", { name: /continuer/i }));
  expect(await screen.findByRole("button", { name: /^cho tui một ly cà phê đen\.$/i })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: /mots disponibles/i })).not.toBeInTheDocument();
});

test("answer positions are drawn again for each run, so they cannot be learnt by heart", () => {
  if (translate.type !== "translate_choose") throw new Error("fixture changed");
  const choices = [translate.answerVi, ...translate.distractorsVi];
  const orders = new Set<string>();
  for (let run = 0; run < 12; run++) {
    const view = renderWithServices(<ExerciseHost {...base} exercise={translate} mode="practice" onResult={() => undefined} />);
    const shown = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    orders.add(choices.map((vi) => shown.findIndex((t) => t.includes(vi))).join(","));
    view.unmount();
  }
  expect(orders.size).toBeGreaterThan(1);
});
