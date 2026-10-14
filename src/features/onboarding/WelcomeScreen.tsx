import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@/domain/types";
import { useAppState, useDeviceTest, useSettings, writeCachedProfile, type AppProfile } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, duration, ease, EXIT_RATIO } from "@/ui";
import { DeviceStep } from "@/features/onboarding/DeviceStep";
import { InstallStep, isStandalone } from "@/features/onboarding/InstallStep";
import { InviteStep } from "@/features/onboarding/InviteStep";
import { ProfileStep } from "@/features/onboarding/ProfileStep";
import { SetPasswordStep, type PasswordMode } from "@/features/onboarding/SetPasswordStep";
import { SignInStep } from "@/features/onboarding/SignInStep";
import { WelcomeStep } from "@/features/onboarding/WelcomeStep";

type Step = "welcome" | "signin" | "recovery" | "invite" | "password" | "profile" | "device" | "install";
type Next = "profile" | "existing";
type Origin = "otp" | "password" | "recovery";

/** The sign-up path owns the progress dots. Sign-in and recovery are side trips and show none. */
const DOT_STEPS: readonly Step[] = ["welcome", "invite", "password", "profile", "device", "install"];
/** Slide direction: moving to a later entry slides in from the right. */
const ORDER: readonly Step[] = ["welcome", "signin", "recovery", "invite", "password", "profile", "device", "install"];

function Dots({ step }: { step: Step }) {
  const index = DOT_STEPS.indexOf(step);
  if (index < 0) return <div className="h-10" aria-hidden="true" />;
  return (
    <div role="img" aria-label={fr.onboarding.stepLabel(index + 1, DOT_STEPS.length)} className="flex justify-center gap-2 py-4">
      {DOT_STEPS.map((s, i) => (
        <span key={s} aria-hidden="true" className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : i < index ? "w-2 bg-primary" : "w-2 bg-line"}`} />
      ))}
    </div>
  );
}

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: 40 * dir }),
  center: { opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: (dir: number) => ({ opacity: 0, x: -40 * dir, transition: { duration: duration.base * EXIT_RATIO, ease: ease.in } }),
};

export function WelcomeScreen() {
  const { env, auth } = useServices();
  const navigate = useNavigate();
  const { updateSettings } = useSettings();
  const { refresh: detectDevice } = useDeviceTest();
  const [step, setStep] = useState<Step>(() => {
    const s = useAppState.getState();
    return s.session && s.profile ? "device" : "welcome";
  });
  const [dir, setDir] = useState(1);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("create");
  const [afterPassword, setAfterPassword] = useState<Next>("profile");
  const [askInvite, setAskInvite] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");
  const session = useAppState((s) => s.session);
  const [finishError, setFinishError] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = stepRef.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [step]);

  function go(next: Step) {
    setDir(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  async function finish() {
    setFinishError(false);
    try {
      await updateSettings({ onboardingDone: true });
    } catch {
      setFinishError(true);
      return;
    }
    navigate("/", { replace: true });
  }

  // Existing account: no device test or install step. Capabilities are detected silently, then straight home.
  async function continueExisting() {
    await detectDevice(); // best-effort, never throws
    await finish();
  }

  async function continueAfterPassword(next: Next) {
    if (next === "existing") await continueExisting();
    else go("profile");
  }

  // Never throws: once the code or password is verified the session is kept, and any failure to read the profile
  // is treated as "no profile yet" so the user is never sent back to a spent OTP form.
  async function authenticated(s: Session, origin: Origin) {
    useAppState.getState().set({ session: s });
    let hasProfile = false;
    try {
      if (await auth.hasProfile()) {
        const profile = await auth.getMyProfile();
        if (profile) {
          useAppState.getState().set({ profile });
          writeCachedProfile(profile);
          hasProfile = true;
        }
      }
    } catch {
      // Fall through to the profile step.
    }
    const next: Next = hasProfile ? "existing" : "profile";
    // Reached by password or recovery without a profile: the invite code was never given, so the profile step asks for it.
    setAskInvite(!hasProfile && origin !== "otp");
    if (origin === "recovery") {
      setPasswordMode("reset");
      setAfterPassword(next);
      go("password");
      return;
    }
    let known = true;
    if (origin === "otp") {
      try {
        known = await auth.hasPassword();
      } catch {
        // Cannot tell: never block the user on a password prompt.
      }
    }
    if (!known) {
      setPasswordMode(hasProfile ? "upgrade" : "create");
      setAfterPassword(next);
      go("password");
      return;
    }
    await continueAfterPassword(next);
  }

  async function joined(profile: AppProfile) {
    useAppState.getState().set({ profile });
    writeCachedProfile(profile);
    go("device");
  }

  function afterDevice() {
    if (isStandalone()) void finish();
    else go("install");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col overflow-x-hidden bg-bg px-5 pb-8">
      <Dots step={step} />
      {finishError ? (
        <div role="alert" className="mb-4 flex flex-col gap-2 rounded-md bg-error-soft p-4">
          <p className="text-body text-ink">{fr.onboarding.finishError}</p>
          <Button variant="secondary" onClick={() => void finish()}>
            {fr.onboarding.retry}
          </Button>
        </div>
      ) : null}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div ref={stepRef} key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="flex flex-1 flex-col">
          {step === "welcome" ? <WelcomeStep message={env.VITE_WELCOME_MESSAGE} onStart={() => go("invite")} onSignIn={() => go("signin")} /> : null}
          {step === "signin" ? (
            <SignInStep
              initialEmail={prefillEmail}
              onAuthenticated={(s) => authenticated(s, "password")}
              onForgot={(email) => {
                setPrefillEmail(email);
                go("recovery");
              }}
              onBack={() => go("welcome")}
            />
          ) : null}
          {step === "recovery" ? (
            <InviteStep
              mode="recovery"
              initialEmail={prefillEmail}
              inviteCode=""
              inviteError={null}
              session={null}
              onInviteChange={() => undefined}
              onBack={() => go("signin")}
              onAuthenticated={(s) => authenticated(s, "recovery")}
            />
          ) : null}
          {step === "invite" ? (
            <InviteStep
              inviteCode={inviteCode}
              inviteError={inviteError}
              session={session}
              onInviteChange={(c) => {
                setInviteCode(c);
                setInviteError(null);
              }}
              // Already signed in (sent back from the profile step for a bad invite code): only the code can change.
              {...(session
                ? {}
                : {
                    onBack: () => go("welcome"),
                    onSignIn: (email: string) => {
                      setPrefillEmail(email);
                      go("signin");
                    },
                  })}
              onAuthenticated={(s) => authenticated(s, "otp")}
            />
          ) : null}
          {step === "password" ? (
            <SetPasswordStep
              mode={passwordMode}
              onDone={() => continueAfterPassword(afterPassword)}
              onSkip={() => void continueAfterPassword(afterPassword)}
            />
          ) : null}
          {step === "profile" ? (
            <ProfileStep
              inviteCode={inviteCode}
              askInvite={askInvite}
              onInviteChange={(c) => {
                setInviteCode(c);
                setInviteError(null);
              }}
              onInvalidInvite={() => {
                setInviteError(fr.onboarding.invite.inviteInvalid);
                go("invite");
              }}
              onJoined={joined}
            />
          ) : null}
          {step === "device" ? <DeviceStep onNext={afterDevice} /> : null}
          {step === "install" ? <InstallStep onFinish={() => void finish()} /> : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
