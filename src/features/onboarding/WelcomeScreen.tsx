import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@/domain/types";
import { useAppState, useSettings, writeCachedProfile, type AppProfile } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { Button, duration, ease, EXIT_RATIO } from "@/ui";
import { DeviceStep } from "@/features/onboarding/DeviceStep";
import { InstallStep, isStandalone } from "@/features/onboarding/InstallStep";
import { InviteStep } from "@/features/onboarding/InviteStep";
import { ProfileStep } from "@/features/onboarding/ProfileStep";
import { WelcomeStep } from "@/features/onboarding/WelcomeStep";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: readonly Step[] = [1, 2, 3, 4, 5];

function Dots({ step }: { step: Step }) {
  return (
    <div role="img" aria-label={fr.onboarding.stepLabel(step, STEPS.length)} className="flex justify-center gap-2 py-4">
      {STEPS.map((s) => (
        <span key={s} aria-hidden="true" className={`h-2 rounded-full ${s === step ? "w-6 bg-primary" : s < step ? "w-2 bg-primary" : "w-2 bg-line"}`} />
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
  const [step, setStep] = useState<Step>(() => {
    const s = useAppState.getState();
    return s.session && s.profile ? 4 : 1;
  });
  const [dir, setDir] = useState(1);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
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
    setDir(next >= step ? 1 : -1);
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

  // Never throws: once the code is verified the session is kept, and any failure to read the profile
  // is treated as "no profile yet" so the user is never sent back to a spent OTP form.
  async function authenticated(s: Session) {
    useAppState.getState().set({ session: s });
    try {
      if (await auth.hasProfile()) {
        const profile = await auth.getMyProfile();
        if (profile) {
          useAppState.getState().set({ profile });
          writeCachedProfile(profile);
          go(4);
          return;
        }
      }
    } catch {
      // Fall through to the profile step.
    }
    go(3);
  }

  async function joined(profile: AppProfile) {
    useAppState.getState().set({ profile });
    writeCachedProfile(profile);
    go(4);
  }

  function afterDevice() {
    if (isStandalone()) void finish();
    else go(5);
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
          {step === 1 ? <WelcomeStep message={env.VITE_WELCOME_MESSAGE} onStart={() => go(2)} /> : null}
          {step === 2 ? (
            <InviteStep
              inviteCode={inviteCode}
              inviteError={inviteError}
              session={session}
              onInviteChange={(c) => {
                setInviteCode(c);
                setInviteError(null);
              }}
              onAuthenticated={async (s) => {
                await authenticated(s);
              }}
            />
          ) : null}
          {step === 3 ? (
            <ProfileStep
              inviteCode={inviteCode}
              onInvalidInvite={() => {
                setInviteError(fr.onboarding.invite.inviteInvalid);
                go(2);
              }}
              onJoined={joined}
            />
          ) : null}
          {step === 4 ? <DeviceStep onNext={afterDevice} /> : null}
          {step === 5 ? <InstallStep onFinish={() => void finish()} /> : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
