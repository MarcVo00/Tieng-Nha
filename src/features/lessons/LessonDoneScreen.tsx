import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { BadgeMedal, rewardProp, Button, Confetti, Icon, Motif, XpCounter } from "@/ui";
import type { LessonDoneState } from "@/features/lessons/useLessonRun";

const BADGE_STAGGER_MS = 280;

function isDoneState(v: unknown): v is LessonDoneState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<Record<keyof LessonDoneState, unknown>>;
  return (
    typeof s.xpGained === "number" &&
    typeof s.accuracy === "number" &&
    Array.isArray(s.newBadges) &&
    typeof s.snapshot === "object" &&
    s.snapshot !== null &&
    typeof (s.snapshot as { xpTotal?: unknown }).xpTotal === "number"
  );
}

// Hero: the title and the XP counting up. Celebration is brief and never blocks "Continuer".
// Actions: "Continuer" (home) and, when the lesson has one, the dialogue as the primary next step.
function DoneContent({ state: given, lessonId }: { state: LessonDoneState; lessonId: string }) {
  const state = { ...given, coinsGained: typeof given.coinsGained === "number" ? given.coinsGained : 0 };
  const { content } = useServices();
  const navigate = useNavigate();
  const total = state.snapshot.xpTotal;
  const [counted, setCounted] = useState(false);
  const [shownBadges, setShownBadges] = useState(0);
  const [dialogue, setDialogue] = useState<{ id: string; title: string } | null>(null);

  // Mount showing the XP before the lesson, then count up to the new total.
  useEffect(() => {
    setCounted(true);
  }, []);

  useEffect(() => {
    if (shownBadges >= state.newBadges.length) return;
    const t = setTimeout(() => setShownBadges((n) => n + 1), shownBadges === 0 ? 0 : BADGE_STAGGER_MS);
    return () => clearTimeout(t);
  }, [shownBadges, state.newBadges.length]);

  useEffect(() => {
    let cancelled = false;
    content
      .getLesson(lessonId)
      .then(async (lesson) => {
        const d = await content.getDialogue(lesson.dialogueId);
        if (!cancelled) setDialogue({ id: d.id, title: d.title });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [content, lessonId]);

  return (
    <div className="relative flex min-h-dvh flex-col px-5 pb-8 pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 text-gold [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="scales" />
      </div>
      <Confetti fire />
      <div className="relative flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-ink" {...(state.perfect ? { lang: "vi" } : {})}>
            {state.perfect ? fr.lessons.done.perfect : fr.lessons.done.good}
          </h1>
          <p className="text-body text-ink-muted tabular">{fr.lessons.done.accuracy(Math.round(state.accuracy * 100))}</p>
        </div>

        <div className="pt-2">
          <XpCounter value={counted ? total : total - state.xpGained} {...(counted ? { delta: state.xpGained } : {})} />
          {state.coinsGained > 0 ? (
            <p className="mt-3 flex items-center gap-1 text-body-strong text-gold-ink tabular">
              <Icon name="coin" size={20} />
              {fr.shop.gained(state.coinsGained)}
            </p>
          ) : null}
        </div>

        {state.newBadges.length > 0 ? (
          <section aria-label={fr.lessons.done.badges} className="flex flex-col gap-3">
            <h2 className="text-caption text-ink-muted">{fr.lessons.done.badges}</h2>
            <ul className="flex flex-wrap gap-5">
              {state.newBadges.slice(0, shownBadges).map((b) => (
                <li key={b.id}>
                  <BadgeMedal icon={b.icon} title={b.title} unlocked {...rewardProp(b)} size="lg" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="relative flex flex-col gap-3">
        {dialogue ? (
          <>
            <Button size="lg" fullWidth onClick={() => navigate(`/dialogue/${dialogue.id}`, { replace: true })}>
              {fr.lessons.done.dialogue(dialogue.title)}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => navigate("/", { replace: true })}>
              {fr.lessons.done.continue}
            </Button>
          </>
        ) : (
          <Button size="lg" fullWidth onClick={() => navigate("/", { replace: true })}>
            {fr.lessons.done.continue}
          </Button>
        )}
      </div>
    </div>
  );
}

export function LessonDoneScreen() {
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: unknown };
  if (!id || !isDoneState(state)) return <Navigate to="/" replace />;
  return <DoneContent state={state} lessonId={id} />;
}
