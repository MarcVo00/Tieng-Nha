import { SpeakSchema } from "@/content/schema";
import type { Exercise } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { Component } from "./Component";
import { grade } from "./grade";
import { SyllableDiffView } from "./SyllableDiff";

export const speak: ExercisePlugin<Extract<Exercise, { type: "speak" }>> = {
  type: "speak",
  schema: SpeakSchema,
  Component,
  grade,
  Feedback: SyllableDiffView,
};
