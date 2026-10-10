import type { Exercise, ExerciseType } from "@/domain/types";
import type { ExercisePlugin } from "@/exercises/types";
import { listenChoose } from "@/exercises/listen_choose";
import { translateChoose } from "@/exercises/translate_choose";

type PluginMap = { [K in ExerciseType]: ExercisePlugin<Extract<Exercise, { type: K }>> };

// Each exercise task registers its plugin in its own block (T19: tone_pick, word_order · T20: speak).
export const plugins: Partial<PluginMap> = {
  // --- listen_choose ---
  listen_choose: listenChoose,
  // --- translate_choose ---
  translate_choose: translateChoose,
};

export function getPlugin<T extends ExerciseType>(type: T): ExercisePlugin<Extract<Exercise, { type: T }>> {
  const plugin = plugins[type];
  if (!plugin) throw new Error(`No exercise plugin registered for type "${type}"`);
  return plugin;
}
