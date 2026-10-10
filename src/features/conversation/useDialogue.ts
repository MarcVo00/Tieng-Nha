import { useCallback, useEffect, useRef, useState } from "react";
import { useRefreshProgress, useSettings, voiceRateOf } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { Capabilities, ConversationState, Dialogue, UserTurn } from "@/domain/types";
import { RecognitionError, type ConversationInput } from "@/ports";
import type { ActivityResult } from "@/services/activity";

export const TYPING_MS = 600;
const LISTEN_TIMEOUT_MS = 8000;

export type ChatLine = { key: string; turnId: string; speaker: "npc" | "user"; vi: string; fr: string };
export type DialoguePhase = "loading" | "error" | "playing" | "user" | "answering" | "saving" | "done";
export type DialogueNotice = "misunderstood" | "notHeard" | "micDenied" | "micUnsupported" | null;
export type MicState = "idle" | "listening" | "processing";

type PendingSleep = { timer: ReturnType<typeof setTimeout>; resolve: () => void };

export function useDialogue(dialogueId: string | undefined) {
  const { conversation, content, tts, stt, activity, clock } = useServices();
  const { settings, updateSettings } = useSettings();
  const refreshProgress = useRefreshProgress();

  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [phase, setPhase] = useState<DialoguePhase>("loading");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [typing, setTyping] = useState(false);
  const [options, setOptions] = useState<UserTurn["options"]>([]);
  const [notice, setNotice] = useState<DialogueNotice>(null);
  const [pulse, setPulse] = useState(0); // bumps to re-trigger the one-shot option pulse
  const [mic, setMic] = useState<MicState>("idle");
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumps to (re)start a run

  const capabilities: Capabilities = settings.capabilities ?? { tts: tts.isAvailable(), stt: stt.isAvailable(), recorder: false };
  const latest = useRef({ capabilities, rate: voiceRateOf(settings) });
  latest.current = { capabilities, rate: voiceRateOf(settings) };

  const mounted = useRef(true);
  const epoch = useRef(0); // a run is alive while its epoch is current; cancel() invalidates it
  const sleeping = useRef(new Set<PendingSleep>());
  const dialogueRef = useRef<Dialogue | null>(null);
  const stateRef = useRef<ConversationState | null>(null);
  const inFlight = useRef(false); // one answer at a time
  const completing = useRef(false); // completeDialogue runs at most once per finished run
  const startedAt = useRef(0);
  const lineSeq = useRef(0);

  const cancel = useCallback(() => {
    epoch.current += 1;
    for (const s of sleeping.current) {
      clearTimeout(s.timer);
      s.resolve();
    }
    sleeping.current.clear();
    tts.cancel();
    stt.abort();
  }, [tts, stt]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const entry: PendingSleep = {
          timer: setTimeout(() => {
            sleeping.current.delete(entry);
            resolve();
          }, ms),
          resolve,
        };
        sleeping.current.add(entry);
      }),
    [],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!latest.current.capabilities.tts) return;
      try {
        await tts.speak(text, { rate: latest.current.rate });
      } catch {
        // Audio is a bonus: a failing voice never blocks the conversation.
      }
    },
    [tts],
  );

  const replay = useCallback((text: string) => void speak(text), [speak]);

  const complete = useCallback(
    async (id: string, run: number) => {
      if (completing.current) return;
      completing.current = true;
      setSaveError(false);
      setPhase("saving");
      try {
        const res = await activity.completeDialogue({ dialogueId: id, durationMs: Math.max(0, Date.parse(clock()) - startedAt.current) });
        await refreshProgress().catch(() => undefined);
        if (!mounted.current || epoch.current !== run) return;
        setResult(res);
        setPhase("done");
      } catch {
        completing.current = false; // nothing was committed: the learner may retry
        if (mounted.current && epoch.current === run) setSaveError(true);
      }
    },
    [activity, clock, refreshProgress],
  );

  /** Reveals history entries from `from` one by one, then hands over to the learner or to the save step. */
  const play = useCallback(
    async (next: ConversationState, from: number, run: number, speakUser: boolean) => {
      const alive = () => mounted.current && epoch.current === run;
      const d = dialogueRef.current;
      setPhase("playing");
      setOptions([]);
      for (const entry of next.history.slice(from)) {
        if (!alive()) return;
        if (entry.speaker === "npc") {
          setTyping(true);
          await sleep(TYPING_MS);
          if (!alive()) return;
          setTyping(false);
        }
        lineSeq.current += 1;
        const line: ChatLine = { key: `${entry.turnId}-${lineSeq.current}`, turnId: entry.turnId, speaker: entry.speaker, vi: entry.vi, fr: entry.fr };
        setLines((prev) => [...prev, line]);
        if (entry.speaker === "npc" || speakUser) {
          await speak(entry.vi);
          if (!alive()) return;
        }
      }
      if (!alive()) return;
      stateRef.current = next;
      if (next.finished) {
        if (d) await complete(d.id, run);
        return;
      }
      const turn = d?.turns.find((t) => t.id === next.currentTurnId);
      setOptions(turn && turn.speaker === "user" ? turn.options : []);
      inFlight.current = false;
      setPhase("user");
    },
    [complete, sleep, speak],
  );

  // (Re)start a run: load the dialogue, start the engine, reveal the opening lines.
  useEffect(() => {
    cancel();
    const run = epoch.current;
    inFlight.current = true;
    completing.current = false;
    stateRef.current = null;
    setLines([]);
    setTyping(false);
    setOptions([]);
    setNotice(null);
    setMic("idle");
    setResult(null);
    setSaveError(false);
    if (!dialogueId) {
      setPhase("error");
      return;
    }
    setPhase("loading");
    Promise.all([content.getDialogue(dialogueId), conversation.start(dialogueId)]).then(
      ([d, state]) => {
        if (!mounted.current || epoch.current !== run) return;
        dialogueRef.current = d;
        setDialogue(d);
        startedAt.current = Date.parse(clock());
        void play(state, 0, run, false);
      },
      () => {
        if (mounted.current && epoch.current === run) setPhase("error");
      },
    );
  }, [dialogueId, attempt, content, conversation, clock, cancel, play]);

  const submit = useCallback(
    async (input: ConversationInput) => {
      const current = stateRef.current;
      if (!current || inFlight.current) return;
      inFlight.current = true;
      const run = epoch.current;
      setNotice(null);
      setPhase("answering");
      let next: ConversationState;
      try {
        next = await conversation.answer(current, input);
      } catch {
        if (mounted.current && epoch.current === run) {
          inFlight.current = false;
          setPhase("user");
        }
        return;
      }
      if (!mounted.current || epoch.current !== run) return;
      if (next.misunderstood) {
        setNotice("misunderstood");
        setPulse((n) => n + 1);
        inFlight.current = false;
        setPhase("user");
        return;
      }
      // Tapping a card plays its audio so the learner hears the right pronunciation; spoken answers are not echoed.
      await play(next, current.history.length, run, input.kind === "choice");
    },
    [conversation, play],
  );

  const choose = useCallback(
    (optionId: string) => {
      if (inFlight.current) return;
      if (mic === "listening") stt.abort();
      void submit({ kind: "choice", optionId });
    },
    [mic, stt, submit],
  );

  const listen = useCallback(async () => {
    if (mic === "listening") {
      stt.abort();
      return;
    }
    if (inFlight.current || !stateRef.current) return;
    const run = epoch.current;
    setNotice(null);
    setMic("listening");
    let alternatives: string[];
    try {
      alternatives = await stt.listen({ lang: "vi-VN", timeoutMs: LISTEN_TIMEOUT_MS });
    } catch (e) {
      if (!mounted.current || epoch.current !== run) return;
      setMic("idle");
      const code = e instanceof RecognitionError ? e.code : "network";
      if (code === "aborted") return;
      if (code === "not-allowed" || code === "unsupported") {
        setNotice(code === "not-allowed" ? "micDenied" : "micUnsupported");
        void updateSettings({ capabilities: { ...latest.current.capabilities, stt: false } });
        return;
      }
      setNotice("notHeard");
      return;
    }
    if (!mounted.current || epoch.current !== run) return;
    setMic("idle");
    await submit({ kind: "speech", alternatives });
  }, [mic, stt, submit, updateSettings]);

  const restart = useCallback(() => {
    if (phase === "saving" && !saveError) return;
    setAttempt((n) => n + 1);
  }, [phase, saveError]);

  const retrySave = useCallback(() => {
    const d = dialogueRef.current;
    if (d) void complete(d.id, epoch.current);
  }, [complete]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const total = dialogue ? dialogue.turns.filter((t) => t.speaker === "user").length : 0;
  const answered = lines.filter((l) => l.speaker === "user").length;

  return {
    dialogue,
    phase,
    lines,
    typing,
    options,
    notice,
    pulse,
    mic,
    result,
    saveError,
    capabilities,
    progress: total === 0 ? 0 : Math.min(1, answered / total),
    replay,
    choose,
    listen,
    restart,
    retrySave,
    reload,
  };
}
