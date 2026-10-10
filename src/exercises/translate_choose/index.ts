import { TranslateChooseSchema } from "@/content/schema";
import type { Exercise } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { Component } from "./Component";
import { grade } from "./grade";

export const translateChoose: ExercisePlugin<Extract<Exercise, { type: "translate_choose" }>> = {
  type: "translate_choose",
  schema: TranslateChooseSchema,
  Component,
  grade,
};
