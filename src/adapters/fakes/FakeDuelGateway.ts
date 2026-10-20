import { OfflineError } from "@/domain/errors";
import type { AppEvent, Duel, DuelQuestions, DuelRun, Round1Answer, Round2Answer } from "@/domain/types";
import type { DuelError, DuelGateway } from "@/ports";
import { fakeMembers, type FakeMember } from "@/adapters/fakes/FakeLeaderboardRepository";
import { commonLessons, DUEL, duelDamage, duelOutcome, duelPrerequisites, duelTime } from "@/services/duel";
import { addDaysIso, parisDay } from "@/services/time";

const ME = "me";
const EXPIRY_DAYS = 3; // 72 h
const MAX_PER_DAY = 5;
const MAX_MS = 999_999_999;

type Stored = Omit<Duel, "myRun" | "theirRun"> & { runs: Map<string, DuelRun> };
type Options = {
  /** When true (default), a fake member answers right after the challenge, so the duel settles once the player submits. */
  autoOpponent?: boolean;
  members?: FakeMember[];
  /** Kim bài of the local journal (wallet), used by `balance()` until a test overrides it. */
  localKimBai?: () => Promise<number>;
};

/** Deterministic opponent run: 5/8 correct (2 of them critical), 1/3 oral, scaled to the duel's question counts. */
export function autoOpponentRun(questions: DuelQuestions): { round1: Round1Answer[]; round2: Round2Answer[] } {
  const n = questions.round1.length;
  const correct = Math.round((n * 5) / 8);
  const round1 = questions.round1.map((_, i) => ({ correct: i < correct, ms: i < Math.min(2, correct) ? 1500 : 4000 }));
  const oral = Math.ceil(questions.round2.length / 3);
  return { round1, round2: questions.round2.map((_, i) => ({ correct: i < oral })) };
}

/** In-memory duels with the server's rules (shared `services/duel` formulas). */
export class FakeDuelGateway implements DuelGateway {
  online = true;
  /** Tests: the server balance, when it differs from the local journal. */
  serverKimBai: number | null = null;
  private duels: Stored[] = [];
  private readonly autoOpponent: boolean;
  private readonly members: FakeMember[];
  private readonly localKimBai: () => Promise<number>;

  constructor(
    private readonly getMyEvents: () => Promise<AppEvent[]>,
    private readonly clock: () => string = () => new Date().toISOString(),
    options: Options = {},
  ) {
    this.autoOpponent = options.autoOpponent ?? true;
    this.members = options.members ?? fakeMembers();
    this.localKimBai = options.localKimBai ?? (() => Promise.resolve(0));
  }

  async create(opponent: string, questions: DuelQuestions, seed: number): Promise<{ ok: true; duelId: string } | { ok: false; error: DuelError }> {
    if (!this.online) throw new OfflineError();
    const refuse = (error: DuelError) => ({ ok: false as const, error });
    if (opponent === ME) return refuse("self");
    const member = this.members.find((m) => m.userId === opponent);
    if (!member) return refuse("not_same_group");
    this.expire();

    const events = await this.getMyEvents();
    const mine = {
      lessons: events.filter((e) => e.type === "lesson_completed").map((e) => e.refId),
      dialogues: events.filter((e) => e.type === "dialogue_completed").map((e) => e.refId),
    };
    if (!duelPrerequisites(mine.lessons, mine.dialogues) || !duelPrerequisites(member.lessonsDone, member.dialoguesDone)) {
      return refuse("prerequisites");
    }

    const { round1, round2 } = questions;
    if (round1.length < DUEL.minRound1 || round1.length > DUEL.round1 || round2.length < DUEL.minRound2 || round2.length > DUEL.round2) {
      return refuse("bad_questions");
    }
    const common = new Set(commonLessons(mine.lessons, member.lessonsDone));
    if (![...round1, ...round2].every((q) => common.has(q.lessonId))) return refuse("not_common_lesson");
    if (this.duels.some((d) => d.status === "open" && this.other(d) === opponent)) return refuse("already_open");
    const now = this.clock();
    if (this.duels.filter((d) => d.challenger === ME && parisDay(d.createdAt) === parisDay(now)).length >= MAX_PER_DAY) return refuse("daily_limit");

    const duel: Stored = {
      id: crypto.randomUUID(),
      challenger: ME,
      opponent,
      opponentPseudo: member.pseudo,
      opponentAvatar: member.avatarEmoji,
      createdAt: now,
      expiresAt: addDaysIso(now, EXPIRY_DAYS),
      status: "open",
      winner: null,
      seed,
      questions: { round1: [...round1], round2: [...round2] },
      runs: new Map(),
    };
    this.duels.push(duel);
    if (this.autoOpponent) {
      const run = autoOpponentRun(duel.questions);
      duel.runs.set(opponent, this.makeRun(run.round1, run.round2));
    }
    return { ok: true, duelId: duel.id };
  }

  async submitRun(duelId: string, round1: Round1Answer[], round2: Round2Answer[]): Promise<{ ok: true } | { ok: false; error: DuelError }> {
    if (!this.online) throw new OfflineError();
    const refuse = (error: DuelError) => ({ ok: false as const, error });
    const duel = this.duels.find((d) => d.id === duelId);
    if (!duel) return refuse("not_found");
    this.settle(duel);
    if (duel.status !== "open") return refuse("not_open");
    if (duel.runs.has(ME)) return refuse("already_submitted");
    const valid =
      round1.length === duel.questions.round1.length &&
      round2.length === duel.questions.round2.length &&
      round1.every((a) => Number.isInteger(a.ms) && a.ms >= 0 && a.ms <= MAX_MS);
    if (!valid) return refuse("bad_run");
    duel.runs.set(ME, this.makeRun(round1, round2));
    this.settle(duel);
    return { ok: true };
  }

  async list(): Promise<Duel[]> {
    if (!this.online) throw new OfflineError();
    this.expire();
    // Like the server's `duel_runs.claimed`: true once a `duel_settled` for that duel went through the app.
    const claimedIds = new Set((await this.getMyEvents()).filter((e) => e.type === "duel_settled").map((e) => e.refId));
    const mine = (d: { id: string }, run: DuelRun | undefined): DuelRun | null =>
      run ? { ...structuredClone(run), claimed: run.reward !== null && claimedIds.has(d.id) } : null;
    return [...this.duels].reverse().map(({ runs, ...d }) => ({
      ...d,
      questions: structuredClone(d.questions),
      myRun: mine(d, runs.get(ME)),
      theirRun: d.status === "settled" ? structuredClone(runs.get(this.other(d)) ?? null) : null,
    }));
  }

  async balance(): Promise<number> {
    if (!this.online) throw new OfflineError();
    return this.serverKimBai ?? (await this.localKimBai());
  }

  /**
   * Seeds a duel that a fake member opened against me (for tests and the demo mode): the member has already played,
   * I still have to (`theirRun: false` when they have not played yet). `from` defaults to the first member.
   */
  seedIncoming(questions: DuelQuestions, options: { from?: string; seed?: number; theirRun?: boolean } = {}): string {
    const member = this.members.find((m) => m.userId === options.from) ?? this.members[0];
    if (!member) throw new Error("no fake member to challenge me");
    const now = this.clock();
    const duel: Stored = {
      id: crypto.randomUUID(),
      challenger: member.userId,
      opponent: ME,
      opponentPseudo: member.pseudo,
      opponentAvatar: member.avatarEmoji,
      createdAt: now,
      expiresAt: addDaysIso(now, EXPIRY_DAYS),
      status: "open",
      winner: null,
      seed: options.seed ?? 1,
      questions: { round1: [...questions.round1], round2: [...questions.round2] },
      runs: new Map(),
    };
    if (options.theirRun ?? true) {
      const run = autoOpponentRun(duel.questions);
      duel.runs.set(member.userId, this.makeRun(run.round1, run.round2));
    }
    this.duels.push(duel);
    return duel.id;
  }

  /** The other player of a duel (`opponentPseudo` always describes them). */
  private other(d: Pick<Stored, "challenger" | "opponent">): string {
    return d.challenger === ME ? d.opponent : d.challenger;
  }

  private makeRun(round1: Round1Answer[], round2: Round2Answer[]): DuelRun {
    return { round1: structuredClone(round1), round2: structuredClone(round2), damage: duelDamage(round1, round2), timeMs: duelTime(round1), reward: null, claimed: false };
  }

  private expire(): void {
    for (const d of this.duels) this.settle(d);
  }

  /** Settles like `settle_duel`: two runs, or expiry (forfeit with one run, cancelled with none). */
  private settle(d: Stored): void {
    if (d.status !== "open") return;
    const mine = d.runs.get(ME);
    const other = this.other(d);
    const theirs = d.runs.get(other);
    const { rewards } = DUEL;
    if (mine && theirs) {
      const outcome = duelOutcome(mine, theirs);
      d.status = "settled";
      d.winner = outcome === "a" ? ME : outcome === "b" ? other : null;
      mine.reward = outcome === "a" ? rewards.win : outcome === "b" ? rewards.loss : rewards.draw;
      theirs.reward = outcome === "b" ? rewards.win : outcome === "a" ? rewards.loss : rewards.draw;
    } else if (Date.parse(d.expiresAt) <= Date.parse(this.clock())) {
      const only = mine ?? theirs;
      if (only) {
        d.status = "settled";
        d.winner = mine ? ME : other;
        only.reward = rewards.forfeitWin;
      } else {
        d.status = "cancelled";
      }
    }
  }
}
