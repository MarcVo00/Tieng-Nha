import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppState } from "@/app/appState";

/**
 * Signed-in, onboarded players only. Until a language is chosen they land on `/languages` (`languageOptional` lets
 * the picker itself through).
 */
export function AuthGate({ children, languageOptional = false }: { children?: ReactNode; languageOptional?: boolean }) {
  const session = useAppState((s) => s.session);
  const profile = useAppState((s) => s.profile);
  const onboardingDone = useAppState((s) => s.settings.onboardingDone);
  const languageChosen = useAppState((s) => s.settings.language !== null);
  if (!session || !profile || !onboardingDone) return <Navigate to="/welcome" replace />;
  if (!languageChosen && !languageOptional) return <Navigate to="/languages" replace />;
  return children;
}
