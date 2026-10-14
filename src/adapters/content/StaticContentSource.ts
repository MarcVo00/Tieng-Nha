import type { ContentSource } from "@/ports";
import type { BadgeDef, Boss, Dialogue, ExamQuestion, Lesson, LessonSummary, Tree, VocabItem } from "@/domain/types";
import { BadgesFileSchema, BossesFileSchema, DialogueSchema, ExamPoolSchema, LessonSchema, TreeFileSchema } from "@/content/schema";
import { ContentNotFoundError } from "@/domain/errors";

export type ContentLoaders = {
  lessons: Record<string, () => Promise<unknown>>; // key = file path, value = loader returning parsed JSON
  dialogues: Record<string, () => Promise<unknown>>;
  exam: () => Promise<unknown>;
  badges: () => Promise<unknown>;
  tree: () => Promise<unknown>;
  bosses: () => Promise<unknown>;
};

const idFromPath = (p: string): string => (p.split("/").pop() ?? p).replace(/\.json$/, "");

export class StaticContentSource implements ContentSource {
  private readonly lessonCache = new Map<string, Promise<Lesson>>();
  constructor(private readonly loaders: ContentLoaders) {}

  private lessonPaths(): string[] {
    return Object.keys(this.loaders.lessons).sort((a, b) => idFromPath(a).localeCompare(idFromPath(b)));
  }

  getLesson(id: string): Promise<Lesson> {
    const path = this.lessonPaths().find((p) => idFromPath(p) === id);
    const load = path === undefined ? undefined : this.loaders.lessons[path];
    if (!load) return Promise.reject(new ContentNotFoundError(id));
    let p = this.lessonCache.get(id);
    if (!p) {
      p = load().then((raw) => LessonSchema.parse(raw));
      this.lessonCache.set(id, p);
    }
    return p;
  }

  async listLessons(): Promise<LessonSummary[]> {
    const lessons = await Promise.all(this.lessonPaths().map((p) => this.getLesson(idFromPath(p))));
    return lessons.map((l, i) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      emoji: l.emoji,
      dialogueId: l.dialogueId,
      order: i + 1,
    }));
  }

  async getDialogue(id: string): Promise<Dialogue> {
    const path = Object.keys(this.loaders.dialogues).find((p) => idFromPath(p) === id);
    const load = path === undefined ? undefined : this.loaders.dialogues[path];
    if (!load) throw new ContentNotFoundError(id);
    return DialogueSchema.parse(await load());
  }

  async getExamPool(): Promise<ExamQuestion[]> {
    return ExamPoolSchema.parse(await this.loaders.exam()).questions;
  }

  async getBadges(): Promise<BadgeDef[]> {
    return BadgesFileSchema.parse(await this.loaders.badges()).badges;
  }

  async getTree(): Promise<Tree> {
    return TreeFileSchema.parse(await this.loaders.tree());
  }

  async getBoss(id: string): Promise<Boss> {
    const b = BossesFileSchema.parse(await this.loaders.bosses()).bosses.find((x) => x.id === id);
    if (!b) throw new ContentNotFoundError(id);
    return b;
  }

  async getVocabIndex(): Promise<ReadonlyMap<string, VocabItem>> {
    const lessons = await Promise.all(this.lessonPaths().map((p) => this.getLesson(idFromPath(p))));
    return new Map(lessons.flatMap((l) => l.vocab.map((v) => [v.id, v] as const)));
  }
}

export function createStaticContentSource(): StaticContentSource {
  const lessons = import.meta.glob("/src/content/lessons/*.json", { import: "default" });
  const dialogues = import.meta.glob("/src/content/dialogues/*.json", { import: "default" });
  const exam = import.meta.glob("/src/content/exam.json", { import: "default" });
  const badges = import.meta.glob("/src/content/badges.json", { import: "default", eager: true });
  const tree = import.meta.glob("/src/content/tree.json", { import: "default", eager: true });
  const bosses = import.meta.glob("/src/content/bosses.json", { import: "default", eager: true });
  return new StaticContentSource({
    lessons,
    dialogues,
    exam: async () => {
      const load = exam["/src/content/exam.json"];
      return load ? load() : { contentVersion: 1, questions: [] };
    },
    badges: async () => badges["/src/content/badges.json"],
    tree: async () => tree["/src/content/tree.json"],
    bosses: async () => bosses["/src/content/bosses.json"],
  });
}
