import { LessonSchema, ExerciseSchema, DialogueSchema } from "@/content/schema";
import { lessonFixture } from "@/test/fixtures/lessonFixture";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";

test("fixture lesson is valid", () => expect(LessonSchema.safeParse(lessonFixture).success).toBe(true));
test("fixture dialogue is valid", () => expect(DialogueSchema.safeParse(dialogueFixture).success).toBe(true));
test("unknown exercise type is rejected", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "dance" }).success).toBe(false));
test("extra keys are rejected (strict)", () =>
  expect(ExerciseSchema.safeParse({ id: "x", type: "tone_pick", syllable: "má", answerTone: "sac", extra: 1 }).success).toBe(false));
