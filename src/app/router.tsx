import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AuthGate } from "@/app/AuthGate";
import { FeatureErrorBoundary } from "@/app/FeatureErrorBoundary";
import { NotFound } from "@/app/NotFound";
import { Root } from "@/app/Root";
import { FocusLayout } from "@/app/layouts/FocusLayout";
import { TabLayout } from "@/app/layouts/TabLayout";
import { Skeleton } from "@/ui";
// Side effect only: starts capturing `beforeinstallprompt` at boot while the onboarding screens stay lazy.
import "@/features/onboarding/installPrompt";

const WelcomeScreen = lazy(() => import("@/features/onboarding").then((m) => ({ default: m.WelcomeScreen })));
const AuthCallbackScreen = lazy(() => import("@/features/onboarding").then((m) => ({ default: m.AuthCallbackScreen })));
const HomeScreen = lazy(() => import("@/features/home").then((m) => ({ default: m.HomeScreen })));
const ReviewScreen = lazy(() => import("@/features/review").then((m) => ({ default: m.ReviewScreen })));
const ReviewRunScreen = lazy(() => import("@/features/review").then((m) => ({ default: m.ReviewRunScreen })));
const LeaderboardScreen = lazy(() => import("@/features/leaderboard").then((m) => ({ default: m.LeaderboardScreen })));
const PublicProfileScreen = lazy(() => import("@/features/leaderboard").then((m) => ({ default: m.PublicProfileScreen })));
const ShopScreen = lazy(() => import("@/features/shop").then((m) => ({ default: m.ShopScreen })));
const MeScreen = lazy(() => import("@/features/profile").then((m) => ({ default: m.MeScreen })));
const LessonScreen = lazy(() => import("@/features/lessons").then((m) => ({ default: m.LessonScreen })));
const LessonDoneScreen = lazy(() => import("@/features/lessons").then((m) => ({ default: m.LessonDoneScreen })));
const DialogueScreen = lazy(() => import("@/features/conversation").then((m) => ({ default: m.DialogueScreen })));
const ExamIntroScreen = lazy(() => import("@/features/exam").then((m) => ({ default: m.ExamIntroScreen })));
const ExamRunScreen = lazy(() => import("@/features/exam").then((m) => ({ default: m.ExamRunScreen })));
const ExamResultScreen = lazy(() => import("@/features/exam").then((m) => ({ default: m.ExamResultScreen })));

function screen(Screen: ComponentType): ReactNode {
  return (
    <FeatureErrorBoundary>
      <Suspense fallback={<Skeleton lines={4} />}>
        <Screen />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

const tabRoutes: RouteObject[] = [
  { index: true, element: screen(HomeScreen) },
  { path: "review", element: screen(ReviewScreen) },
  { path: "leaderboard", element: screen(LeaderboardScreen) },
  { path: "me", element: screen(MeScreen) },
  { path: "shop", element: screen(ShopScreen) },
  { path: "u/:userId", element: screen(PublicProfileScreen) },
  { path: "exam", element: screen(ExamIntroScreen) },
  { path: "*", element: screen(NotFound) },
];

const focusRoutes: RouteObject[] = [
  { path: "lesson/:id", element: screen(LessonScreen) },
  { path: "lesson/:id/done", element: screen(LessonDoneScreen) },
  { path: "review/run", element: screen(ReviewRunScreen) },
  { path: "dialogue/:id", element: screen(DialogueScreen) },
  { path: "exam/run", element: screen(ExamRunScreen) },
  { path: "exam/result", element: screen(ExamResultScreen) },
];

const publicRoutes: RouteObject[] = [
  { path: "welcome", element: screen(WelcomeScreen) },
  { path: "auth/callback", element: screen(AuthCallbackScreen) },
  ];

// Declared inside the DEV branch so the gallery chunk is dropped from production builds.
const devRoutes: RouteObject[] = [];
if (import.meta.env.DEV) {
  const Gallery = lazy(() => import("@/ui/Gallery").then((m) => ({ default: m.Gallery })));
  devRoutes.push({ path: "__ui", element: screen(Gallery) });
}

export const appRoutes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      ...publicRoutes,
      ...devRoutes,
      { element: <AuthGate><TabLayout /></AuthGate>, children: tabRoutes },
      { element: <AuthGate><FocusLayout /></AuthGate>, children: focusRoutes },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
