import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon-180x180.png", "icons/icon.svg"],
      manifest: {
        name: "Tiếng Nhà",
        short_name: "Tiếng Nhà",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F6F0E4",
        theme_color: "#A3201C",
        icons: [
          { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        // Voice packs are tens of MB: fetched on demand (see runtimeCaching), never precached.
        globIgnores: ["audio/**"],
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
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
