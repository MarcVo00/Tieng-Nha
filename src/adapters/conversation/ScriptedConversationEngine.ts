import type { ContentSource, ConversationEngine, ConversationInput } from "@/ports";
import type { ConversationState, Dialogue, Turn } from "@/domain/types";
import { scorePronunciation } from "@/services/pronunciation";

export const MATCH_THRESHOLD = 0.6;
const defaultScore = (expected: string, heard: readonly string[]): number => scorePronunciation(expected, heard).score;

export class ScriptedConversationEngine implements ConversationEngine {
  private readonly dialogues = new Map<string, Dialogue>();
  constructor(
    private readonly content: Pick<ContentSource, "getDialogue">,
    private readonly score: (expected: string, heard: readonly string[]) => number = defaultScore,
  ) {}

  private async dialogue(id: string): Promise<Dialogue> {
    let d = this.dialogues.get(id);
    if (!d) {
      d = await this.content.getDialogue(id);
      this.dialogues.set(id, d);
    }
    return d;
  }

  private turn(d: Dialogue, id: string | null): Turn | undefined {
    return id ? d.turns.find((t) => t.id === id) : undefined;
  }

  /** Appends consecutive npc turns starting at `id`; stops at a user turn or the end. */
  private advance(d: Dialogue, state: ConversationState, id: string | null): ConversationState {
    const history = [...state.history];
    let cur = id;
    for (let t = this.turn(d, cur); t && t.speaker === "npc"; t = this.turn(d, cur)) {
      history.push({ turnId: t.id, speaker: "npc", vi: t.vi, fr: t.fr });
      cur = t.next;
    }
    const finished = cur === null;
    return { ...state, history, currentTurnId: cur, awaitingUser: !finished, finished, misunderstood: false };
  }

  async start(dialogueId: string): Promise<ConversationState> {
    const d = await this.dialogue(dialogueId);
    const empty: ConversationState = {
      dialogueId,
      history: [],
      currentTurnId: null,
      awaitingUser: false,
      misunderstood: false,
      finished: false,
    };
    return this.advance(d, empty, d.turns[0]?.id ?? null);
  }

  async answer(state: ConversationState, input: ConversationInput): Promise<ConversationState> {
    const d = await this.dialogue(state.dialogueId);
    const t = this.turn(d, state.currentTurnId);
    if (!t || t.speaker !== "user") return state;
    let option = input.kind === "choice" ? t.options.find((o) => o.id === input.optionId) : undefined;
    if (input.kind === "speech") {
      const ranked = t.options.map((o) => ({ o, s: this.score(o.vi, input.alternatives) })).sort((a, b) => b.s - a.s);
      const best = ranked[0];
      if (best && best.s >= MATCH_THRESHOLD) option = best.o;
    }
    if (!option) return { ...state, misunderstood: true };
    const withUser: ConversationState = {
      ...state,
      history: [...state.history, { turnId: t.id, speaker: "user", vi: option.vi, fr: option.fr }],
    };
    return this.advance(d, withUser, option.next);
  }
}
