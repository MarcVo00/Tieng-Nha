import type { AppEventType, BadgeDef, DialogueId, LessonId, NewEvent, ProgressSnapshot, VocabId } from "@/domain/types";
import type { ContentSource, Outbox, ProgressRepository } from "@/ports";
import { computeProgress } from "@/services/progress";
import { evaluateBadges } from "@/services/badges";
import { dialogueXp, examXpDelta, lessonXp, reviewXp } from "@/services/xp";
import { introduce, record } from "@/services/leitner";

export type ActivityResult = { xpGained: number; newBadges: BadgeDef[]; snapshot: ProgressSnapshot; firstTime: boolean };
export type ActivityService = {
  getSnapshot(): Promise<ProgressSnapshot>;
  introduceVocab(vocabIds: readonly VocabId[]): Promise<void>;
  recordAnswer(vocabIds: readonly VocabId[], correct: boolean): Promise<void>;
  completeLesson(i: { lessonId: LessonId; mistakes: number; durationMs: number; vocabIds: readonly VocabId[] }): Promise<ActivityResult>;
  completeDialogue(i: { dialogueId: DialogueId; durationMs: number }): Promise<ActivityResult>;
  completeReview(i: { correctCount: number; total: number }): Promise<ActivityResult>;
  finishExam(i: { attemptId: string; score: number; noSpeaking: boolean; boss?: BossOutcome }): Promise<ActivityResult>;
};

export type BossOutcome = { bossId: string; won: boolean; livesLeft: number; bossHpLeft: number };

export function createActivityService(deps: {
  progress: ProgressRepository; outbox: Outbox; content: ContentSource; clock: () => string; onEventAppended?: () => void;
}): ActivityService {
  const { progress, outbox, content, clock } = deps;
  const snapshot = async () => computeProgress(await progress.listEvents(), clock());

  async function append(e: NewEvent) {
    const saved = await progress.appendEvent(e, clock());
    await outbox.enqueue(saved);
  }

  async function commit(e: NewEvent, firstTime: boolean): Promise<ActivityResult> {
    const before = await snapshot();
    await append(e);
    const mid = await snapshot();
    const defs = await content.getBadges();
    const newIds = evaluateBadges(mid, defs);
    for (const id of newIds) await append({ type: "badge_unlocked", refId: id, xp: 0, payload: {} });
    deps.onEventAppended?.();
    const after = newIds.length ? await snapshot() : mid;
    return { xpGained: after.xpTotal - before.xpTotal, newBadges: defs.filter((d) => newIds.includes(d.id)), snapshot: after, firstTime };
  }

  const ev = (type: AppEventType, refId: string, xp: number, payload: Record<string, unknown>): NewEvent => ({ type, refId, xp, payload });

  async function introduceVocab(ids: readonly VocabId[]) {
    const now = clock();
    for (const id of ids) if (!(await progress.getVocabProgress(id))) await progress.upsertVocabProgress(introduce(id, now));
  }

  return {
    getSnapshot: snapshot,
    introduceVocab,
    async recordAnswer(ids, correct) {
      const now = clock();
      for (const id of ids) {
        const p = await progress.getVocabProgress(id);
        if (p) await progress.upsertVocabProgress(record(p, correct, now));
      }
    },
    async completeLesson({ lessonId, mistakes, durationMs, vocabIds }) {
      const firstTime = !(await snapshot()).lessonsDone.includes(lessonId);
      await introduceVocab(vocabIds);
      const perfect = mistakes === 0;
      return commit(ev("lesson_completed", lessonId, lessonXp({ firstTime, perfect }), { mistakes, durationMs, perfect }), firstTime);
    },
    async completeDialogue({ dialogueId, durationMs }) {
      const firstTime = !(await snapshot()).dialoguesDone.includes(dialogueId);
      return commit(ev("dialogue_completed", dialogueId, dialogueXp({ firstTime }), { durationMs }), firstTime);
    },
    async completeReview({ correctCount, total }) {
      return commit(ev("review_session_completed", "review", reviewXp(correctCount), { correctCount, total }), false);
    },
    async finishExam({ attemptId, score, noSpeaking, boss }) {
      const best = (await snapshot()).examBest;
      return commit(ev("exam_finished", "exam", examXpDelta(score, best), { score, attemptId, noSpeaking, ...(boss ?? {}) }), best === null);
    },
  };
}
