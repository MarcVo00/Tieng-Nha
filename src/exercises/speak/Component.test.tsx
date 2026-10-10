import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { RecognitionError } from "@/ports";
import type { Exercise } from "@/domain/types";

const ex = { id: "sp1", type: "speak" as const, vi: "Cho tui một ly trà đá.", fr: "Je voudrais un thé glacé.", vocabIds: ["v_tra_da"] } satisfies Extract<Exercise, { type: "speak" }>;

function setup(caps: { tts?: boolean; stt?: boolean; recorder?: boolean } = {}) {
  const stt = new FakeSpeechRecognizer();
  const onResult = vi.fn();
  const onCapabilityLost = vi.fn();
  const services = { tts: new FakeSpeechSynthesizer(), stt, recorder: new FakeVoiceRecorder() };
  renderWithServices(
    <ExerciseHost
      exercise={ex}
      mode="exam"
      vocabIndex={new Map()}
      capabilities={{ tts: caps.tts ?? true, stt: caps.stt ?? true, recorder: caps.recorder ?? true }}
      voiceRate={1}
      services={services}
      onResult={onResult}
      onCapabilityLost={onCapabilityLost}
    />,
  );
  return { stt, onResult, onCapabilityLost };
}

beforeEach(() => {
  // jsdom has no object URLs
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() }));
});
afterEach(() => vi.unstubAllGlobals());

test("recognised speech is sent as alternatives", async () => {
  const { stt, onResult } = setup();
  stt.queue = [["cho tui một ly trà đá"]];
  await userEvent.click(screen.getByRole("button", { name: /parler/i }));
  await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, score: 1, vocabIds: ["v_tra_da"] }));
});

test("two no-speech errors offer self-assessment", async () => {
  const { stt, onResult } = setup();
  stt.queue = [new RecognitionError("no-speech"), new RecognitionError("no-speech")];
  const mic = () => screen.getByRole("button", { name: /parler/i });
  await userEvent.click(mic());
  expect(await screen.findByText(/je n'ai rien entendu/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /auto-évaluer/i })).not.toBeInTheDocument();
  await userEvent.click(mic());
  await userEvent.click(await screen.findByRole("button", { name: /m'auto-évaluer/i }));
  // now in recorder mode: record, then self-assess
  await userEvent.click(screen.getByRole("button", { name: /parler/i }));
  await userEvent.click(await screen.findByRole("button", { name: /à retravailler/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ selfAssessed: true, correct: false }));
});

test("not-allowed switches to recorder and reports capability loss", async () => {
  const { stt, onResult, onCapabilityLost } = setup();
  stt.queue = [new RecognitionError("not-allowed")];
  await userEvent.click(screen.getByRole("button", { name: /parler/i }));
  await vi.waitFor(() => expect(onCapabilityLost).toHaveBeenCalledWith("stt"));
  expect(await screen.findByText(/micro est refusé/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /parler/i }));
  expect(await screen.findByText(/ma voix/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /modèle/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /j'ai bien dit/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ selfAssessed: true, correct: true }));
});

test("no capability at all offers skip", async () => {
  const { onResult } = setup({ tts: false, stt: false, recorder: false });
  await userEvent.click(screen.getByRole("button", { name: /passer/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ skipped: true, correct: false }));
});
