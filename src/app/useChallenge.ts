import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { ContentNotFoundError, OfflineError } from "@/domain/errors";
import type { Lesson } from "@/domain/types";
import { commonLessons, duelPrerequisites, pickDuelQuestions } from "@/services/duel";
import { fr } from "@/i18n/fr";

/** What a challenge needs to know about the opponent (a subset of `PublicProfile`). */
export type ChallengeTarget = { userId: string; pseudo: string; lessonsDone: readonly string[]; dialoguesDone: readonly string[] };

/**
 * Challenge flow shared by the public profile and the duels hub: prerequisites, question picking from the
 * lessons both players finished, creation, then the run screen. `blockedBy` is the calm reason a duel is
 * impossible right now (null when it is possible or not known yet); `message` is the outcome of the last attempt.
 */
export function useChallenge() {
  const { content, duels, leaderboard } = useServices();
  const navigate = useNavigate();
  const snapshot = useAppState((s) => s.snapshot);
  const stt = useAppState((s) => s.settings.capabilities?.stt ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const unlocked = snapshot === null ? null : duelPrerequisites(snapshot.lessonsDone, snapshot.dialoguesDone);

  const blockedBy = useCallback(
    (target: ChallengeTarget): string | null => {
      if (snapshot === null) return null;
      if (!duelPrerequisites(snapshot.lessonsDone, snapshot.dialoguesDone)) return fr.duels.locked;
      if (!duelPrerequisites(target.lessonsDone, target.dialoguesDone)) return fr.duels.opponentLocked(target.pseudo);
      if (commonLessons(snapshot.lessonsDone, target.lessonsDone).length === 0) return fr.duels.noCommon;
      return null;
    },
    [snapshot],
  );

  const start = useCallback(
    async (who: ChallengeTarget | string): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      setMessage(null);
      const fail = (text: string) => {
        if (mounted.current) setMessage(text);
      };
      try {
        let target: ChallengeTarget;
        if (typeof who === "string") {
          const profile = await leaderboard.getPublicProfile(who);
          target = { userId: profile.userId, pseudo: profile.pseudo, lessonsDone: profile.lessonsDone, dialoguesDone: profile.dialoguesDone };
        } else {
          target = who;
        }
        const blocked = blockedBy(target);
        if (blocked) return fail(blocked);
        if (!stt) return fail(fr.duels.noMic);

        const mine = snapshot?.lessonsDone ?? [];
        const lessons = (
          await Promise.all(commonLessons(mine, target.lessonsDone).map((id) => content.getLesson(id).catch(() => null)))
        ).filter((l): l is Lesson => l !== null);
        const questions = pickDuelQuestions(lessons, Math.random);
        if (!questions) return fail(fr.duels.noCommon);

        const res = await duels.create(target.userId, questions, Math.floor(Math.random() * 0x7fffffff));
        if (res.ok) {
          navigate(`/duel/${res.duelId}/run`);
          return;
        }
        fail(fr.duels.errors[res.error]);
      } catch (e) {
        fail(e instanceof OfflineError ? fr.duels.offline : e instanceof ContentNotFoundError ? fr.duels.errors.not_same_group : fr.duels.errors.unknown);
      } finally {
        running.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [blockedBy, content, duels, leaderboard, navigate, snapshot, stt],
  );

  return { busy, message, unlocked, blockedBy, start };
}
