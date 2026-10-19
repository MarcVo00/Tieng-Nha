import { act, cleanup, render } from "@testing-library/react";
import { createFakeServices } from "@/adapters/fakes";
import { ServicesProvider } from "@/app/ServicesProvider";
import type { Services } from "@/app/services";
import { OfflineError } from "@/domain/errors";
import type { DuelQuestions } from "@/domain/types";
import { DuelSync } from "@/features/duels";
import { newRecord, pendingKey, recordAnswer, runKey, saveRun } from "@/features/duels/duelRunState";

const QUESTIONS: DuelQuestions = {
  round1: [{ lessonId: "l01", exerciseId: "a" }],
  round2: [{ lessonId: "l01", exerciseId: "b" }],
};
const RUN = { round1: [{ correct: true, ms: 1200 }], round2: [{ correct: true }] };

const mount = (services: Services) =>
  render(
    <ServicesProvider services={services}>
      <DuelSync />
    </ServicesProvider>,
  );
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

test("sends every unsent run at start and clears the local records", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
  localStorage.setItem(pendingKey("a"), JSON.stringify(RUN));
  // A fully answered in-progress record counts as unsent too.
  let rec = newRecord(QUESTIONS, 1);
  rec = recordAnswer(rec, true, 1200);
  rec = recordAnswer(rec, true, 0);
  saveRun("b", rec);
  mount(services);
  await flush();
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit).toHaveBeenCalledWith("a", RUN.round1, RUN.round2);
  expect(localStorage.length).toBe(0);
});

test("does nothing when nothing is unsent", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun");
  saveRun("half", newRecord(QUESTIONS, 1)); // not finished: not ours to send
  mount(services);
  await flush();
  expect(submit).not.toHaveBeenCalled();
  expect(localStorage.getItem(runKey("half"))).not.toBeNull();
});

test("already_submitted and not_open mean there is nothing left to send", async () => {
  const services = createFakeServices();
  vi.spyOn(services.duels, "submitRun").mockResolvedValueOnce({ ok: false, error: "already_submitted" }).mockResolvedValueOnce({ ok: false, error: "not_open" });
  localStorage.setItem(pendingKey("a"), JSON.stringify(RUN));
  localStorage.setItem(pendingKey("b"), JSON.stringify(RUN));
  mount(services);
  await flush();
  expect(localStorage.length).toBe(0);
});

test("offline: stays quiet, keeps the runs, stops, and retries when the network comes back", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun").mockRejectedValueOnce(new OfflineError()).mockResolvedValue({ ok: true });
  localStorage.setItem(pendingKey("a"), JSON.stringify(RUN));
  localStorage.setItem(pendingKey("b"), JSON.stringify(RUN));
  mount(services);
  await flush();
  expect(submit).toHaveBeenCalledTimes(1); // the first failure stopped the pass
  expect(localStorage.getItem(pendingKey("a"))).not.toBeNull();
  expect(localStorage.getItem(pendingKey("b"))).not.toBeNull();

  window.dispatchEvent(new Event("online"));
  await flush();
  expect(submit).toHaveBeenCalledTimes(3);
  expect(localStorage.length).toBe(0);
});

test("another refusal keeps the run and does not loop", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: false, error: "bad_run" });
  localStorage.setItem(pendingKey("a"), JSON.stringify(RUN));
  mount(services);
  await flush();
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(pendingKey("a"))).not.toBeNull();
});

test("an unexpected error keeps that run and moves on to the next one", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun").mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ ok: true });
  localStorage.setItem(pendingKey("a"), JSON.stringify(RUN));
  localStorage.setItem(pendingKey("b"), JSON.stringify(RUN));
  mount(services);
  await flush();
  expect(submit).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(pendingKey("a"))).not.toBeNull();
  expect(localStorage.getItem(pendingKey("b"))).toBeNull();
});

test("stops listening to the network when unmounted", async () => {
  const services = createFakeServices();
  const submit = vi.spyOn(services.duels, "submitRun").mockResolvedValue({ ok: true });
  const view = mount(services);
  await flush();
  view.unmount();
  localStorage.setItem(pendingKey("late"), JSON.stringify(RUN));
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(submit).not.toHaveBeenCalled();
});
