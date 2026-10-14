import { ContentNotFoundError } from "@/domain/errors";
import type { BadgeDef, Boss, Dialogue, DialogueId, ExamQuestion, Lesson, LessonId, LessonSummary, Tree, VocabId, VocabItem } from "@/domain/types";
import type { ContentSource } from "@/ports";

export class InMemoryContentSource implements ContentSource {
  constructor(
    private readonly lessons: Lesson[],
    private readonly dialogues: Dialogue[],
    private readonly exam: ExamQuestion[],
    private readonly badges: BadgeDef[],
    private readonly tree: Tree,
    private readonly bosses: Boss[],
  ) {}

  async listLessons(): Promise<LessonSummary[]> {
    return [...this.lessons]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((l, i) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        emoji: l.emoji,
        dialogueId: l.dialogueId,
        order: i + 1,
      }));
  }

  async getLesson(id: LessonId): Promise<Lesson> {
    const l = this.lessons.find((x) => x.id === id);
    if (!l) throw new ContentNotFoundError(id);
    return l;
  }

  async getDialogue(id: DialogueId): Promise<Dialogue> {
    const d = this.dialogues.find((x) => x.id === id);
    if (!d) throw new ContentNotFoundError(id);
    return d;
  }

  async getExamPool(): Promise<ExamQuestion[]> {
    return this.exam;
  }

  async getBadges(): Promise<BadgeDef[]> {
    return this.badges;
  }

  async getTree(): Promise<Tree> {
    return this.tree;
  }

  async getBoss(id: string): Promise<Boss> {
    const b = this.bosses.find((x) => x.id === id);
    if (!b) throw new ContentNotFoundError(id);
    return b;
  }

  async getVocabIndex(): Promise<ReadonlyMap<VocabId, VocabItem>> {
    const map = new Map<VocabId, VocabItem>();
    for (const l of this.lessons) for (const v of l.vocab) map.set(v.id, v);
    return map;
  }
}
