import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithServices } from "@/test/renderWithServices";
import { useAppState } from "@/app/appState";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { tagalogLessonFixtures, tagalogDialogueFixtures } from "@/adapters/fakes/seed/tagalog";
import { VocabDeck } from "@/features/lessons/VocabDeck";
import { DialogueScreen } from "@/features/conversation";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";
import { Pron } from "@/ui";
import type { Speak } from "@/domain/types";

const lesson = tagalogLessonFixtures[0]!;
const salamat = lesson.vocab.find((v) => v.id === "tl_v_salamat")!;

beforeEach(() => {
  useAppState.setState({ snapshot: null, settings: { ...DEFAULT_SETTINGS, language: "tl" } });
});
afterEach(() => {
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS } });
});

test("Pron renders nothing without text, and a non-tagged labelled caption with it", () => {
  const { container, rerender } = renderWithServices(<Pron />);
  expect(container).toBeEmptyDOMElement();
  rerender(<Pron text="sa·LA·mat" />);
  const el = screen.getByLabelText("Prononciation\u202f: sa·LA·mat");
  expect(el).toHaveTextContent("sa·LA·mat");
  expect(el).not.toHaveAttribute("lang");
});

test("the vocab deck shows the word as Tagalog, with its pronunciation under it", () => {
  renderWithServices(<VocabDeck vocab={[salamat]} voiceRate={1} ttsEnabled={false} onReport={() => {}} onStart={() => {}} />);
  const word = screen.getByText("salamat", { selector: "p" });
  expect(word).toHaveAttribute("lang", "tl");
  expect(screen.getByText("sa·LA·mat")).toBeInTheDocument();
});

test("a word without pron shows no pronunciation caption", () => {
  const kumusta = lesson.vocab.find((v) => v.id === "tl_v_kumusta")!;
  renderWithServices(<VocabDeck vocab={[kumusta]} voiceRate={1} ttsEnabled={false} onReport={() => {}} onStart={() => {}} />);
  expect(screen.queryByLabelText(/Prononciation/)).not.toBeInTheDocument();
});

test("the feedback sheet of a speak exercise shows its pronunciation and the Tagalog text", async () => {
  const speak = lesson.exercises.find((e): e is Speak => e.type === "speak" && e.pron !== undefined)!;
  const vocabIndex = new Map(lesson.vocab.map((v) => [v.id, v]));
  renderWithServices(
    <ExerciseHost
      exercise={speak}
      mode="practice"
      lang="tl"
      vocabIndex={vocabIndex}
      capabilities={{ tts: true, stt: false, recorder: false }}
      voiceRate={1}
      services={{ tts: new FakeSpeechSynthesizer(), stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() }}
      onResult={() => {}}
    />,
  );
  await userEvent.click(await screen.findByRole("button", { name: /passer/i }));
  const sheet = within(await screen.findByRole("dialog"));
  expect(await sheet.findByLabelText("Prononciation\u202f: sa·LA·mat po")).toBeInTheDocument();
  expect(sheet.getByText("Salamat po.")).toHaveAttribute("lang", "tl");
});

test("a Tagalog lesson exercise speaks with the Tagalog language, its replay too", async () => {
  const listen = lesson.exercises.find((e) => e.type === "listen_choose")!;
  const vocabIndex = new Map(lesson.vocab.map((v) => [v.id, v]));
  const tts = new FakeSpeechSynthesizer();
  renderWithServices(
    <ExerciseHost
      exercise={listen}
      mode="practice"
      lang="tl"
      vocabIndex={vocabIndex}
      capabilities={{ tts: true, stt: false, recorder: false }}
      voiceRate={1}
      services={{ tts, stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() }}
      onResult={() => {}}
    />,
  );
  await waitFor(() => expect(tts.spoken).toHaveLength(1)); // auto-play
  expect(tts.lastOptions?.language).toBe("tl");
});

test("a dialogue shows the pronunciation under each Tagalog line, with lang tl", async () => {
  expect(tagalogDialogueFixtures[0]).toBeDefined();
  renderWithServices(
    <Routes>
      <Route path="/dialogue/:id" element={<DialogueScreen />} />
    </Routes>,
    { route: "/dialogue/tl_d01" },
  );
  const npc = await screen.findByText("Kumusta ka?", {}, { timeout: 5000 });
  expect(npc).toHaveAttribute("lang", "tl");
  expect(await screen.findByLabelText("Prononciation\u202f: ku·MUS·ta ka")).toBeInTheDocument();
  const option = await screen.findByText("Mabuti, salamat.", {}, { timeout: 5000 });
  expect(option).toHaveAttribute("lang", "tl");
  await waitFor(() => expect(screen.getByLabelText("Prononciation\u202f: ma·BU·ti sa·LA·mat")).toBeInTheDocument());
});
