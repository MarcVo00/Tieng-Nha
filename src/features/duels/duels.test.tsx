import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createFakeServices, type FakeSpeechRecognizer } from "@/adapters/fakes";
import { useAppState } from "@/app/appState";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import type { Duel, DuelQuestions, Settings } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { RecognitionError } from "@/ports/Speech";
import { DuelRunScreen } from "@/features/duels";
import { newRecord, pendingKey, readPending, readRun, recordAnswer, runKey, saveRun, unsentDuelIds } from "@/features/duels/duelRunState";

const ID = "duel-1";
const QUESTIONS: DuelQuestions = {
  round1: [
    { lessonId: "l05", exerciseId: "l05_e03" },
    { lessonId: "l05", exerciseId: "l05_e07" },
  ],
  round2: [
    { lessonId: "l05", exerciseId: "l05_e05" },
    { lessonId: "l05", exerciseId: "l05_e08" },
  ],
};
const E03 = { right: "Cho tui một ly cà phê đen.", wrong: "Cho tui một ly trà đá." };
const E07 = { right: "Tính tiền!", wrong: "Ngon quá!" };

const withStt = (stt: boolean): Settings => ({ ...DEFAULT_SETTINGS, capabilities: { tts: true, stt, recorder: false } });
const TIMEOUT = 15_000;

let t = 1_000_000;
const now = () => t;

function renderRun(services: Services = createFakeServices()) {
  render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[`/duel/${ID}/run`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/duel/:id/run" element={<DuelRunScreen now={now} />} />
          <Route path="/duel/:id" element={<p>écran de résultat</p>} />
          <Route path="/duels" element={<p>liste des duels</p>} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return services;
}

// Exact name: the « Écouter : … » button next to each option contains the same text.
const option = (vi: string) => screen.findByRole("button", { name: new RegExp(`^${vi.replace(/[.!?]/g, "\\$&")}$`) });

async function answer(vi: string, afterMs: number) {
  const choice = await option(vi);
  t += afterMs;
  await userEvent.click(choice);
  await userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
}

const next = (text: string) => screen.findByText(text, undefined, { timeout: 3000 });

beforeEach(() => {
  t = 1_000_000;
  useAppState.setState({ settings: withStt(true), profile: { pseudo: "Linh", avatarEmoji: "🐉" } });
  localStorage.clear();
  saveRun(ID, newRecord(QUESTIONS, 7));
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("duel run", () => {
  test(
    "plays round 1, the round-2 intro and round 2 with the time measured from display, then sends and opens the result",
    async () => {
      const services = createFakeServices();
      const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
      (services.stt as FakeSpeechRecognizer).queue.push(["Cho tui một ly trà đá."]);
      renderRun(services);

      expect(await screen.findByText(fr.duels.run.round1)).toBeInTheDocument();
      expect(screen.getByText("1/2")).toBeInTheDocument();
      await answer(E03.right, 1500);
      expect(await screen.findByText(fr.duels.run.critical)).toBeInTheDocument();

      expect(await screen.findByText("2/2", undefined, { timeout: 3000 })).toBeInTheDocument();
      await answer(E07.wrong, 5000);
      expect(await screen.findByText(fr.duels.run.miss)).toBeInTheDocument();

      expect(await screen.findByRole("heading", { name: fr.duels.run.round2Intro.title }, { timeout: 3000 })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: fr.duels.run.round2Intro.start }));
      expect(await screen.findByText(fr.duels.run.round2)).toBeInTheDocument();
      await userEvent.click(await screen.findByRole("button", { name: fr.exercises.speak.micLabel }));
      expect(await screen.findByText(fr.duels.run.hit)).toBeInTheDocument();
      await next("2/2");
      await userEvent.click(await screen.findByRole("button", { name: fr.exercises.speak.micLabel }));

      expect(await screen.findByText("écran de résultat", undefined, { timeout: 3000 })).toBeInTheDocument();
      expect(submit).toHaveBeenCalledWith(
        ID,
        [
          { correct: true, ms: 1500 },
          { correct: false, ms: 5000 },
        ],
        [{ correct: true }, { correct: false }],
      );
      expect(readRun(ID)).toBeNull();
      expect(readPending(ID)).toBeNull();
    },
    TIMEOUT,
  );

  test(
    "a question past 20 s counts as missed",
    async () => {
      const services = createFakeServices();
      const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
      renderRun(services);
      await screen.findByText("1/2");
      await act(async () => {
        t += 20_001;
      });
      expect(await screen.findByText(fr.duels.run.miss, undefined, { timeout: 2000 })).toBeInTheDocument();
      await waitFor(() => expect(readRun(ID)?.round1).toEqual([{ correct: false, ms: 20000 }]));
      expect(submit).not.toHaveBeenCalled();
    },
    TIMEOUT,
  );

  test(
    "a late tap after the cap is a miss even if the answer is right",
    async () => {
      renderRun();
      await screen.findByText("1/2");
      await userEvent.click(await option(E03.right));
      t += 25_000;
      await userEvent.click(screen.getByRole("button", { name: fr.exercises.verify }));
      expect(readRun(ID)?.round1[0]).toEqual({ correct: false, ms: 20000 });
    },
    TIMEOUT,
  );

  test(
    "reload mid-run: the question that was displayed counts missed and the run resumes at the next",
    async () => {
      saveRun(ID, { ...newRecord(QUESTIONS, 7), shownAt: t - 3000 });
      renderRun();
      expect(await screen.findByText("2/2")).toBeInTheDocument();
      expect(readRun(ID)?.round1).toEqual([{ correct: false, ms: 20000 }]);
    },
    TIMEOUT,
  );

  test("without speech recognition the duel does not start", async () => {
    useAppState.setState({ settings: withStt(false) });
    const services = createFakeServices();
    const submit = vi.spyOn(services.duels, "submitRun");
    renderRun(services);
    expect(await screen.findByText(fr.duels.run.noMic.body)).toBeInTheDocument();
    expect(screen.queryByText(fr.duels.run.round1)).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  test(
    "mic lost in round 2: the remaining oral questions are missed and the run is sent",
    async () => {
      saveRun(ID, { ...newRecord(QUESTIONS, 7), round1: [{ correct: true, ms: 4000 }, { correct: true, ms: 4000 }] });
      const services = createFakeServices();
      const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
      (services.stt as FakeSpeechRecognizer).queue.push(new RecognitionError("not-allowed"));
      renderRun(services);
      await userEvent.click(await screen.findByRole("button", { name: fr.duels.run.round2Intro.start }));
      await userEvent.click(await screen.findByRole("button", { name: fr.exercises.speak.micLabel }));
      expect(await screen.findByText("écran de résultat", undefined, { timeout: 3000 })).toBeInTheDocument();
      expect(submit).toHaveBeenCalledWith(ID, [{ correct: true, ms: 4000 }, { correct: true, ms: 4000 }], [{ correct: false }, { correct: false }]);
    },
    TIMEOUT,
  );

  test(
    "offline submit keeps the run, says so, and sends it when the network is back",
    async () => {
      saveRun(ID, {
        ...newRecord(QUESTIONS, 7),
        round1: [{ correct: true, ms: 2000 }, { correct: false, ms: 20000 }],
        round2: [{ correct: true }],
      });
      const services = createFakeServices();
      const submit = vi.spyOn(services.duels, "submitRun").mockRejectedValueOnce(new OfflineError()).mockResolvedValue({ ok: true });
      (services.stt as FakeSpeechRecognizer).queue.push(["Ngon quá!"]);
      renderRun(services);
      await userEvent.click(await screen.findByRole("button", { name: fr.exercises.speak.micLabel }));

      expect(await screen.findByText(fr.duels.run.pendingOffline.title, undefined, { timeout: 3000 })).toBeInTheDocument();
      expect(readPending(ID)).toEqual({
        round1: [{ correct: true, ms: 2000 }, { correct: false, ms: 20000 }],
        round2: [{ correct: true }, { correct: true }],
      });
      expect(localStorage.getItem(pendingKey(ID))).not.toBeNull();

      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(await screen.findByText("écran de résultat")).toBeInTheDocument();
      expect(submit).toHaveBeenCalledTimes(2);
      expect(readPending(ID)).toBeNull();
    },
    TIMEOUT,
  );

  test("a pending run is sent on the next open, without replaying", async () => {
    localStorage.removeItem(runKey(ID));
    localStorage.setItem(pendingKey(ID), JSON.stringify({ round1: [{ correct: true, ms: 1200 }], round2: [{ correct: false }] }));
    const services = createFakeServices();
    const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
    renderRun(services);
    expect(await screen.findByText("écran de résultat")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(ID, [{ correct: true, ms: 1200 }], [{ correct: false }]);
    expect(readPending(ID)).toBeNull();
  });

  test("a new run starts from the duel in the list and is saved locally", async () => {
    localStorage.removeItem(runKey(ID));
    const services = createFakeServices();
    const duel: Duel = {
      id: ID,
      challenger: "someone",
      opponent: "me",
      opponentPseudo: "Linh",
      opponentAvatar: "🐉",
      createdAt: "2026-10-20 08:00:00+00",
      expiresAt: "2999-10-23 08:00:00+00",
      status: "open",
      winner: null,
      seed: 42,
      questions: QUESTIONS,
      myRun: null,
      theirRun: null,
    };
    vi.spyOn(services.duels, "list").mockResolvedValue([duel]);
    renderRun(services);
    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(readRun(ID)?.seed).toBe(42);
  });

  test("an open duel stays playable even if the phone clock says it expired (server status wins, no redirect loop)", async () => {
    localStorage.removeItem(runKey(ID));
    const services = createFakeServices();
    vi.spyOn(services.duels, "list").mockResolvedValue([
      {
        id: ID, challenger: "someone", opponent: "me", opponentPseudo: "Linh", opponentAvatar: "🐉",
        createdAt: "2020-10-20 08:00:00+00", expiresAt: "2020-10-23 08:00:00+00", status: "open", winner: null, seed: 5,
        questions: QUESTIONS, myRun: null, theirRun: null,
      },
    ]);
    renderRun(services);
    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(screen.queryByText("écran de résultat")).not.toBeInTheDocument();
  });

  test("a duel I already played goes straight to the result", async () => {
    localStorage.removeItem(runKey(ID));
    const services = createFakeServices();
    vi.spyOn(services.duels, "list").mockResolvedValue([
      {
        id: ID, challenger: "me", opponent: "x", opponentPseudo: "Linh", opponentAvatar: "🐉",
        createdAt: "2026-10-20 08:00:00+00", expiresAt: "2999-10-23 08:00:00+00", status: "open", winner: null, seed: 1,
        questions: QUESTIONS, myRun: { round1: [], round2: [], damage: 0, timeMs: 0, reward: null, claimed: false }, theirRun: null,
      },
    ]);
    renderRun(services);
    expect(await screen.findByText("écran de résultat")).toBeInTheDocument();
  });
});

describe("duel run, hardening", () => {
  const FINISHED = { round1: [{ correct: true, ms: 2000 }, { correct: false, ms: 20000 }], round2: [{ correct: true }, { correct: false }] };

  test("a non-network error is not « offline »: error state, run kept, retry works", async () => {
    saveRun(ID, { ...newRecord(QUESTIONS, 7), ...FINISHED });
    const services = createFakeServices();
    const submit = vi.spyOn(services.duels, "submitRun").mockRejectedValueOnce(new Error("not_authenticated")).mockResolvedValue({ ok: true });
    renderRun(services);
    expect(await screen.findByText(fr.duels.run.sendError.title)).toBeInTheDocument();
    expect(screen.queryByText(fr.duels.run.pendingOffline.title)).not.toBeInTheDocument();
    expect(readPending(ID)).toEqual(FINISHED);
    await userEvent.click(screen.getByRole("button", { name: fr.duels.run.pendingOffline.retry }));
    expect(await screen.findByText("écran de résultat")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(2);
  });

  test("an OfflineError still shows the offline state", async () => {
    saveRun(ID, { ...newRecord(QUESTIONS, 7), ...FINISHED });
    const services = createFakeServices();
    vi.spyOn(services.duels, "submitRun").mockRejectedValue(new OfflineError());
    renderRun(services);
    expect(await screen.findByText(fr.duels.run.pendingOffline.title)).toBeInTheDocument();
  });

  test("a negative elapsed time (clock moved back) is a miss at the cap, not a 0 ms answer", () => {
    const rec = recordAnswer(newRecord(QUESTIONS, 7), true, -500);
    expect(rec.round1).toEqual([{ correct: false, ms: 20000 }]);
    expect(recordAnswer(newRecord(QUESTIONS, 7), true, Number.NaN).round1).toEqual([{ correct: false, ms: 20000 }]);
  });

  test("unsentDuelIds lists pending and fully answered runs only, and readUnsent gives their payload", async () => {
    const { readUnsent } = await import("@/features/duels/duelRunState");
    localStorage.clear();
    saveRun("a", newRecord(QUESTIONS, 1)); // in progress: not unsent
    saveRun("b", { ...newRecord(QUESTIONS, 1), ...FINISHED }); // finished, never sent
    localStorage.setItem(pendingKey("c"), JSON.stringify(FINISHED));
    localStorage.setItem(pendingKey("d"), "not json");
    localStorage.setItem("other", "x");
    expect(unsentDuelIds().sort()).toEqual(["b", "c"]);
    expect(readUnsent("b")).toEqual(FINISHED);
    expect(readUnsent("c")).toEqual(FINISHED);
    expect(readUnsent("a")).toBeNull();
  });

  test(
    "the same duel seed shows the same answer order on every mount",
    async () => {
      const order = async () => {
        await screen.findByText("1/2");
        await option(E03.right);
        return screen
          .getAllByRole("button", { pressed: false })
          .map((b) => b.textContent ?? "");
      };
      renderRun();
      const first = await order();
      cleanup();
      saveRun(ID, newRecord(QUESTIONS, 7));
      renderRun();
      expect(await order()).toEqual(first);
      expect(first).toHaveLength(4);
    },
    TIMEOUT,
  );

  test(
    "a round-2 question past 30 s counts as missed",
    async () => {
      saveRun(ID, { ...newRecord(QUESTIONS, 7), round1: [{ correct: true, ms: 4000 }, { correct: true, ms: 4000 }] });
      renderRun();
      await userEvent.click(await screen.findByRole("button", { name: fr.duels.run.round2Intro.start }));
      await screen.findByRole("button", { name: fr.exercises.speak.micLabel });
      await act(async () => {
        t += 29_000;
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });
      expect(screen.queryByText(fr.duels.run.miss)).not.toBeInTheDocument();
      await act(async () => {
        t += 1_500;
      });
      expect(await screen.findByText(fr.duels.run.miss, undefined, { timeout: 2000 })).toBeInTheDocument();
      await waitFor(() => expect(readRun(ID)?.round2).toEqual([{ correct: false }]));
    },
    TIMEOUT,
  );
});
