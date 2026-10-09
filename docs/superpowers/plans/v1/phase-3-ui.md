# Phase 3 — UI (T16–T28)

> Part of `docs/superpowers/plans/2026-10-09-vietlearn-v1.md`. Read **Global Constraints** first.
> **Every task in this phase is a UI task:** load the `vietlearn-design` skill, read `docs/design-system.md`, and paste the completed `review-checklist.md` in your report.
> Component tests use `renderWithServices` (T03) and the fakes; never hit the network. Query by role/label text (French strings from `fr`).
> Each feature task owns **only its folder** `src/features/<name>/` plus its own block in `src/i18n/fr.ts` (`// --- <name> ---`). Routes already exist (T17) and point at each feature's `index.ts` exports — replace the placeholder, never edit `router.tsx` unless your task says so.

---

### Task T16: Design-system primitives, motion tokens, icons, gallery

**Design:** `docs/design-system.md` §3–§7 (all) · **ADR:** 0010 · **Depends on:** T01

**Files:**
- Create: `src/ui/motion.ts`, `src/ui/icons/index.tsx` (all icons), `src/ui/Button.tsx`, `Card.tsx`, `Sheet.tsx`, `FeedbackSheet.tsx`, `ProgressBar.tsx`, `Hearts.tsx`, `Avatar.tsx`, `ToneMark.tsx`, `ToneButton.tsx`, `XpCounter.tsx`, `StreakFlame.tsx`, `BadgeMedal.tsx`, `Toast.tsx`, `Skeleton.tsx`, `TabBar.tsx`, `PageTransition.tsx`, `FocusHeader.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`, `SpeakerButton.tsx`, `MicButton.tsx`, `ReportButton.tsx`, `Confetti.tsx`, `Motif.tsx`, `index.ts`
- Create: `src/ui/Gallery.tsx` (dev-only showcase), `src/ui/ui.test.tsx`
- Modify: `src/i18n/fr.ts` (block `// --- ui ---`)

**Interfaces — Produces (props are the contract; later tasks rely on them):**
```ts
// motion.ts — values copied from design-system §6
export const duration = { instant: 0.08, fast: 0.15, base: 0.22, slow: 0.36, celebrate: 0.8 } as const;
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1], in: [0.55, 0, 1, 0.45] } as const;
export const spring = { snappy: { type: "spring", stiffness: 520, damping: 34 }, soft: { type: "spring", stiffness: 260, damping: 28 }, bouncy: { type: "spring", stiffness: 420, damping: 16 } } as const;
export const tap = { scale: 0.97 } as const;

Button: { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "md" | "lg"; loading?: boolean; fullWidth?: boolean } & ButtonHTMLAttributes
Card: { as?: "div" | "section" | "li"; raised?: boolean; className?: string; children }
Sheet: { open: boolean; onClose?: () => void; children; label: string /* aria-label */; tone?: "neutral" | "success" | "error" }
FeedbackSheet: { open: boolean; correct: boolean; expected: string; heard?: string; onContinue: () => void; onSpeak?: () => void; onReport?: () => void; children?: ReactNode }
ProgressBar: { value: number /* 0..1 */; label: string }
Hearts: { count: number; max: number }
Avatar: { emoji: string; size?: "sm" | "md" | "lg"; ring?: "none" | "gold" | "primary" }
ToneMark: { tone: Tone; showName?: boolean }          // colour + sign + name, never colour alone
ToneButton: { tone: Tone; selected: boolean; state?: "idle" | "correct" | "wrong"; onClick: () => void }
XpCounter: { value: number; delta?: number }           // animated count + floating "+N"
StreakFlame: { days: number; size?: "sm" | "md" }
BadgeMedal: { icon: string; title: string; unlocked: boolean; size?: "sm" | "lg" }
Toast: useToast() → { show(t: { title: string; body?: string; icon?: string }): void } ; <ToastViewport/>  (zustand store inside ui/Toast.tsx)
Skeleton: { className?: string; lines?: number }
TabBar: { items: Array<{ to: string; label: string; icon: IconName }>; } (uses NavLink; hidden via parent layout)
PageTransition: { children; variant: "tab" | "focus" }  // tab = fade+y8 ; focus = slide up from bottom
FocusHeader: { progress?: number; onClose: () => void; closeLabel: string; right?: ReactNode }
EmptyState: { title: string; body?: string; illustration?: "bowl" | "lantern" | "boat"; action?: ReactNode }
ConfirmDialog: { open: boolean; title: string; body?: string; confirmLabel: string; cancelLabel: string; danger?: boolean; requireText?: string; onConfirm(): void; onCancel(): void }
SpeakerButton: { onSpeak: () => void; onSpeakSlow?: () => void; disabled?: boolean; disabledReason?: string; size?: "md" | "xl"; playing?: boolean }
MicButton: { state: "idle" | "listening" | "processing"; onPress: () => void; disabled?: boolean; label: string }
ReportButton: { onClick: () => void }
Confetti: { fire: boolean }                            // ~24 lozenges gold/red/jade, 800 ms, once; nothing with reduced motion
Motif: { kind: "waves" | "scales" | "clouds"; className?: string } // decorative SVG, opacity ≤ 0.08, aria-hidden
icons: IconName = "home" | "review" | "trophy" | "user" | "close" | "check" | "cross" | "speaker" | "turtle" | "mic" | "stop" | "flag" | "chevron-right" | "chevron-left" | "lock" | "star" | "flame" | "refresh" | "settings" | "share" | "download" | "chat" | "play" ; <Icon name size? className? />
```

- [ ] **Step 1: `motion.ts` + root reduced-motion behaviour** — exact constants above. Every animated primitive uses these tokens only.

- [ ] **Step 2: Icons** — one `src/ui/icons/index.tsx` exporting `Icon` and `IconName`. Each icon: 24×24 viewBox, `stroke="currentColor"`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `fill="none"`, `aria-hidden="true"`. Draw simple, consistent shapes by hand (no icon library). The `flame` icon is filled with `currentColor` (use `text-streak`).

- [ ] **Step 3: Write failing tests** — `src/ui/ui.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ToneMark, Hearts, ConfirmDialog, FeedbackSheet, ProgressBar } from "@/ui";

test("Button shows loading state and is disabled", () => {
  render(<Button loading>Valider</Button>);
  expect(screen.getByRole("button", { name: /valider/i })).toBeDisabled();
});
test("ToneMark never relies on colour alone", () => {
  render(<ToneMark tone="sac" showName />);
  expect(screen.getByText("sắc")).toBeInTheDocument();
  expect(screen.getByText("´")).toBeInTheDocument();
});
test("Hearts exposes remaining count to assistive tech", () => {
  render(<Hearts count={2} max={3} />);
  expect(screen.getByLabelText("2 vies sur 3")).toBeInTheDocument();
});
test("ConfirmDialog with requireText only enables confirm when typed", async () => {
  const onConfirm = vi.fn();
  render(<ConfirmDialog open title="Supprimer ?" confirmLabel="Supprimer" cancelLabel="Annuler" requireText="SUPPRIMER" danger onConfirm={onConfirm} onCancel={() => {}} />);
  const confirm = screen.getByRole("button", { name: "Supprimer" });
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByRole("textbox"), "SUPPRIMER");
  await userEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalled();
});
test("FeedbackSheet announces result and continues", async () => {
  const onContinue = vi.fn();
  render(<FeedbackSheet open correct={false} expected="Cho tui một ly trà đá." onContinue={onContinue} />);
  expect(screen.getByRole("status")).toHaveTextContent(/pas tout à fait/i);
  expect(screen.getByText("Cho tui một ly trà đá.")).toHaveAttribute("lang", "vi");
  await userEvent.click(screen.getByRole("button", { name: /continuer/i }));
  expect(onContinue).toHaveBeenCalled();
});
test("ProgressBar exposes progressbar role", () => {
  render(<ProgressBar value={0.5} label="Progression" />);
  expect(screen.getByRole("progressbar", { name: "Progression" })).toHaveAttribute("aria-valuenow", "50");
});
```
Run → FAIL.

- [ ] **Step 4: Implement primitives** — rules for every component:
  - Classes use tokens only (`bg-surface`, `text-ink-muted`, `rounded-md`, `shadow-card`, `text-heading`…).
  - Pressables are `motion.button` with `whileTap={tap}` and `transition={spring.snappy}`; min 44×44 px.
  - Vietnamese strings rendered by primitives carry `lang="vi"`.
  - All visible strings come from `fr.ui.*`.

  Key implementations:
  - **Button (primary "lacquer")**: `bg-primary text-primary-on rounded-md border-b-4 border-primary-hover active:translate-y-[2px] active:border-b-2`, `text-body-strong`, `px-5 py-3` (`lg`: `py-4 text-heading`). `secondary`: `bg-surface border-2 border-line text-ink`. `ghost`: transparent, `text-primary`. `danger`: like primary but `bg-error`. `loading` → disabled + 3 pulsing dots.
  - **Sheet**: `AnimatePresence`; backdrop `bg-ink/30` fade (`duration.fast`); panel `fixed inset-x-0 bottom-0 rounded-t-lg bg-surface shadow-raised` with `initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring.soft}`; `drag="y"` with `dragConstraints={{ top: 0 }}` closing past 120 px when `onClose` is set; grab handle; `role="dialog" aria-label={label}`; tone `success` → `bg-success-soft`, `error` → `bg-error-soft`; respects `safe-area-inset-bottom`.
  - **FeedbackSheet**: Sheet + header with drawn check (motion `pathLength 0→1`, 250 ms) or cross, title `fr.ui.feedback.correct` ("Đúng rồi !") / `fr.ui.feedback.wrong` ("Pas tout à fait"), wrapped in `role="status"`; expected answer in `text-heading` with `lang="vi"`, SpeakerButton if `onSpeak`, ReportButton if `onReport`, `children` slot (syllable diff), full-width primary "Continuer" button that receives focus on open; `Enter` triggers continue.
  - **ProgressBar**: track `bg-surface-2 rounded-full h-3`; fill `bg-primary` animated with `scaleX` (origin left, `spring.soft`); `role="progressbar"` with `aria-valuemin=0 aria-valuemax=100 aria-valuenow`.
  - **XpCounter**: `useMotionValue` + `animate(value, { duration: 0.6 })` rendering rounded number in `.tabular`; when `delta` changes, a `+N` chip in `text-gold-ink` rises `y: 0 → -24` and fades.
  - **Toast**: zustand store `{ toasts, show, dismiss }`; viewport fixed top, toast slides from top, auto-dismiss 3.5 s; `role="status"`.
  - **Confetti**: absolute container `pointer-events-none`, 24 `motion.div` lozenges (rotate 45°, 8×8 px) in `bg-gold`, `bg-primary`, `bg-success`; random x/y targets from a fixed seed; skipped when `useReducedMotion()` is true.
  - **TabBar**: fixed bottom, `bg-surface border-t border-line`, 4 items, active item `text-primary` with a small lacquer dot that moves with `layoutId="tab-dot"`; labels `text-caption`.
  - **PageTransition**: `motion.div` keyed by location pathname (the parent passes `key`); `tab`: `initial {opacity:0, y:8}` → `animate {opacity:1, y:0}` (`duration.fast`), exit opacity 0 (`duration.fast*0.7`); `focus`: `initial {y:"100%"}` → `{y:0}` (`spring.soft`), exit `{y:"100%"}`.
  - **SpeakerButton**: big round button (`xl` = 72 px) `bg-primary text-primary-on` with speaker icon; while `playing`, 2 concentric rings pulse; secondary small turtle button for slow; when `disabled`, shows `disabledReason` as `title` and visible caption.
  - **MicButton**: 72 px round; `listening` → 3 rings pulsing (`scale 1→1.6`, opacity 0.5→0, staggered 0.4 s, `repeat: Infinity`), icon `stop`; `processing` → spinner dots; `aria-pressed` when listening.
  - **ToneMark / ToneButton**: map `Tone` → `{ name: "ngang"|"huyền"|"sắc"|"hỏi"|"ngã"|"nặng", sign: "–"|"`"|"´"|"̉ "|"˜"|"." , className: "text-tone-sac" … }` in one table `TONE_UI` exported from `ToneMark.tsx`. `ngang` shows "–" as its sign. ToneButton shows a mini pitch-contour SVG (flat, falling, rising, dip-rise, broken-rise, short-drop) above the name.
  - **Motif**: three inline SVG patterns; `aria-hidden`; `className` positions it.

- [ ] **Step 5: Gallery** — `src/ui/Gallery.tsx` renders every primitive in all variants (light area + `.dark` area side by side) with real Vietnamese samples (`Cà phê sữa đá`, `Bao nhiêu tiền?`). It is mounted at `/__ui` by T17 only when `import.meta.env.DEV`.

- [ ] **Step 6: Verify** — `npm run verify`; open `/__ui` after T17 exists (or temporarily render `Gallery` from `App.tsx`, then revert) at 360 px light + dark; complete the design checklist. **Commit:** `feat(ui): add design-system primitives, motion tokens and icons`

---

### Task T17: App shell — bootstrap, router, layouts, auth gate, theme, sync, PWA

**Spec:** §6 (routes table), §8, §9 · **ADR:** 0001, 0010 · **Depends on:** T03, T16 (T15 for real mode, but works with fakes)

**Files:**
- Modify: `src/main.tsx`, `vite.config.ts`, `index.html` (manifest link handled by plugin), `src/i18n/fr.ts` (block `// --- app ---`)
- Delete: `src/App.tsx`, `src/App.test.tsx`
- Create: `src/app/appState.ts`, `src/app/router.tsx`, `src/app/Root.tsx`, `src/app/layouts/TabLayout.tsx`, `src/app/layouts/FocusLayout.tsx`, `src/app/AuthGate.tsx`, `src/app/FeatureErrorBoundary.tsx`, `src/app/ThemeController.tsx`, `src/app/SyncIndicator.tsx`, `src/app/UpdatePrompt.tsx`, `src/app/NotFound.tsx`, `src/app/shell.test.tsx`
- Create placeholders: `src/features/{onboarding,home,lessons,review,conversation,exam,leaderboard,profile}/index.ts` each exporting its screen components (see table) as `function XScreen() { return <EmptyState title="…" /> }` in a sibling `XScreen.tsx`
- Create: `public/icons/icon.svg` (source logo), generated PNGs (Step 6), `public/robots.txt`

**Interfaces — Produces:**
```ts
// @/app/appState (di element: importable by features)
export type AppProfile = { pseudo: string; avatarEmoji: string };
export const useAppState: UseBoundStore<StoreApi<{
  ready: boolean; session: Session | null; profile: AppProfile | null; settings: Settings;
  snapshot: ProgressSnapshot | null; dueCount: number; pendingSync: number;
  set(p: Partial<{ ready: boolean; session: Session | null; profile: AppProfile | null; settings: Settings; snapshot: ProgressSnapshot | null; dueCount: number; pendingSync: number }>): void;
}>>;
export function useSettings(): { settings: Settings; updateSettings(patch: Partial<Settings>): Promise<void> };
export function useRefreshProgress(): () => Promise<void>; // reloads snapshot + dueCount into the store
export function voiceRateOf(s: Settings): number;          // normal → 1, slow → 0.6
```
Routes → screen exports (feature `index.ts` must export exactly these names):

| Path | Layout | Export | Feature |
|---|---|---|---|
| `/welcome` | none (public) | `WelcomeScreen` | onboarding |
| `/auth/callback` | none (public) | `AuthCallbackScreen` | onboarding |
| `/` | TabLayout | `HomeScreen` | home |
| `/review` | TabLayout | `ReviewScreen` | review |
| `/leaderboard` | TabLayout | `LeaderboardScreen` | leaderboard |
| `/me` | TabLayout | `MeScreen` | profile |
| `/u/:userId` | TabLayout | `PublicProfileScreen` | leaderboard |
| `/lesson/:id` | FocusLayout | `LessonScreen` | lessons |
| `/lesson/:id/done` | FocusLayout | `LessonDoneScreen` | lessons |
| `/review/run` | FocusLayout | `ReviewRunScreen` | review |
| `/dialogue/:id` | FocusLayout | `DialogueScreen` | conversation |
| `/exam` | TabLayout | `ExamIntroScreen` | exam |
| `/exam/run` | FocusLayout | `ExamRunScreen` | exam |
| `/exam/result` | FocusLayout | `ExamResultScreen` | exam |
| `/__ui` (DEV only) | none | `Gallery` | ui |
| `*` | TabLayout | `NotFound` | app |

- [ ] **Step 1: appState** — `src/app/appState.ts`

```ts
import { create } from "zustand";
import { useCallback } from "react";
import type { ProgressSnapshot, Session, Settings } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/ports/ProgressRepository";
import { useServices } from "@/app/ServicesProvider";

export type AppProfile = { pseudo: string; avatarEmoji: string };
type Fields = {
  ready: boolean; session: Session | null; profile: AppProfile | null; settings: Settings;
  snapshot: ProgressSnapshot | null; dueCount: number; pendingSync: number;
};
export const useAppState = create<Fields & { set(p: Partial<Fields>): void }>((set) => ({
  ready: false, session: null, profile: null, settings: { ...DEFAULT_SETTINGS }, snapshot: null, dueCount: 0, pendingSync: 0,
  set: (p) => set(p),
}));

export function voiceRateOf(s: Settings): number {
  return s.voiceRate === "slow" ? 0.6 : 1;
}

export function useSettings() {
  const { progress } = useServices();
  const settings = useAppState((s) => s.settings);
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...useAppState.getState().settings, ...patch };
    useAppState.getState().set({ settings: next });
    await progress.saveSettings(next);
  }, [progress]);
  return { settings, updateSettings };
}

export function useRefreshProgress() {
  const { activity, progress, clock } = useServices();
  return useCallback(async () => {
    const [snapshot, dueCount] = await Promise.all([activity.getSnapshot(), progress.countDueVocab(clock())]);
    useAppState.getState().set({ snapshot, dueCount });
  }, [activity, progress, clock]);
}
```

- [ ] **Step 2: Bootstrap** — `src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router-dom";
import "@/styles/index.css";
import { parseEnv } from "@/app/env";
import { createServices } from "@/app/container";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createAppRouter } from "@/app/router";

const env = parseEnv(import.meta.env);
const services = createServices(env);
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={createAppRouter()} />
      </MotionConfig>
    </ServicesProvider>
  </StrictMode>,
);
```

- [ ] **Step 3: Root, auth gate, layouts**
  - `Root.tsx` (route element wrapping everything): on mount (once) loads `settings` (`progress.getSettings()`), `session` (`auth.getSession()`), `profile` (`auth.getMyProfile()` if session), calls `refreshProgress()`, starts `sync.start()` and subscribes `sync.onSizeChange(n => set({ pendingSync: n }))`, subscribes `auth.onChange`; then `set({ ready: true })`. Renders `<ThemeController/>`, `<ToastViewport/>`, `<UpdatePrompt/>`, and `<Outlet/>`. While `!ready`: a full-screen cream splash with the logo (no spinner).
  - `AuthGate.tsx`: wraps protected routes. If `!session || !profile || !settings.onboardingDone` → `<Navigate to="/welcome" replace />`.
  - **Offline start** (spec §6 note): Supabase keeps the session in `localStorage`, so `auth.getSession()` works offline. The profile is cached in `localStorage` under key `vl-profile` (JSON `{ pseudo, avatarEmoji }`): `Root` writes it every time `auth.getMyProfile()` succeeds and reads it when that call throws `OfflineError`. No port changes are needed (this is a UI cache owned by `src/app/`).
  - `TabLayout.tsx`: header (avatar → `/me`, `XpCounter` of `snapshot.xpTotal`, `StreakFlame`, `SyncIndicator`), `<AnimatePresence mode="wait"><PageTransition key={pathname} variant="tab"><Outlet/></PageTransition></AnimatePresence>`, bottom `TabBar` with items Apprendre `/`, Révision `/review` (badge with `dueCount` if > 0), Classement `/leaderboard`, Moi `/me`. Content area `max-w-md mx-auto px-5 pb-28`.
  - `FocusLayout.tsx`: no TabBar; `PageTransition variant="focus"`; full height.
  - Each route element is wrapped in `<FeatureErrorBoundary>` (class component; renders `EmptyState` with `fr.app.error.title`, a "Réessayer" button that resets the boundary, and a link to `/`).
  - `ThemeController.tsx`: effect on `settings.theme` + `matchMedia("(prefers-color-scheme: dark)")` change listener → toggles `document.documentElement.classList` `dark` and sets `meta[name=theme-color]` to `#15110F` / `#F6F0E4`.
  - `SyncIndicator.tsx`: shows `⟳ N` (`fr.app.sync.pending`) only if `pendingSync > 0` for more than 30 s (timer), `text-caption text-ink-muted`.
  - `NotFound.tsx`: EmptyState "Page introuvable" + link home.

- [ ] **Step 4: Router** — `src/app/router.tsx` with `createBrowserRouter`: root route element `<Root/>`; children: public routes, then `{ element: <AuthGate><TabLayout/></AuthGate>, children: [...] }` and `{ element: <AuthGate><FocusLayout/></AuthGate>, children: [...] }` per the table; `/__ui` added only `if (import.meta.env.DEV)`. Use `lazy` imports per feature (`React.lazy(() => import("@/features/lessons").then(m => ({ default: m.LessonScreen })))`) wrapped in `<Suspense fallback={<Skeleton lines={4} />}>` to keep the initial bundle small.

- [ ] **Step 5: PWA** — `vite.config.ts` adds:
```ts
import { VitePWA } from "vite-plugin-pwa";
// plugins: [react(), VitePWA({
//   registerType: "prompt",
//   includeAssets: ["icons/apple-touch-icon-180x180.png", "icons/icon.svg"],
//   manifest: {
//     name: "VietLearn", short_name: "VietLearn", lang: "fr", start_url: "/", scope: "/", display: "standalone",
//     orientation: "portrait", background_color: "#F6F0E4", theme_color: "#A3201C",
//     icons: [
//       { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
//       { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png" },
//       { src: "icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
//     ],
//   },
//   workbox: {
//     globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
//     navigateFallback: "/index.html",
//     runtimeCaching: [{ urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: "NetworkOnly" }],
//   },
// })]
```
(write it as real code, not comments). `index.html` gets `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png">`.
`UpdatePrompt.tsx`: `import { useRegisterSW } from "virtual:pwa-register/react"`; when `needRefresh`, show a bottom toast-like bar "Nouvelle version disponible" + button "Mettre à jour" → `updateServiceWorker(true)`. Never auto-reload. Hidden on Focus routes (check `useMatch` for `/lesson/*`, `/exam/run`, `/dialogue/*`, `/review/run`). Add `"vite-plugin-pwa/react"` and `"vite-plugin-pwa/client"` to `tsconfig.app.json` `types`.

- [ ] **Step 6: Icons** — draw `public/icons/icon.svg`: a lacquer-red rounded square (`#A3201C`), a gold (`#C8962E`) stylised conical hat (nón lá) silhouette and below it the letters "VL" in cream (`#FFF8EE`) — simple, legible at 48 px. Generate PNGs once (one-off tool, not a dependency):
```bash
npx --yes @vite-pwa/assets-generator@0.2 --preset minimal-2023 public/icons/icon.svg
```
Move/rename outputs so these exist: `public/icons/pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, and `public/favicon.ico`. Commit the PNGs.

- [ ] **Step 7: Tests** — `src/app/shell.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ServicesProvider } from "@/app/ServicesProvider";
import { createFakeServices } from "@/adapters/fakes";
import { appRoutes } from "@/app/router"; // export the route objects as well as createAppRouter()
import { useAppState } from "@/app/appState";

function renderAt(path: string, services = createFakeServices()) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<ServicesProvider services={services}><RouterProvider router={router} /></ServicesProvider>);
  return { router, services };
}
beforeEach(() => useAppState.setState({ ready: false, session: null, profile: null }));

test("unauthenticated user is redirected to /welcome", async () => {
  const { router } = renderAt("/");
  await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
});

test("onboarded user sees the tab bar", async () => {
  const services = createFakeServices();
  await services.auth.verifyOtp("a@b.c", "123456");
  await services.auth.joinGroup("TEST-CODE", "Marc", "🐉");
  await services.progress.saveSettings({ theme: "system", voiceRate: "normal", capabilities: { tts: true, stt: true, recorder: true }, onboardingDone: true });
  renderAt("/", services);
  expect(await screen.findByRole("navigation")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /classement/i })).toBeInTheDocument();
});

test("focus routes hide the tab bar", async () => {
  const services = createFakeServices();
  await services.auth.verifyOtp("a@b.c", "123456");
  await services.auth.joinGroup("TEST-CODE", "Marc", "🐉");
  await services.progress.saveSettings({ theme: "system", voiceRate: "normal", capabilities: { tts: true, stt: true, recorder: true }, onboardingDone: true });
  renderAt("/lesson/l05", services);
  await waitFor(() => expect(screen.queryByRole("navigation")).not.toBeInTheDocument());
});
```
`vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }) }))` at the top of the test file.

- [ ] **Step 8: Verify** — `npm run verify`; `npm run build && npm run preview` → Chrome DevTools > Application: manifest valid, service worker registered, icons shown. With `VITE_USE_FAKES=true`, navigating `/` redirects to `/welcome`. **Commit:** `feat(app): add shell, routing with transitions, auth gate, theme, sync indicator and PWA`

---

### Task T18: Exercise registry, ExerciseHost, `listen_choose` and `translate_choose`

**Spec:** §6.3, §6.4 · **ADR:** 0002 · **Depends on:** T16, T17

**Files:**
- Create: `src/exercises/registry.ts`, `src/exercises/ExerciseHost.tsx`, `src/exercises/ExerciseHost.test.tsx`
- Create: `src/exercises/listen_choose/{Component.tsx,grade.ts,grade.test.ts,Component.test.tsx,index.ts}`
- Create: `src/exercises/translate_choose/{Component.tsx,grade.ts,grade.test.ts,Component.test.tsx,index.ts}`
- Create: `src/ui/ChoiceGrid.tsx` and export it from `src/ui/index.ts` — a generic choice list shared by both plugins (plugins may not import each other): props `{ options: Array<{ id: string; label: string; lang?: "vi" | "fr"; sub?: string }>; selected: string | null; onSelect(id: string): void; disabled: boolean; correctId?: string | null; wrongId?: string | null }`. Options are full-width `motion.button`s (`bg-surface border-2 border-line border-b-4 rounded-md`), selected = `border-primary`, after answer `correctId` → `bg-success-soft border-success`, `wrongId` → `bg-error-soft border-error`.
- Modify: `src/i18n/fr.ts` (block `// --- exercises ---`)

**Interfaces — Produces:**
```ts
// registry.ts
export function getPlugin<T extends ExerciseType>(type: T): ExercisePlugin<Extract<Exercise, { type: T }>>;
export const plugins: Record<ExerciseType, ExercisePlugin>; // T19/T20 add their entries in their own marked blocks
// ExerciseHost.tsx
export type ExerciseHostProps = {
  exercise: Exercise;
  mode: "practice" | "exam";                // exam = no feedback sheet, result reported immediately
  vocabIndex: ReadonlyMap<VocabId, VocabItem>;
  capabilities: Capabilities;
  voiceRate: number;
  services: ExerciseServices;
  onResult: (r: GradeResult) => void;        // practice: after the user taps "Continuer"
  onReport?: (refId: string) => void;
};
export function ExerciseHost(p: ExerciseHostProps): JSX.Element;
```
Answer shapes: `listen_choose` → `{ vocabId: string }`; `translate_choose` → `{ vi: string }`.
`ExerciseHostProps` also has `onCapabilityLost?: (c: "stt" | "recorder") => void`, forwarded to the plugin component, and the host renders `plugin.Feedback` (when defined) inside the `FeedbackSheet`.

- [ ] **Step 1: Failing grade tests**

`src/exercises/listen_choose/grade.test.ts`:
```ts
import { grade } from "./grade";
const ex = { id: "e", type: "listen_choose" as const, vocabId: "v_ly", choices: ["v_ly", "v_da", "v_ca_phe", "v_sua"] };
const ctx = { vocabIndex: new Map([["v_ly", { id: "v_ly", vi: "ly", fr: "verre", dialect: "south" as const }]]) };
test("correct", () => expect(grade(ex, { vocabId: "v_ly" }, ctx)).toMatchObject({ correct: true, score: 1, expected: "ly", vocabIds: ["v_ly"] }));
test("wrong", () => expect(grade(ex, { vocabId: "v_da" }, ctx)).toMatchObject({ correct: false, score: 0 }));
test("malformed answer is wrong, never throws", () => expect(grade(ex, 42, ctx).correct).toBe(false));
```
`src/exercises/translate_choose/grade.test.ts`:
```ts
import { grade } from "./grade";
const ex = { id: "e", type: "translate_choose" as const, promptFr: "L'addition !", answerVi: "Tính tiền!", distractorsVi: ["Ngon quá!", "Cho tui nước.", "Cà phê đen."] };
const ctx = { vocabIndex: new Map() };
test("correct even with different punctuation/case/NFD", () => expect(grade(ex, { vi: "tính tiền".normalize("NFD") }, ctx).correct).toBe(true));
test("wrong", () => expect(grade(ex, { vi: "Ngon quá!" }, ctx)).toMatchObject({ correct: false, expected: "Tính tiền!" }));
```
For `translate_choose`, `vocabIds` = ids of vocab whose `vi` appears as a whole word sequence in `answerVi` (use `normalizeVi` from `@/services/pronunciation` on both and check `(" " + answer + " ").includes(" " + word + " ")`).

- [ ] **Step 2: Implement grades** (pure; validate the answer shape with a small Zod schema; malformed → wrong).

- [ ] **Step 3: Components**
  - **listen_choose**: big `SpeakerButton size="xl"` that auto-plays once on mount (`services.tts.speak(word.vi, { rate: voiceRate, audioUrl: word.audio })`, ignore errors) + slow button; prompt `fr.exercises.listenChoose.prompt` ("Qu'as-tu entendu ?"); `ChoiceGrid` of 4 options showing the **French** meaning (`lang="fr"`), order shuffled with `shuffle(choices, createRng(seed))`; primary "Vérifier" (disabled until a choice) → `onAnswer({ vocabId })`. If `!capabilities.tts`, show the Vietnamese word in large text instead of audio-only (still a valid exercise) and a caption explaining why.
  - **translate_choose**: French prompt in `text-heading`; 4 Vietnamese options (`lang="vi"`, `text-body-strong`), each option has a small speaker icon button to hear it; shuffled with seed; "Vérifier".
  - Keyboard: keys `1`–`4` select, `Enter` validates (only when the component is focused/active and not `disabled`).

- [ ] **Step 4: ExerciseHost** — state machine `answering → feedback → done`:
```tsx
const plugin = getPlugin(exercise.type);
const [result, setResult] = useState<GradeResult | null>(null);
const seed = useMemo(() => seedFromString(exercise.id), [exercise.id]);
const handleAnswer = (answer: unknown) => {
  const r = plugin.grade(exercise as never, answer, { vocabIndex });
  if (mode === "exam") onResult(r); else setResult(r);
};
// render: <AnimatePresence mode="wait"><motion.div key={exercise.id} initial={{x:24,opacity:0}} animate={{x:0,opacity:1}} exit={{x:-24,opacity:0}}>
//   <plugin.Component exercise={exercise} disabled={result !== null} onAnswer={handleAnswer} ... seed={seed} />
// </motion.div></AnimatePresence>
// {mode === "practice" && <FeedbackSheet open={result !== null} correct={!!result?.correct || !!result?.skipped} expected={result?.expected ?? ""}
//    onSpeak={() => services.tts.speak(result!.expected, { rate: voiceRate })} onReport={onReport && (() => onReport(exercise.id))}
//    onContinue={() => { const r = result!; setResult(null); onResult(r); }}>
//    {result && plugin.Feedback ? <plugin.Feedback exercise={exercise as never} result={result} /> : null}
// </FeedbackSheet>}
// The comments above describe the JSX to write; implement it as real TSX.
```
When `result.skipped`, the sheet title is `fr.exercises.skipped` ("Exercice passé") with neutral tone. For a wrong answer the shake animation (`x: [0,-6,6,-4,4,0]`, 300 ms) is applied to the exercise container before the sheet opens.

- [ ] **Step 5: Tests** — `ExerciseHost.test.tsx`

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithServices } from "@/test/renderWithServices";
import { ExerciseHost } from "@/exercises/ExerciseHost";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { FakeSpeechSynthesizer, FakeSpeechRecognizer, FakeVoiceRecorder } from "@/adapters/fakes";

const vocabIndex = new Map(lessonFixture.vocab.map((v) => [v.id, v]));
const ex = lessonFixture.exercises.find((e) => e.type === "listen_choose")!; // answer v_ca_phe_sua_da
const base = { vocabIndex, capabilities: { tts: true, stt: true, recorder: true }, voiceRate: 1,
  services: { tts: new FakeSpeechSynthesizer(), stt: new FakeSpeechRecognizer(), recorder: new FakeVoiceRecorder() } };

test("practice: shows feedback then reports the result on Continuer", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /café au lait glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/đúng rồi/i);
  expect(onResult).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /continuer/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
});

test("exam: reports immediately without feedback", async () => {
  const onResult = vi.fn();
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="exam" onResult={onResult} />);
  await userEvent.click(screen.getByRole("button", { name: /thé glacé/i }));
  await userEvent.click(screen.getByRole("button", { name: /vérifier/i }));
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("listen_choose auto-plays the word", async () => {
  renderWithServices(<ExerciseHost {...base} exercise={ex} mode="practice" onResult={() => {}} />);
  await screen.findByRole("button", { name: /vérifier/i });
  expect(base.services.tts.spoken).toContain("cà phê sữa đá");
});
```
Plus a `Component.test.tsx` per plugin checking: options rendered (4), Vérifier disabled until selection, keyboard `1` selects first option.

- [ ] **Step 6: Verify & commit** — `feat(exercises): add plugin registry, exercise host and choice exercises`

---

### Task T19: `tone_pick` and `word_order` plugins

**Spec:** §6.4 · **Design:** tone colours §2.3, `layoutId` tiles §6.2 · **Depends on:** T18

**Files:**
- Create: `src/exercises/tone_pick/{Component.tsx,grade.ts,grade.test.ts,Component.test.tsx,index.ts}`
- Create: `src/exercises/word_order/{Component.tsx,grade.ts,grade.test.ts,Component.test.tsx,index.ts}`
- Modify: `src/exercises/registry.ts` (add the two entries in block `// --- T19 ---`), `src/i18n/fr.ts` (extend `exercises` block)

**Answer shapes:** `tone_pick` → `{ tone: Tone }`; `word_order` → `{ tokens: string[] }`.

- [ ] **Step 1: Failing grade tests**
```ts
// tone_pick/grade.test.ts
import { grade } from "./grade";
const ex = { id: "e", type: "tone_pick" as const, syllable: "đá", answerTone: "sac" as const };
test("correct", () => expect(grade(ex, { tone: "sac" }, { vocabIndex: new Map() })).toMatchObject({ correct: true, expected: "đá" }));
test("wrong", () => expect(grade(ex, { tone: "huyen" }, { vocabIndex: new Map() }).correct).toBe(false));
```
```ts
// word_order/grade.test.ts
import { grade } from "./grade";
const ex = { id: "e", type: "word_order" as const, fr: "…", tokensVi: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"], extraTokens: ["đen"] };
test("exact order is correct", () => expect(grade(ex, { tokens: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá"] }, { vocabIndex: new Map() }).correct).toBe(true));
test("wrong order", () => expect(grade(ex, { tokens: ["tui", "Cho", "một", "ly", "cà phê", "sữa", "đá"] }, { vocabIndex: new Map() }).correct).toBe(false));
test("extra token makes it wrong", () => expect(grade(ex, { tokens: ["Cho", "tui", "một", "ly", "cà phê", "sữa", "đá", "đen"] }, { vocabIndex: new Map() }).correct).toBe(false));
test("expected is the sentence", () => expect(grade(ex, { tokens: [] }, { vocabIndex: new Map() }).expected).toBe("Cho tui một ly cà phê sữa đá"));
```
Comparison is on `normalizeVi(token)` per position (case/punctuation-insensitive). `vocabIds` same rule as translate_choose (vocab appearing in the sentence).

- [ ] **Step 2: Components**
  - **tone_pick**: shows `stripTones(syllable)` huge (`text-display`, `lang="vi"`), `SpeakerButton` that speaks the full `syllable` (auto-play once); a 3×2 grid of `ToneButton` for the 6 tones (in `TONES` order) each with contour + name + sign; select then "Vérifier". After answer (`disabled`), the correct ToneButton shows `state="correct"`, a wrong pick `state="wrong"`. A small `ToneMark` legend link "Rappel des tons" opens a `Sheet` listing the 6 tones with their French description (content-guide §2 table).
  - **word_order**: French sentence on top; an answer line (dashed `border-line` underline, min-height 56 px) and a bank of shuffled tiles (`tokensVi + extraTokens`, seed shuffle). Tapping a bank tile moves it to the end of the answer line; tapping an answer tile returns it to the bank. Tiles are `motion.button` with `layout` and `layoutId={tile.key}` (key = index-based unique id, because tokens can repeat) so they visually fly between the two zones (`spring.snappy`). Each tile: `bg-surface border-2 border-line border-b-4 rounded-sm px-3 py-2 text-body-strong`, `lang="vi"`. "Vérifier" enabled when the answer line is non-empty.

- [ ] **Step 3: Component tests** — tone_pick: 6 tone buttons with accessible names "ngang", "huyền", "sắc", "hỏi", "ngã", "nặng"; selecting + Vérifier calls `onAnswer({ tone })`. word_order: clicking tiles builds the sentence; clicking an answer tile returns it; `onAnswer({ tokens })` order matches clicks.

- [ ] **Step 4: Verify & commit** — `feat(exercises): add tone_pick and word_order plugins`

---

### Task T20: `speak` plugin (recognition, fallback recorder, self-assessment)

**Spec:** §6.4 speak, §6.5, §9 (STT rows) · **Depends on:** T08, T18

**Files:**
- Create: `src/exercises/speak/{Component.tsx,grade.ts,grade.test.ts,Component.test.tsx,SyllableDiff.tsx,index.ts}`
- Modify: `src/exercises/registry.ts` (block `// --- T20 ---`), `src/i18n/fr.ts`

**Answer shapes (union):**
```ts
type SpeakAnswer =
  | { kind: "speech"; alternatives: string[] }
  | { kind: "self"; ok: boolean }   // recorder fallback, user self-assessment
  | { kind: "skip" };               // mic denied / no capability at all
```
**Grade:** speech → `scorePronunciation(vi, alternatives)`; `correct = score >= PASS_THRESHOLD`; `score` = pronunciation score; `detail` = `{ diff, heard }`. self → `{ correct: ok, score: ok ? 1 : 0, selfAssessed: true }`. skip → `{ correct: false, score: 0, skipped: true }`. `vocabIds` = `exercise.vocabIds`. `expected` = `exercise.vi`.

- [ ] **Step 1: Failing grade tests**
```ts
import { grade } from "./grade";
const ex = { id: "e", type: "speak" as const, vi: "Cho tui một ly trà đá.", fr: "…", vocabIds: ["v_tra_da"] };
const ctx = { vocabIndex: new Map() };
test("good speech passes", () => expect(grade(ex, { kind: "speech", alternatives: ["cho tui một ly trà đá"] }, ctx)).toMatchObject({ correct: true, score: 1, vocabIds: ["v_tra_da"] }));
test("one wrong tone still passes (0.92)", () => expect(grade(ex, { kind: "speech", alternatives: ["cho tui một ly trà đà"] }, ctx).correct).toBe(true));
test("bad speech fails", () => expect(grade(ex, { kind: "speech", alternatives: ["xin chào"] }, ctx).correct).toBe(false));
test("self-assessed", () => expect(grade(ex, { kind: "self", ok: true }, ctx)).toMatchObject({ correct: true, selfAssessed: true }));
test("skip", () => expect(grade(ex, { kind: "skip" }, ctx)).toMatchObject({ skipped: true, correct: false }));
```

- [ ] **Step 2: Component — mode selection**
  - `mode = capabilities.stt ? "stt" : capabilities.recorder ? "recorder" : "none"`.
  - Common: sentence in `text-heading` `lang="vi"`, French below in `text-ink-muted`, `SpeakerButton` (+ slow) to hear the model first.
  - **stt**: `MicButton` → `state="listening"` → `await services.stt.listen({ lang: "vi-VN", timeoutMs: 8000 })` → `onAnswer({ kind: "speech", alternatives })`. On `RecognitionError`:
    - `no-speech` / `timeout` / `aborted` / `network`: inline message `fr.exercises.speak.notHeard` ("Je n'ai rien entendu, réessaie"); count failures; after **2** failures show a secondary button "M'auto-évaluer" switching to recorder mode for this exercise.
    - `not-allowed`: message `fr.exercises.speak.micDenied`, call `onCapabilityLost("stt")` (new optional prop, see below), switch to recorder mode if `capabilities.recorder`, else show "Passer" → `onAnswer({ kind: "skip" })`.
    - `unsupported`: same as not-allowed but message `fr.exercises.speak.unsupported`.
  - **recorder**: MicButton records (max 6 s, tap again to stop via `AbortController`), then shows two players: "Ma voix" (plays `URL.createObjectURL(blob)` — revoke on unmount) and "Modèle" (TTS); then two buttons "J'ai bien dit ✓" / "À retravailler" → `onAnswer({ kind: "self", ok })`.
  - **none**: explanation + "Passer" → `{ kind: "skip" }`.
  - Use the `onCapabilityLost` prop (already in `ExerciseProps`, T03) to report `"stt"`; features persist it with `updateSettings({ capabilities: { ...caps, stt: false } })`.
  - **SyllableDiff.tsx** is the plugin's `Feedback` component (`ExercisePlugin.Feedback`, T03): it reads `result.detail` (`{ diff, heard }`) and renders the expected sentence syllable by syllable: `ok` plain, `tone` underlined 3 px in the **expected tone's colour** (`toneOfSyllable`) with a visually-hidden "(ton)" label, `wrong`/`missing` in `text-error` with dotted underline; below, "J'ai entendu : « heard »" in `text-caption`. Nothing is rendered for self-assessed or skipped results.

- [ ] **Step 3: Component tests** (use `FakeSpeechRecognizer.queue`)
```tsx
test("recognised speech is sent as alternatives", async () => { /* queue = [["cho tui một ly trà đá"]] → click mic → onAnswer called with { kind: "speech", alternatives: [...] } */ });
test("two no-speech errors offer self-assessment", async () => { /* queue = [new RecognitionError("no-speech"), new RecognitionError("no-speech")] → button "M'auto-évaluer" appears */ });
test("not-allowed switches to recorder and reports capability loss", async () => { /* queue=[new RecognitionError("not-allowed")] → onCapabilityLost("stt") called, "J'ai bien dit" flow available after recording */ });
test("no capability at all offers skip", async () => { /* capabilities all false → "Passer" → onAnswer({ kind: "skip" }) */ });
```
Write these four tests fully (render via `ExerciseHost` with `mode="exam"` to read `onResult` directly).

- [ ] **Step 4: Verify & commit** — `feat(exercises): add speak plugin with recognition and recorder fallback`

---

### Task T21: Onboarding (welcome, invite + OTP, profile, device test, install)

**Spec:** §6.1, §9 (auth rows) · **Depends on:** T15 (works with fakes), T17

**Files:** `src/features/onboarding/**` (replace placeholders), `src/ui/DeviceCheck.tsx` + `src/ui/index.ts` (export), `src/i18n/fr.ts` (block `// --- onboarding ---`)

**Screens & flow** (`WelcomeScreen` is a 5-step wizard with local state `step`; steps slide horizontally `x: ±40` with `duration.base`; a 5-dot progress indicator at the top):
1. **Bienvenue** — big "Chào bạn !" (`text-display`, `lang="vi"`), `env.VITE_WELCOME_MESSAGE` if non-empty in a card with a gold border, `Motif kind="clouds"` background, CTA "Commencer". If a session+profile already exist (returning user who lost onboardingDone), skip to step 4.
2. **Invitation & e-mail** — fields "Code d'invitation" (uppercase, trimmed) and "E-mail" (type email). "Recevoir mon code" → `auth.requestOtp(email)` (keep the invite code in component state). Then sub-step: 6-digit code input (`inputMode="numeric"`, `autoComplete="one-time-code"`, 6 boxes or one field with letter-spacing) → `auth.verifyOtp(email, code)`. Errors: `invalid_otp` → "Code incorrect ou expiré"; `OfflineError` → "Pas de connexion internet". "Renvoyer le code" link enabled after 30 s.
3. **Profil** — pseudo (2–20 chars) + 16-emoji grid (spec §6.1 list) as radio group → `auth.joinGroup(inviteCode, pseudo, emoji)`. `InvalidInviteError` → go back to step 2 with the error under the invite field; `PseudoTakenError` → "Ce pseudo est déjà pris dans ton groupe". On success: `useAppState.set({ profile })`, write `localStorage["vl-profile"]`.
4. **Test de l'appareil** — implemented as a reusable presentational component **`src/ui/DeviceCheck.tsx`** (create it and export from `src/ui/index.ts`; T28 reuses it): props `{ result: Capabilities | null; platform: "ios" | "android" | "other"; onTestVoice(): Promise<void>; onTestMic(): Promise<void>; busy: boolean }`. It shows "Écouter" and "Parler" buttons and 3 rows (Voix vietnamienne / Reconnaissance vocale / Micro) with ✓ or ✗ and the help text from spec §6.1 step 4 for the platform. The onboarding step wires it: `onTestVoice` → `tts.speak("Xin chào!", { rate: 1 })` (user gesture, required by iOS) then `detectCapabilities()`; `onTestMic` → `stt.listen({ lang: "vi-VN", timeoutMs: 6000 })` (errors ignored) then `detectCapabilities()`; platform from `navigator.userAgent` (`/iPhone|iPad|iPod/` → ios, `/Android/` → android). Save `capabilities` via `updateSettings`. "Continuer" is always allowed (run `detectCapabilities()` once on continue if the user skipped the buttons).
5. **Installer** — if `window.matchMedia("(display-mode: standalone)").matches` → skip. iOS: illustrated 3 steps (Partager icon → "Sur l'écran d'accueil" → "Ajouter"). Others: capture `beforeinstallprompt` (listener registered at module load in `src/features/onboarding/installPrompt.ts`, store the event) → button "Installer l'application" → `prompt()`. "Plus tard" → finish. Finish = `updateSettings({ onboardingDone: true })` then `navigate("/", { replace: true })`.

`AuthCallbackScreen`: Supabase may still open the magic link; show "Connexion réussie ! Reviens dans l'application et saisis le code à 6 chiffres reçu par e-mail." + button "Ouvrir VietLearn" → `/welcome`.

**Tests** (`onboarding.test.tsx`, fakes): full happy path with code `TEST-CODE`, OTP `123456`, pseudo `Marc` → ends on `/` with `settings.onboardingDone === true`; wrong OTP shows error; pseudo `Taken` shows taken error; invalid invite returns to step 2 with message.

**Commit:** `feat(onboarding): add invite, OTP sign-in, profile, device test and install steps`

---

### Task T22: Home — lesson path

**Spec:** §6.2 · **Depends on:** T07, T17

**Files:** `src/features/home/**`, `src/i18n/fr.ts` (block `// --- home ---`)

**Behaviour:**
- Data: `content.listLessons()`, `snapshot` and `dueCount` from `useAppState` (call `useRefreshProgress()` on mount).
- Lesson state: `done` if in `snapshot.lessonsDone`; `available` if first lesson or previous lesson done; else `locked`. Perfect lessons show a gold star.
- **Layout (not a grid of cards):** a vertical path. Each lesson is a round "stop" (64 px, lacquer button style when available, `bg-surface-2` + lock icon when locked, `bg-success` + check when done) with title and emoji beside it; stops alternate horizontal offsets (`translateX` of −40, 0, +40, 0 … px) and are linked by an SVG dashed curved path behind them (drawn with `pathLength` animation on first mount, 600 ms). The next available stop has a soft pulsing gold halo and a "Commencer" chip.
- After a done lesson, a smaller secondary stop for its dialogue (chat icon; done state from `snapshot.dialoguesDone`) linking to `/dialogue/:dialogueId`.
- Final stop "Bài kiểm tra · Test final" (trophy icon) → `/exam`, locked until 10 lessons done; shows best score if any.
- Top card "Révision du jour — N mots" (only if `dueCount > 0`) → `/review`.
- Tapping a locked stop shakes it and shows a toast "Termine d'abord la leçon précédente".
- Auto-scroll to the next available stop on mount (`scrollIntoView({ block: "center", behavior: "smooth" })`, instant with reduced motion).
- Loading: skeleton stops.

**Tests:** with fake content (1 lesson l05): stop shows "Au café" as available; after `activity.completeLesson(l05)` the stop shows done and the dialogue stop appears; review card appears when due count > 0 (seed `progress.upsertVocabProgress` with a past `dueAt`); exam stop is locked.

**Commit:** `feat(home): add lesson path with dialogue and exam stops`

---

### Task T23: Lesson player and lesson result

**Spec:** §6.3, §4.2 · **Depends on:** T07, T18, T19, T20

**Files:**
- Create: `src/services/lessonSession.ts`, `src/services/lessonSession.test.ts` (pure reducer — services rules apply)
- `src/features/lessons/**` (`LessonScreen`, `LessonDoneScreen`, `VocabDeck.tsx`, `useLessonRun.ts`, tests), `src/i18n/fr.ts` (block `// --- lessons ---`)

**Interfaces — Produces (`@/services/lessonSession`, reused by T24 and T26):**
```ts
export type SessionOptions = { hearts: number | null; retryWrong: boolean };
export type SessionState = {
  queue: Exercise[]; index: number; hearts: number | null; mistakes: number; selfAssessed: number;
  retried: string[]; results: Array<{ exerciseId: string; result: GradeResult }>; status: "running" | "failed" | "done";
};
export function createSession(exercises: readonly Exercise[], opts: SessionOptions): SessionState;
export function applyResult(state: SessionState, opts: SessionOptions, result: GradeResult): SessionState;
export function currentExercise(state: SessionState): Exercise | undefined;
export function progressOf(state: SessionState): number; // index / queue.length
```
Rules: `skipped` → no mistake, no heart lost, no retry. `selfAssessed` → counts in `selfAssessed`; if not ok it is a mistake. Wrong (not skipped) → `mistakes++`, `hearts--` (if not null), and if `retryWrong` and not yet retried → push the same exercise to the end of `queue` and add its id to `retried`. `hearts === 0` → `status: "failed"`. Index past end → `status: "done"`.

- [ ] **Step 1: Failing reducer tests**
```ts
import { createSession, applyResult, currentExercise, progressOf } from "@/services/lessonSession";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
const ok = { correct: true, score: 1, expected: "", vocabIds: [] };
const ko = { correct: false, score: 0, expected: "", vocabIds: [] };
const opts = { hearts: 3, retryWrong: true };
const ex = lessonFixture.exercises.slice(0, 3);

test("all correct → done, no mistakes", () => {
  let s = createSession(ex, opts);
  for (let i = 0; i < 3; i++) s = applyResult(s, opts, ok);
  expect(s).toMatchObject({ status: "done", mistakes: 0, hearts: 3 });
});
test("wrong answer is retried once at the end", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ko);
  expect(s.queue).toHaveLength(4);
  expect(s.queue[3]!.id).toBe(ex[0]!.id);
  s = applyResult(s, opts, ok); s = applyResult(s, opts, ok);
  s = applyResult(s, opts, ko); // the retry, wrong again → not re-queued
  expect(s).toMatchObject({ status: "done", mistakes: 2, hearts: 1 });
});
test("three mistakes fail the lesson", () => {
  let s = createSession(ex, opts);
  s = applyResult(s, opts, ko); s = applyResult(s, opts, ko); s = applyResult(s, opts, ko);
  expect(s.status).toBe("failed");
});
test("skipped costs nothing", () => {
  const s = applyResult(createSession(ex, opts), opts, { ...ko, skipped: true });
  expect(s).toMatchObject({ mistakes: 0, hearts: 3, index: 1 });
});
test("no hearts mode (review) never fails", () => {
  const o = { hearts: null, retryWrong: false };
  let s = createSession(ex, o);
  for (let i = 0; i < 3; i++) s = applyResult(s, o, ko);
  expect(s).toMatchObject({ status: "done", hearts: null, mistakes: 3 });
});
test("helpers", () => {
  const s = createSession(ex, opts);
  expect(currentExercise(s)?.id).toBe(ex[0]!.id);
  expect(progressOf(s)).toBe(0);
});
```
Implement → PASS.

- [ ] **Step 2: `useLessonRun(lessonId)` hook** — loads lesson + vocab index + settings; phases `"intro" | "exercises" | "failed" | "saving"`; holds `SessionState`; on each `GradeResult`: `activity.recordAnswer(result.vocabIds, result.correct)` (skip when `skipped`), then `applyResult`. On `done`: `activity.completeLesson({ lessonId, mistakes: state.mistakes + (state.selfAssessed > 0 ? 1 : 0), durationMs, vocabIds: lesson.vocab.map(v => v.id) })` (self-assessment prevents the perfect bonus), then `refreshProgress()`, then `navigate("/lesson/:id/done", { state: ActivityResult & { accuracy } , replace: true })`. On `failed`: `activity.introduceVocab(lesson.vocab ids)`, show the failed panel. Prefetch the next lesson (`content.getLesson(nextId)`) during the exercises phase (ADR 0010).

- [ ] **Step 3: `LessonScreen`** — `FocusHeader` (✕ → `ConfirmDialog` "Quitter la leçon ? Ta progression dans cette leçon sera perdue.", ProgressBar = `progressOf`, `Hearts` on the right).
  - **Intro / VocabDeck**: stacked cards (top card full, next card `scale 0.94, y 10` behind); each card: `vi` in `text-display`, `fr`, optional `note` in an info box (`text-info`), SpeakerButton auto-plays when the card becomes top; `drag="x"` swipe (threshold 80 px) or "Suivant" button; ReportButton per card (`reporter.report({ refId: vocab.id, … })` via a `ReportSheet` with textarea, 500 chars); last card → "C'est parti !" starts exercises.
  - **Exercises**: `ExerciseHost mode="practice"` with `onCapabilityLost` → `updateSettings` and `onReport` → ReportSheet.
  - **Failed**: EmptyState-like panel (illustration "bowl") "Plus de vies ! Les mots ont été ajoutés à tes révisions." + "Réessayer" (restarts session, skip intro) + "Retour".
- [ ] **Step 4: `LessonDoneScreen`** — reads `location.state`; if absent → redirect `/`. Shows `Confetti fire`, title ("Giỏi quá !" if perfect, else "Bien joué !"), `XpCounter` from `snapshot.xpTotal - xpGained` to `snapshot.xpTotal` with `delta = xpGained`, accuracy %, newly unlocked badges as `BadgeMedal size="lg"` popping in (`spring.bouncy`, staggered), and two buttons: primary "Dialogue : <title>" → `/dialogue/:dialogueId` (if dialogue exists), secondary "Continuer" → `/`.
- [ ] **Step 5: Tests** (`lessons.test.tsx`, fakes, fixture lesson l05): intro deck → start → answer every exercise correctly (drive each plugin: for speak, queue recognitions in `FakeSpeechRecognizer`) → lands on done screen with "+15"; making 3 mistakes shows the failed panel; quitting asks for confirmation.
- [ ] **Step 6: Verify & commit** — `feat(lessons): add lesson session reducer, lesson player and result screen`

---

### Task T24: Review (Leitner session)

**Spec:** §4.4, §6.6 · **Depends on:** T06, T23

**Files:** `src/features/review/**` (`ReviewScreen`, `ReviewRunScreen`, tests), `src/i18n/fr.ts` (block `// --- review ---`)

- `ReviewScreen` (tab):
  - Load all known words once with `progress.listDueVocab(addDaysIso(now, 365), 10000)` (every word is due within 16 days, so this returns all of them sorted by `dueAt`).
  - If `dueCount === 0` → EmptyState (illustration "lantern") "Rien à réviser aujourd'hui — reviens demain !" plus "Prochaine révision : demain / dans N jours" computed from the first word's `dueAt` (`daysBetween(parisDay(now), parisDay(dueAt))`); if no word at all: "Termine une leçon pour commencer tes révisions."
  - Else a card "N mots à réviser" + primary "Réviser" → `/review/run`.
  - Below, the Leitner distribution: 5 small columns (box 1 → 5, labels "Nouveau" … "Maîtrisé"), column heights proportional to counts (animate `scaleY` from 0, origin bottom).
- `ReviewRunScreen` (focus): builds the session once: `buildReviewSession(await progress.listDueVocab(now, 20), pool, createRng(seedFromString(now)), { hasStt: settings.capabilities?.stt ?? false })` where `pool` = vocab of lessons in `snapshot.lessonsDone` (from `content.getLesson`). Uses `createSession(exercises, { hearts: null, retryWrong: false })` and `ExerciseHost mode="practice"`; each result → `activity.recordAnswer(vocabIds, correct)`; at the end → `activity.completeReview({ correctCount, total })` → result panel (XP counter, "N/M justes", badges) → "Terminer" → `/review` (and `refreshProgress()`).
- **Tests:** empty state; with 3 due words the run shows 3 exercises and ends with the completion panel; `recordAnswer` updates boxes (assert via `progress.getVocabProgress`).

**Commit:** `feat(review): add Leitner review screens`

---

### Task T25: Conversation (scripted dialogue)

**Spec:** §6.7 · **Depends on:** T13, T17, T08

**Files:** `src/features/conversation/**` (`DialogueScreen`, `Bubble.tsx`, `useDialogue.ts`, tests), `src/i18n/fr.ts` (block `// --- conversation ---`)

- Header: `FocusHeader` + scene card (title + `scene`, `Motif kind="waves"`).
- `useDialogue(id)`: `conversation.start(id)`; reveals history entries **one at a time**: for each new npc entry, show the typing indicator ("…", three dots bouncing) for 600 ms, then the bubble (`scale 0.9→1`, `transform-origin` bottom-left), then `tts.speak(vi, { rate })` and wait for it before revealing the next one. User entries appear instantly (bottom-right origin).
- NPC bubble: `bg-surface shadow-card`, `vi` (`lang="vi"`, `text-body-strong`), a "Traduire" toggle revealing `fr` (height animation is forbidden → crossfade `opacity` with the text block always reserving space via `grid` trick, or simply swap text with opacity); replay speaker; ReportButton.
- User bubble: `bg-primary text-primary-on`.
- User turn panel (bottom sheet-like area, not modal): the 2–3 options as cards (vi + fr + small speaker). If `capabilities.stt`: a `MicButton` "Réponds à voix haute" → `stt.listen` → `conversation.answer(state, { kind: "speech", alternatives })`; when `misunderstood` → inline message "Je n'ai pas compris, réessaie ou choisis une réponse" + options pulse once. Tapping an option card → `{ kind: "choice", optionId }` and the option's audio is played (the learner hears the right pronunciation). Recognition errors handled like T20 (not-allowed → `updateSettings` stt false).
- Finished → `activity.completeDialogue({ dialogueId, durationMs })` → result card (XP, badges) + "Retour à l'accueil" / "Rejouer".
- **Tests** (fixture d05): plays t1, user picks o1 by tap, t3 appears, picks again, t5 appears, completion panel shows "+15"; speech path with `FakeSpeechRecognizer.queue = [["cho tui một ly trà đá"]]` selects o2; garbage speech shows the misunderstood message.

**Commit:** `feat(conversation): add scripted dialogue screen with speech answers`

---

### Task T26: Final exam and certificate

**Spec:** §6.8 · **Depends on:** T09, T15, T23

**Files:** `src/features/exam/**` (`ExamIntroScreen`, `ExamRunScreen`, `ExamResultScreen`, tests), `src/ui/Certificate.tsx`, `src/ui/drawCertificate.ts`, `src/ui/certificate.test.ts`, `src/ui/index.ts` (exports), `src/i18n/fr.ts` (block `// --- exam ---`)
The certificate lives in `src/ui/` (pure presentational, props `{ pseudo: string; score: number; mention: ExamMention; dateIso: string; noSpeaking: boolean }`) because `/me` (T28) also shows it and features cannot import each other. `ExamMention` is a string union — redeclare it in `Certificate.tsx` as `type CertificateMention = "excellent" | "tres_bien" | "bien"` to keep `ui` independent of `services`.

- **Intro** (`/exam`, tab layout): rules list (30 questions, ~15 min, 4 parts with icons, no feedback during the test, 3 attempts per day, pass at 70), best score (from snapshot), locked panel if `snapshot.lessonsDone.length < 10` (show N/10). Offline (`!navigator.onLine`) → primary disabled + "Le test nécessite une connexion". "Commencer" → `exam.startAttempt()`:
  - `ExamLimitError` → message "Tu as utilisé tes 3 essais aujourd'hui. Reviens demain !".
  - success → `navigate("/exam/run", { state: { attemptId, remainingToday } })`.
- **Run** (`/exam/run`, focus): if no `attemptId` in state → redirect `/exam`. Draw: `drawExam(await content.getExamPool(), seedFromString(attemptId), settings.capabilities?.stt ?? false)`. Section headers between parts ("Partie 1 · Écoute", …) shown as a short interstitial (1.2 s, skippable on tap). `ExerciseHost mode="exam"`; collect `result.score` (skipped = 0). Header: progress bar + `mm:ss` elapsed (tabular), ✕ asks confirmation ("L'essai sera compté"). At the end: `score = examScore(scores)`; `exam.submitAttempt(attemptId, score)` (ignore OfflineError — the event syncs anyway); `activity.finishExam({ attemptId, score, noSpeaking: !hasStt })`; `refreshProgress()`; navigate `/exam/result` with `{ score, mention, results, questions, noSpeaking, xpGained, newBadges }`.
- **Result**: big animated score (count-up 0→score, 1 s, `text-display`), mention label, Confetti if ≥ 70; per-section accuracy bars; expandable correction list (question prompt, expected answer with speaker, ✓/✗); if ≥ 70 → `Certificate` preview + buttons "Télécharger" (PNG) and "Imprimer" (`window.print()`); else "Réessayer" (shows remaining attempts) and "Réviser" → `/review`.
- **`src/ui/Certificate.tsx`**: A4-landscape proportions card: cream background, double gold border, `Motif kind="scales"` corners, "Chứng nhận" / "Certificat de réussite", pseudo (large), "a réussi le test final de vietnamien du Sud", score / 100 + mention, date in French (`Intl.DateTimeFormat("fr-FR", { dateStyle: "long" })`), "Sans épreuve orale" line if `noSpeaking`, small "VietLearn" seal (red circle). `@media print` CSS shows only the certificate.
- **`src/ui/drawCertificate.ts`**: `drawCertificate(ctx: CanvasRenderingContext2D, data, size = { w: 1754, h: 1240 })` draws the same design manually (fill rects, `strokeRect` borders, `fillText` with `"800 96px 'Be Vietnam Pro'"` — call `await document.fonts.load("800 96px 'Be Vietnam Pro'")` before drawing); export via `canvas.toBlob` → download link `vietlearn-certificat.png`. No html2canvas.
- **Tests:** intro locked when < 10 lessons (fake snapshot); limit error message (fake gateway after 3 starts); run with a 30-question fixture answering all correctly → result 100 + certificate visible; `noSpeaking` path when `stt` false (no speak questions rendered). Unit-test `drawCertificate` with a mocked 2D context (assert `fillText` called with the pseudo and the score).

**Commit:** `feat(exam): add final exam flow, results and certificate`

---

### Task T27: Leaderboard and public profiles

**Spec:** §6.9 · **ADR:** 0006 · **Depends on:** T15, T17

**Files:** `src/features/leaderboard/**` (`LeaderboardScreen`, `PublicProfileScreen`, `LeaderboardRow.tsx`, tests), `src/i18n/fr.ts` (block `// --- leaderboard ---`)

- Tabs "Semaine" / "Total" (`layoutId="tab-underline"`); on tab change and mount: show cached rows immediately (`progress.getCachedLeaderboard(period)`), then fetch `leaderboard.list(period)` → cache with `clock()`; `OfflineError` → keep cache + caption "Hors ligne · mis à jour il y a X min" (`Intl.RelativeTimeFormat("fr")`); no cache + offline → EmptyState.
- Pull-to-refresh: a `motion.div` with `drag="y"` limited to 80 px at scroll top triggers refresh; plus a refresh icon button in the header.
- Podium for the top 3: a distinct block (not identical rows): 2nd – 1st – 3rd columns with heights 72/96/56 px in `surface-2`, avatars with `ring="gold"` for 1st, medals 🥇🥈🥉, XP under each. Then rows from rank 4: rank number (tabular), avatar, pseudo, `StreakFlame` if > 0, "N/10" lessons, XP right-aligned in `text-gold-ink`. My row: `bg-surface-2` with a 4 px left border `border-primary` (tokens only — no opacity variants of gold). If my row is off-screen, a sticky copy at the bottom (above the tab bar).
- Rows enter with `staggerChildren: 0.03`; rank changes animate with `layout`.
- Row tap → `/u/:userId`.
- `PublicProfileScreen`: avatar `lg`, pseudo, XP total/week, streak, 10 lesson dots (done = `bg-success`, else `bg-surface-2`), badges grid (unlocked colour / locked grey with `BadgeMedal`), best exam score. If `userId` is me → redirect `/me`. Offline/unknown → EmptyState.
- **Tests:** fake leaderboard (4 bots + me): podium shows the top 3, my row highlighted; switching tabs refetches; offline (`fake.online = false`) with cache shows the offline caption; tapping a bot opens its profile.

**Commit:** `feat(leaderboard): add weekly/all-time leaderboard with podium and public profiles`

---

### Task T28: Me — profile, badges, settings, report, account deletion

**Spec:** §6.9 (`/me`), §6.10 · **Depends on:** T15, T17, T21 (`DeviceCheck`), T26 (`Certificate`)

**Files:** `src/features/profile/**` (`MeScreen`, `EditProfileSheet.tsx`, `SettingsSection.tsx`, `ReportProblemSheet.tsx`, tests), `src/i18n/fr.ts` (block `// --- profile ---`)

- Header card: avatar `lg` (tap → `EditProfileSheet`: pseudo + emoji grid → `auth.updateProfile`; `PseudoTakenError` message), pseudo, XP total, streak, best exam score. If `snapshot.examBest >= 70`: button "Voir mon certificat" opening a `Sheet` with `<Certificate>` (from `@/ui`, T26) using `snapshot.examBest`, its mention, the date of the best `exam_finished` event (from `progress.listEvents()`) and its `noSpeaking` payload, plus "Télécharger" (uses `drawCertificate`).
- Badges: grid of all 12 (`content.getBadges()`), unlocked first; tap → small sheet with title/description.
- Settings: Theme segmented control (Système / Clair / Sombre) → `updateSettings({ theme })` (theme switches instantly via ThemeController); Voice speed (Normale / Lente 🐢); "Tester à nouveau mon appareil" → a `Sheet` containing `<DeviceCheck>` (from `@/ui`, T21) wired exactly like onboarding step 4, saving `capabilities` via `updateSettings`.
- "Signaler un problème" → `ReportProblemSheet` (free text, `refId: "app"`) → `reporter.report`.
- "Se déconnecter" → `ConfirmDialog` → `auth.signOut()`, `progress.clearAll()`, clear `localStorage` keys `vl-profile`, reset app state, navigate `/welcome`.
- "Supprimer mon compte" (danger, at the bottom) → `ConfirmDialog requireText="SUPPRIMER"` with explanation (all data deleted for everyone in the leaderboard) → `auth.deleteAccount()` → same local cleanup → `/welcome`. Offline → error toast.
- **Tests:** theme change persists (`progress.getSettings()`), pseudo update, delete account flow requires typing SUPPRIMER and ends at `/welcome` with cleared progress.

**Commit:** `feat(profile): add profile, badges, settings, problem report and account deletion`
