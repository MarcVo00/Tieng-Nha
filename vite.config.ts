import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/apple-touch-icon-180x180.png", "icons/icon.svg"],
      manifest: {
        name: "VietLearn",
        short_name: "VietLearn",
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
        navigateFallback: "/index.html",
        runtimeCaching: [{ urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: "NetworkOnly" }],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
