import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createDemoTools } from "@/app/demoTools";
import { useAppState } from "@/app/appState";
import type { Services } from "@/app/services";
import { createFakeServices, FakeDuelGateway, FakeSoundPlayer } from "@/adapters/fakes";
import { createStaticContentSource } from "@/adapters/content";
import { DemoPanel } from "@/features/profile/DemoPanel";
import { SOUND_CUES } from "@/domain/sound";
import { fr } from "@/i18n/fr";
import { ToastViewport } from "@/ui";
import "@/test/routerTestEnv";

function build(demo: boolean) {
  const content = createStaticContentSource();
  const base = createFakeServices({ content });
  const services: Services = {
    ...base,
    env: { ...base.env, VITE_DEMO: demo },
    ...(demo && base.duels instanceof FakeDuelGateway ? { demo: createDemoTools({ duels: base.duels, activity: base.activity, content }) } : {}),
  };
  render(
    <MemoryRouter>
      <ServicesProvider services={services}>
        <ToastViewport />
        <DemoPanel />
      </ServicesProvider>
    </MemoryRouter>,
  );
  return { services, user: userEvent.setup() };
}

test("renders nothing outside demo mode", () => {
  build(false);
  expect(screen.queryByText(fr.demo.title)).toBeNull();
  expect(screen.queryByRole("button", { name: fr.demo.coins })).toBeNull();
});

test("grants xu and Kim bài and refreshes the wallet", async () => {
  const { services, user } = build(true);
  await user.click(screen.getByRole("button", { name: fr.demo.coins }));
  await waitFor(() => expect(useAppState.getState().wallet?.coins).toBe(500));
  await user.click(screen.getByRole("button", { name: fr.demo.kimBai }));
  await waitFor(() => expect(useAppState.getState().wallet?.kimBai).toBe(20));
  expect(await screen.findByText(fr.demo.toast.kimBai)).toBeInTheDocument();
  expect((await services.activity.getWallet()).coins).toBe(500);
});

test("unlocks duels through the normal activity events, then a challenge arrives", async () => {
  const { services, user } = build(true);
  await user.click(screen.getByRole("button", { name: fr.demo.challenge }));
  expect(await screen.findByText(fr.demo.toast.noChallenge)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: fr.demo.unlock }));
  await waitFor(async () => {
    const s = await services.activity.getSnapshot();
    expect(s.lessonsDone).toEqual(expect.arrayContaining(["l01", "l02", "l03"]));
    expect(s.dialoguesDone).toContain("d01");
  });
  expect(useAppState.getState().snapshot?.lessonsDone).toContain("l01");

  expect(await services.duels.list()).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: fr.demo.challenge }));
  await waitFor(async () => {
    const list = await services.duels.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.myRun).toBeNull();
  });
});

test("lists every sound cue to listen to, and tapping one plays it", async () => {
  const { services, user } = build(true);
  if (!(services.sound instanceof FakeSoundPlayer)) throw new Error("expected the fake sound player");
  const list = screen.getByRole("group", { name: fr.demo.sounds });
  expect(within(list).getAllByRole("button")).toHaveLength(SOUND_CUES.length);
  await user.click(within(list).getByRole("button", { name: "heart.lost" }));
  await user.click(within(list).getByRole("button", { name: "lesson.won" }));
  expect(services.sound.played.map((p) => p.cue)).toEqual(["heart.lost", "lesson.won"]);
  expect(services.sound.unlocks).toBeGreaterThan(0);
});

test("has no sound list outside demo mode", () => {
  build(false);
  expect(screen.queryByRole("group", { name: fr.demo.sounds })).toBeNull();
});
