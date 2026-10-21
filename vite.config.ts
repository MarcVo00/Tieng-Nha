import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA, type ManifestOptions } from "vite-plugin-pwa";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

// Android paints an installed app's navigation bar with the manifest colours, and a manifest holds one colour only:
// one manifest per theme, picked before first paint by the inline script in index.html (and by ThemeController).
// Values are --color-surface of each theme, so the bar continues the tab bar.
const MANIFEST_COLORS = {
  light: { background_color: "#FFFBF3", theme_color: "#FFFBF3" },
  dark: { background_color: "#1F1916", theme_color: "#1F1916" },
} as const;

const manifest: Partial<ManifestOptions> = {
  name: "Tiếng Nhà",
  short_name: "Tiếng Nhà",
  id: "/",
  description: "Le vietnamien du Sud, en famille.",
  categories: ["education"],
  lang: "fr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  ...MANIFEST_COLORS.light,
  icons: [
    { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

/** Emits the dark manifest and drops the plugin's own manifest link: index.html declares a swappable one. */
function themedManifests(): Plugin {
  return {
    name: "tn-themed-manifests",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler: (html) => html.replace(/<link rel="manifest" href="[^"]*">/g, ""),
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest-dark.webmanifest", source: JSON.stringify({ ...manifest, ...MANIFEST_COLORS.dark }) });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon-180x180.png", "icons/icon.svg"],
      manifest,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        // Voice packs are tens of MB: fetched on demand (see runtimeCaching), never precached.
        globIgnores: ["audio/**"],
        // First install takes control of the page, so the first-session voice prefetch goes through the cache. No skipWaiting: updates still wait for the prompt.
        clientsClaim: true,
        navigateFallback: "/index.html",
        runtimeCaching: [
          { urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: "NetworkOnly" },
          // The manifest changes when a pack is regenerated: serve the cached copy at once, refresh it for next time.
          { urlPattern: /\/audio\/manifest\.json$/, handler: "StaleWhileRevalidate", options: { cacheName: "audio-manifest" } },
          // MP3 names are content hashes, so a cached file never goes stale. Safari's audio element needs range support.
          {
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: "CacheFirst",
            options: { cacheName: "audio", expiration: { maxEntries: 3000 }, cacheableResponse: { statuses: [200] }, rangeRequests: true },
          },
        ],
      },
    }),
    themedManifests(),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
