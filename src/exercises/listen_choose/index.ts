import { ListenChooseSchema } from "@/content/schema";
import type { Exercise } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { Component } from "./Component";
import { grade } from "./grade";

export const listenChoose: ExercisePlugin<Extract<Exercise, { type: "listen_choose" }>> = {
  type: "listen_choose",
  schema: ListenChooseSchema,
  Component,
  grade,
};
