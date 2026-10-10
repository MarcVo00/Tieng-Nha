import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/styles/index.css";
import { parseEnv } from "@/app/env";
import { createServices } from "@/app/container";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createAppRouter } from "@/app/router";
import { MotionRoot } from "@/ui";

const env = parseEnv(import.meta.env);
const services = createServices(env);
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <MotionRoot>
        <RouterProvider router={createAppRouter()} />
      </MotionRoot>
    </ServicesProvider>
  </StrictMode>,
);
