import { useEffect } from "react";
import { THEME_KEY } from "@/domain/storageKeys";
import { useAppState } from "@/app/appState";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLOR = { dark: "#15110F", light: "#F6F0E4" } as const; // --color-bg of each theme

export function ThemeController() {
  const theme = useAppState((s) => s.settings.theme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
    };
    apply();
    try {
      // Read by the inline script in index.html to avoid a flash on next start.
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this session.
    }
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
