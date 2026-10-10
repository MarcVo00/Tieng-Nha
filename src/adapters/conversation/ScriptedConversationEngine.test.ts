import { ScriptedConversationEngine } from "@/adapters/conversation";
import { dialogueFixture } from "@/test/fixtures/dialogueFixture";

const engine = new ScriptedConversationEngine({ getDialogue: async () => dialogueFixture });

test("start plays npc turns until the first user turn", async () => {
  const s = await engine.start("d05");
  expect(s.history.map((h) => h.turnId)).toEqual(["t1"]);
  expect(s).toMatchObject({ currentTurnId: "t2", awaitingUser: true, finished: false, misunderstood: false });
});
test("choosing an option advances through the following npc turns", async () => {
  const s = await engine.answer(await engine.start("d05"), { kind: "choice", optionId: "o2" });
  expect(s.history.map((h) => `${h.speaker}:${h.turnId}`)).toEqual(["npc:t1", "user:t2", "npc:t3"]);
  expect(s.history[1]?.vi).toBe("Cho tui một ly trà đá.");
  expect(s.currentTurnId).toBe("t4");
});
test("speech picks the closest option above the threshold", async () => {
  const s = await engine.answer(await engine.start("d05"), { kind: "speech", alternatives: ["cho tui một ly cà phê sữa đá"] });
  expect(s.history[1]?.vi).toBe("Cho tui một ly cà phê sữa đá.");
});
test("unintelligible speech sets misunderstood and does not advance", async () => {
  const start = await engine.start("d05");
  const s = await engine.answer(start, { kind: "speech", alternatives: ["hello"] });
  expect(s.misunderstood).toBe(true);
  expect(s.currentTurnId).toBe("t2");
  expect(s.history).toHaveLength(1);
});
test("dialogue finishes after the last npc turn", async () => {
  let s = await engine.start("d05");
  s = await engine.answer(s, { kind: "choice", optionId: "o1" });
  s = await engine.answer(s, { kind: "choice", optionId: "o1" });
  expect(s).toMatchObject({ finished: true, currentTurnId: null, awaitingUser: false });
  expect(s.history.at(-1)?.turnId).toBe("t5");
});
