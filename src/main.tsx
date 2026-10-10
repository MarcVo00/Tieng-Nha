import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/styles/index.css";
import { parseEnv, shouldRefuseFakes } from "@/app/env";
import { fr } from "@/i18n/fr";
import { createServices } from "@/app/container";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createAppRouter } from "@/app/router";
import { MotionRoot } from "@/ui";

const env = parseEnv(import.meta.env);
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

if (
  shouldRefuseFakes({
    prod: import.meta.env.PROD,
    useFakes: env.VITE_USE_FAKES,
    hostname: window.location.hostname,
  })
) {
  // A public build must never run on fakes: refuse to start rather than pretend to sync.
  console.error("VITE_USE_FAKES=true in a production build on a public host: refusing to start.");
  createRoot(root).render(
    <main
      role="alert"
      className="flex min-h-screen flex-col items-start justify-center gap-2 bg-surface p-6 text-ink"
    >
      <h1 className="text-title">{fr.app.fakesGuard.title}</h1>
      <p className="text-body">{fr.app.fakesGuard.body}</p>
    </main>,
  );
} else {
  start(root);
}

function start(root: HTMLElement): void {
  const services = createServices(env);
  createRoot(root).render(
    <StrictMode>
      <ServicesProvider services={services}>
        <MotionRoot>
          <RouterProvider router={createAppRouter()} />
        </MotionRoot>
      </ServicesProvider>
    </StrictMode>,
  );
}
