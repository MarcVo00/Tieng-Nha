import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { UpdatePrompt } from "@/app/UpdatePrompt";
import { LAUNCH_WINDOW_MS } from "@/app/swUpdates";
import "@/test/routerTestEnv";

const update = vi.fn(() => Promise.resolve());
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [true, () => {}], updateServiceWorker: update }),
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  update.mockClear();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});
afterEach(() => vi.useRealTimers());

test("takes a version found right after the app opens", () => {
  render(<MemoryRouter initialEntries={["/"]}><UpdatePrompt /></MemoryRouter>);
  expect(update).toHaveBeenCalledWith(true);
});

test("never reloads during a lesson, even in the background", () => {
  render(<MemoryRouter initialEntries={["/lesson/l01"]}><UpdatePrompt /></MemoryRouter>);
  setVisibility("hidden");
  expect(update).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).toBeNull();
});

test("while the app is in use, shows the prompt and applies once the app goes to the background", async () => {
  vi.useFakeTimers();
  const now = Date.now();
  vi.setSystemTime(now - LAUNCH_WINDOW_MS - 1000);
  const router = createMemoryRouter([{ path: "*", element: <UpdatePrompt /> }], { initialEntries: ["/lesson/l01"] });
  render(<RouterProvider router={router} />);
  vi.setSystemTime(now);
  await act(() => router.navigate("/me"));
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeInTheDocument();
  setVisibility("hidden");
  expect(update).toHaveBeenCalledTimes(1);
});
