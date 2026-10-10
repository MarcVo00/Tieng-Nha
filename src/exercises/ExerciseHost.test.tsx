import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { getPlugin } from "@/exercises/registry";
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
  expect(() => getPlugin("speak")).toThrow(/no exercise plugin registered for type "speak"/i);
});
