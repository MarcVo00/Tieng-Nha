import { act, cleanup, render } from "@testing-library/react";
import { createFakeServices, type FakeGachaGateway } from "@/adapters/fakes";
import { GachaSync } from "@/app/GachaSync";
import { ServicesProvider } from "@/app/ServicesProvider";
import { addPendingPull, readPendingPulls, useRecoveredPulls } from "@/app/useGachaPulls";
import { fr } from "@/i18n/fr";
import { useToastStore } from "@/ui/Toast";

const THEME = "legendes_sombres";
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const setup = () => {
  const services = createFakeServices({}, { gachaRng: () => 0 });
  const gacha = services.gacha as FakeGachaGateway;
  const mount = () =>
    render(
      <ServicesProvider services={services}>
        <GachaSync />
      </ServicesProvider>,
    );
  return { services, gacha, mount };
};

beforeEach(() => {
  localStorage.clear();
  useRecoveredPulls.setState({ recovered: [] });
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

test("at start, claims an unclaimed pull, announces « Tirage récupéré » once and exposes it in the store", async () => {
  const { services, gacha, mount } = setup();
  await services.activity.demoGrant(100, 0);
  await gacha.pull("lost", THEME, 1);
  mount();
  await flush();
  expect((await services.activity.getWallet()).coins).toBe(60);
  expect(useRecoveredPulls.getState().recovered.map((p) => p.id)).toEqual(["lost"]);
  expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual([fr.gacha.recovered]);
  expect(fr.gacha.recovered).toBe("Tirage récupéré");
});

test("re-sends a pending pull at start", async () => {
  const { services, gacha, mount } = setup();
  await services.activity.demoGrant(100, 0);
  addPendingPull({ id: "p1", theme: THEME, count: 1 });
  const pull = vi.spyOn(gacha, "pull");
  mount();
  await flush();
  expect(pull).toHaveBeenCalledWith("p1", THEME, 1);
  expect(readPendingPulls()).toEqual([]);
  expect(useRecoveredPulls.getState().recovered.map((p) => p.id)).toEqual(["p1"]);
});

test("nothing to recover: no notice; the next `online` recovers what appeared while offline", async () => {
  const { services, gacha, mount } = setup();
  await services.activity.demoGrant(100, 0);
  mount();
  await flush();
  expect(useToastStore.getState().toasts).toEqual([]);
  await gacha.pull("late", THEME, 1);
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(useRecoveredPulls.getState().recovered.map((p) => p.id)).toEqual(["late"]);
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(useToastStore.getState().toasts).toHaveLength(1); // once per pull
});

test("offline at start is quiet and retried when the network returns", async () => {
  const { services, gacha, mount } = setup();
  await services.activity.demoGrant(100, 0);
  await gacha.pull("lost", THEME, 1);
  gacha.online = false;
  mount();
  await flush();
  expect(useRecoveredPulls.getState().recovered).toEqual([]);
  gacha.online = true;
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(useRecoveredPulls.getState().recovered.map((p) => p.id)).toEqual(["lost"]);
});

test("a recovery that finishes after the component unmounted still announces and exposes what it claimed", async () => {
  const { services, gacha, mount } = setup();
  await services.activity.demoGrant(100, 0);
  await gacha.pull("lost", THEME, 1);
  const real = gacha.list.bind(gacha);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  vi.spyOn(gacha, "list").mockImplementation(async () => {
    await gate;
    return real();
  });
  const view = mount();
  await flush();
  view.unmount();
  release();
  await flush();
  expect((await services.activity.getWallet()).coins).toBe(60); // claimed
  expect(useRecoveredPulls.getState().recovered.map((p) => p.id)).toEqual(["lost"]);
  expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual([fr.gacha.recovered]);
});
