import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Services } from "@/app/services";
import { useAppState } from "@/app/appState";

const ServicesContext = createContext<Services | null>(null);

/** Hands the services down, with `content` pointing at the source of the active language. */
export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  const language = useAppState((s) => s.settings.language) ?? "vi";
  const value = useMemo<Services>(() => {
    const content = services.contents?.[language] ?? services.content;
    return content === services.content ? services : { ...services, content };
  }, [services, language]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}
