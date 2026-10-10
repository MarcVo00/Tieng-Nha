import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppState } from "@/app/appState";

export function AuthGate({ children }: { children?: ReactNode }) {
  const session = useAppState((s) => s.session);
  const profile = useAppState((s) => s.profile);
  const onboardingDone = useAppState((s) => s.settings.onboardingDone);
  if (!session || !profile || !onboardingDone) return <Navigate to="/welcome" replace />;
  return children;
}
