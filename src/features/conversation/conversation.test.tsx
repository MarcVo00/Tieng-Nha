import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices, FakeSpeechRecognizer, FakeSpeechSynthesizer } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import { useAppState } from "@/app/appState";
import type { BadgeDef } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { RecognitionError } from "@/ports";
import { DialogueScreen } from "@/features/conversation";
import { TYPING_MS } from "@/features/conversation/useDialogue";

const SLOW = { timeout: 5000 };
const HOME = "page d'accueil";

const REWARD_BADGE: BadgeDef = { id: "streak_7", title: "Une semaine", description: "7 jours d'affilée.", icon: "🏮", rule: { kind: "streak", gte: 7 }, coins: 60, reward: "frame_bronze" };

function setup(opts: { strict?: boolean; noCoins?: boolean; badge?: boolean } = {}) {
  const stt = new FakeSpeechRecognizer();
  const tts = new FakeSpeechSynthesizer();
  const services = createFakeServices({ stt, tts });
  const realCompleteDialogue = services.activity.completeDialogue.bind(services.activity);
  const completeDialogue = vi.spyOn(services.activity, "completeDialogue");
  if (opts.noCoins) completeDialogue.mockImplementation(async (i) => ({ ...(await realCompleteDialogue(i)), coinsGained: 0 }));
  if (opts.badge) completeDialogue.mockImplementation(async (i) => ({ ...(await realCompleteDialogue(i)), newBadges: [REWARD_BADGE] }));
  const tree = (
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={["/dialogue/d05"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<p>{HOME}</p>} />
          <Route path="/dialogue/:id" element={<DialogueScreen />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>
  );
  const view = render(opts.strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...view, services, stt, tts, completeDialogue };
}

const optionButton = (name: RegExp) => screen.findByRole("button", { name }, SLOW);

beforeEach(() => {
  useAppState.setState({ snapshot: null });
});

describe("energy", () => {
  it("opening a dialogue spends exactly 1 energy, even under StrictMode", async () => {
    const { services } = setup({ strict: true });
    await screen.findByText("Commander au café");
    expect((await services.activity.getEnergy()).current).toBe(4);
  });

  it("a dialogue that fails to load spends nothing", async () => {
    const services = createFakeServices({ stt: new FakeSpeechRecognizer(), tts: new FakeSpeechSynthesizer() });
    vi.spyOn(services.content, "getDialogue").mockRejectedValueOnce(new Error("offline"));
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={["/dialogue/d05"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/dialogue/:id" element={<DialogueScreen />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByText(fr.conversation.loadError.title)).toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(5);
  });

  it("replaying a finished dialogue spends 1 more energy", async () => {
    const { services } = setup();
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await userEvent.click(await optionButton(/Cảm ơn em/));
    expect((await services.activity.getEnergy()).current).toBe(4);
    await userEvent.click(await screen.findByRole("button", { name: fr.conversation.done.replay }, SLOW));
    await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW);
    expect((await services.activity.getEnergy()).current).toBe(3);
  });

  it("with no energy left it shows the empty panel and no conversation", async () => {
    const services = createFakeServices({ stt: new FakeSpeechRecognizer(), tts: new FakeSpeechSynthesizer() });
    for (let i = 0; i < 5; i++) await services.activity.startSession("lesson", "l05");
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={["/dialogue/d05"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/dialogue/:id" element={<DialogueScreen />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByText(fr.energy.empty.title)).toBeInTheDocument();
    expect(screen.queryByText("Commander au café")).not.toBeInTheDocument();
    expect((await services.activity.getEnergy()).current).toBe(0);
  });
});

describe("DialogueScreen", () => {
  it("shows the scene, then plays the opening line after the typing indicator", async () => {
    const { tts } = setup();
    expect(await screen.findByText("Commander au café")).toBeInTheDocument();
    expect(await screen.findByRole("status", { name: fr.conversation.typing })).toBeInTheDocument();
    expect(await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW)).toBeInTheDocument();
    await waitFor(() => expect(tts.spoken).toContain("Chào bạn! Bạn uống gì?"));
    await waitFor(() => expect(screen.queryByRole("status", { name: fr.conversation.typing })).not.toBeInTheDocument());
  });

  it.each([
    { noCoins: false, shown: true },
    { noCoins: true, shown: false },
  ])("shows the coin line only when coins were earned (noCoins: $noCoins)", async ({ noCoins, shown }) => {
    setup({ noCoins });
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await userEvent.click(await optionButton(/Cảm ơn em/));
    await screen.findByRole("button", { name: fr.conversation.done.home }, SLOW);
    if (shown) expect(screen.getByText(/^\+\d+ xu$/)).toBeInTheDocument();
    else expect(screen.queryByText(/ xu$/)).not.toBeInTheDocument();
  });

  it("shows the reward of a newly unlocked badge", async () => {
    setup({ badge: true });
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await userEvent.click(await optionButton(/Cảm ơn em/));
    expect(await screen.findByText(fr.rewards.gained("cadre", "Bronze"), undefined, SLOW)).toBeInTheDocument();
  });

  it("reveals the French translation on demand", async () => {
    setup();
    await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.translate }));
    const hide = await screen.findByRole("button", { name: fr.conversation.hideTranslation });
    expect(hide).toHaveTextContent("Bonjour ! Tu bois quoi ?");
  });

  it("walks the whole dialogue by tapping and shows the XP result once", async () => {
    const { tts, completeDialogue } = setup();
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await screen.findByText("Dạ, bạn đợi chút nha.", undefined, SLOW);
    expect(tts.spoken).toContain("Cho tui một ly cà phê sữa đá."); // the tapped option is voiced
    await userEvent.click(await optionButton(/Cảm ơn em/));
    await screen.findByText("Của bạn đây. Ngon lắm nha!", undefined, SLOW);
    expect(await screen.findByText("+15", undefined, SLOW)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.conversation.done.home })).toBeInTheDocument();
    expect(completeDialogue).toHaveBeenCalledTimes(1);
    expect(completeDialogue).toHaveBeenCalledWith({ dialogueId: "d05", durationMs: expect.any(Number) });
  });

  it("selects the matching option from a spoken answer", async () => {
    const { stt } = setup();
    stt.queue = [["cho tui một ly trà đá"]];
    await screen.findByRole("button", { name: /Cho tui một ly trà đá/ }, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.speakHint }));
    await screen.findByText("Dạ, bạn đợi chút nha.", undefined, SLOW);
    const log = screen.getByRole("log");
    expect(within(log).getByText("Cho tui một ly trà đá.")).toBeInTheDocument();
  });

  it("asks the learner to retry when the speech matches nothing", async () => {
    const { stt } = setup();
    stt.queue = [["blah blah"]];
    await screen.findByRole("button", { name: /Cho tui một ly trà đá/ }, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.speakHint }));
    expect(await screen.findByText(fr.conversation.misunderstood)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cho tui một ly cà phê sữa đá/ })).toBeEnabled();
  });

  it("shows an inline retry message when nothing was heard", async () => {
    const { stt } = setup();
    stt.queue = [new RecognitionError("no-speech")];
    await screen.findByRole("button", { name: /Cho tui một ly trà đá/ }, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.speakHint }));
    expect(await screen.findByText(fr.conversation.notHeard)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.conversation.speakHint })).toBeInTheDocument();
  });

  it("turns the capability off and falls back to tapping when the mic is denied", async () => {
    const { stt } = setup();
    stt.queue = [new RecognitionError("not-allowed")];
    await screen.findByRole("button", { name: /Cho tui một ly trà đá/ }, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.speakHint }));
    expect(await screen.findByText(fr.conversation.micDenied)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: fr.conversation.speakHint })).not.toBeInTheDocument());
    expect(useAppState.getState().settings.capabilities?.stt).toBe(false);
    expect(screen.getByRole("button", { name: /Cho tui một ly trà đá/ })).toBeEnabled();
  });

  it("answers only once when options are tapped twice in a row", async () => {
    const { services } = setup();
    const answer = vi.spyOn(services.conversation, "answer");
    const first = await optionButton(/Cho tui một ly cà phê sữa đá/);
    const second = screen.getByRole("button", { name: /Cho tui một ly trà đá/ });
    await userEvent.click(first);
    await userEvent.click(second);
    await screen.findByText("Dạ, bạn đợi chút nha.", undefined, SLOW);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("replays from the start with a second, single completion", async () => {
    // The fake voice is instant, so the wall-clock cost is the NPC typing indicator (TYPING_MS per line, ~12 lines
    // over two runs). Collapse exactly that delay; every other timer keeps its real duration.
    const realSetTimeout = globalThis.setTimeout;
    const timers = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
      realSetTimeout(fn, ms === TYPING_MS ? 0 : ms, ...args)) as typeof setTimeout);
    onTestFinished(() => timers.mockRestore());
    const { completeDialogue } = setup();
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await userEvent.click(await optionButton(/Cảm ơn em/));
    await userEvent.click(await screen.findByRole("button", { name: fr.conversation.done.replay }, SLOW));
    await waitFor(() => expect(screen.queryByText("Của bạn đây. Ngon lắm nha!")).not.toBeInTheDocument());
    expect(await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW)).toBeInTheDocument();
    await userEvent.click(await optionButton(/Cho tui một ly trà đá/));
    await userEvent.click(await optionButton(/Dạ, cảm ơn/));
    await screen.findByRole("button", { name: fr.conversation.done.home }, SLOW);
    expect(completeDialogue).toHaveBeenCalledTimes(2);
  });

  it("stops speech and timers on unmount without touching state afterwards", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount, tts, stt } = setup();
    const cancelTts = vi.spyOn(tts, "cancel");
    const abortStt = vi.spyOn(stt, "abort");
    await screen.findByRole("status", { name: fr.conversation.typing });
    unmount();
    expect(cancelTts).toHaveBeenCalled();
    expect(abortStt).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 800));
    expect(tts.spoken).toHaveLength(0);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("offers a retry when the dialogue cannot load", async () => {
    const services = createFakeServices();
    vi.spyOn(services.content, "getDialogue").mockRejectedValue(new Error("offline"));
    render(
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={["/dialogue/d05"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/dialogue/:id" element={<DialogueScreen />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByText(fr.conversation.loadError.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.app.error.retry })).toBeInTheDocument();
  });

  it("asks for confirmation before leaving with the close button", async () => {
    setup();
    await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW);
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.quit.aria }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.quit.cancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText(HOME)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.conversation.quit.aria }));
    await userEvent.click(await screen.findByRole("button", { name: fr.conversation.quit.confirm }));
    expect(await screen.findByText(HOME)).toBeInTheDocument();
  });

  it("restarts cleanly in the middle of a reveal", async () => {
    const { completeDialogue } = setup();
    await userEvent.click(await optionButton(/Cho tui một ly cà phê sữa đá/));
    await screen.findByText("Dạ, bạn đợi chút nha.", undefined, SLOW);
    await userEvent.click(await optionButton(/Cảm ơn em/));
    await userEvent.click(await screen.findByRole("button", { name: fr.conversation.done.replay }, SLOW));
    // Restart while the first line is still being revealed.
    expect(await screen.findByRole("status", { name: fr.conversation.typing })).toBeInTheDocument();
    expect(screen.queryByText("Của bạn đây. Ngon lắm nha!")).not.toBeInTheDocument();
    expect(await screen.findByText("Chào bạn! Bạn uống gì?", undefined, SLOW)).toBeInTheDocument();
    expect(screen.getAllByText("Chào bạn! Bạn uống gì?")).toHaveLength(1);
    expect(completeDialogue).toHaveBeenCalledTimes(1);
  });
});
