import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { createFakeServices } from "@/adapters/fakes";
import { useAppState } from "@/app/appState";
import { FocusLayout } from "@/app/layouts/FocusLayout";
import { ServicesProvider, useServices } from "@/app/ServicesProvider";
import { useLanguage } from "@/app/useLanguage";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import "@/test/routerTestEnv";

let mounts = 0;
let setLang: ReturnType<typeof useLanguage>["setLanguage"];
let langState: { id: string; chosen: boolean };

function Probe() {
  const { content } = useServices();
  const { language, chosen, setLanguage } = useLanguage();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    mounts += 1;
  }, []);
  useEffect(() => {
    let alive = true;
    void content.listLessons().then((l) => alive && setIds(l.map((x) => x.id)));
    return () => {
      alive = false;
    };
  }, [content]);
  setLang = setLanguage;
  langState = { id: language.id, chosen };
  return <p data-testid="ids">{ids.join(",")}</p>;
}

function setup() {
  mounts = 0;
  useAppState.setState({ settings: { ...DEFAULT_SETTINGS } });
  const services = createFakeServices();
  const router = createMemoryRouter([{ element: <FocusLayout />, children: [{ path: "/", element: <Probe /> }] }]);
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return services;
}

test("without a saved language the app is Vietnamese and the choice is not made", async () => {
  setup();
  await waitFor(() => expect(screen.getByTestId("ids").textContent).toMatch(/^l\d+/));
  expect(langState).toEqual({ id: "vi", chosen: false });
  expect(screen.getByTestId("ids").textContent).not.toContain("tl_l01");
});

test("setLanguage('tl') persists, swaps the content and remounts the routed screen", async () => {
  const services = setup();
  await waitFor(() => expect(screen.getByTestId("ids").textContent).toMatch(/^l\d+/));
  expect(mounts).toBe(1);
  await act(async () => {
    await setLang("tl");
  });
  expect((await services.progress.getSettings()).language).toBe("tl");
  await waitFor(() => expect(screen.getByTestId("ids").textContent).toContain("tl_l01"));
  expect(mounts).toBe(2);
  expect(langState).toEqual({ id: "tl", chosen: true });
});
