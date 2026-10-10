import { WordOrderSchema } from "@/content/schema";
import type { Exercise } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { Component } from "./Component";
import { grade } from "./grade";

export const wordOrder: ExercisePlugin<Extract<Exercise, { type: "word_order" }>> = {
  type: "word_order",
  schema: WordOrderSchema,
  Component,
  grade,
};
