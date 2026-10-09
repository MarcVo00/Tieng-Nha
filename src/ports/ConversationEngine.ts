import type { ConversationState, DialogueId } from "@/domain/types";
export type ConversationInput = { kind: "speech"; alternatives: string[] } | { kind: "choice"; optionId: string };
export interface ConversationEngine {
  start(dialogueId: DialogueId): Promise<ConversationState>;
  answer(state: ConversationState, input: ConversationInput): Promise<ConversationState>;
}
