import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InAppBrowserNotice } from "@/features/onboarding/InAppBrowserNotice";

const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const originalUa = navigator.userAgent;

function stubUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

beforeEach(() => localStorage.clear());
afterEach(() => stubUserAgent(originalUa));

test("Samsung Internet is sent to Chrome, with the reason", () => {
  stubUserAgent(SAMSUNG);
  render(<InAppBrowserNotice />);
  expect(screen.getByText("Pour installer Tiếng Nhà, passe par Chrome")).toBeInTheDocument();
  expect(screen.getByText(/Samsung Internet installe l'app dans un format que Google Play Protect bloque/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ouvrir dans Chrome" })).toBeInTheDocument();
});

test("nothing is shown in Chrome", () => {
  stubUserAgent(CHROME);
  const { container } = render(<InAppBrowserNotice dismissible />);
  expect(container).toBeEmptyDOMElement();
});

test("a dismissible notice stays hidden once the user chose Plus tard", async () => {
  stubUserAgent(SAMSUNG);
  const { unmount } = render(<InAppBrowserNotice dismissible />);
  await userEvent.click(screen.getByRole("button", { name: "Plus tard" }));
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  unmount();
  render(<InAppBrowserNotice dismissible />);
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
});
