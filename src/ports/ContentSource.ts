import type { BadgeDef, Boss, Dialogue, DialogueId, ExamQuestion, Lesson, LessonId, LessonSummary, ShopItem, Tree, VocabId, VocabItem } from "@/domain/types";
export interface ContentSource {
  listLessons(): Promise<LessonSummary[]>; // ordered l01..l10
  getLesson(id: LessonId): Promise<Lesson>; // throws ContentNotFoundError
  getDialogue(id: DialogueId): Promise<Dialogue>; // throws ContentNotFoundError
  getExamPool(): Promise<ExamQuestion[]>;
  getBadges(): Promise<BadgeDef[]>;
  getTree(): Promise<Tree>;
  getBoss(id: string): Promise<Boss>; // throws ContentNotFoundError
  getShop(): Promise<ShopItem[]>;
  getVocabIndex(): Promise<ReadonlyMap<VocabId, VocabItem>>; // every vocab of every lesson
}
