import type { Lesson } from "@/domain/types";
import type { ContentSource } from "@/ports";
import type { DemoTools } from "@/app/services";
import type { ActivityService } from "@/services/activity";
import { commonLessons, pickDuelQuestions } from "@/services/duel";
import { fakeMembers } from "@/adapters/fakes/FakeLeaderboardRepository";
import type { FakeDuelGateway } from "@/adapters/fakes/FakeDuelGateway";

/** Demo-only helpers: a fake member who has already played challenges me on the lessons we both finished. */
export function createDemoTools(deps: { duels: Pick<FakeDuelGateway, "seedIncoming">; activity: ActivityService; content: ContentSource }): DemoTools {
  const { duels, activity, content } = deps;
  return {
    async receiveChallenge() {
      const mine = (await activity.getSnapshot()).lessonsDone;
      const from = fakeMembers().find((m) => commonLessons(mine, m.lessonsDone).length > 0);
      if (!from) return false;
      const lessons = await Promise.all(commonLessons(mine, from.lessonsDone).map((id) => content.getLesson(id).catch(() => null)));
      const questions = pickDuelQuestions(lessons.filter((l): l is Lesson => l !== null), Math.random);
      if (!questions) return false;
      duels.seedIncoming(questions, { from: from.userId, seed: Math.floor(Math.random() * 0x7fffffff) });
      return true;
    },
  };
}
