import { TonePickSchema } from "@/content/schema";
import type { Exercise } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { Component } from "./Component";
import { grade } from "./grade";

export const tonePick: ExercisePlugin<Extract<Exercise, { type: "tone_pick" }>> = {
  type: "tone_pick",
  schema: TonePickSchema,
  Component,
  grade,
};
