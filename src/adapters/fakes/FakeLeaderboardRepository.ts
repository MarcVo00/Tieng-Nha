import { ContentNotFoundError, OfflineError } from "@/domain/errors";
import type { AppEvent, LeaderboardRow, PublicProfile } from "@/domain/types";
import type { LeaderboardRepository } from "@/ports";

type Me = { userId: string; pseudo: string; avatarEmoji: string };

const BOTS: Array<Omit<LeaderboardRow, "isMe">> = [
  { userId: "bot_ba_ngoai", pseudo: "Bà Ngoại", avatarEmoji: "🐢", xp: 120, streak: 5, lessonsDone: 3, frame: null },
  { userId: "bot_chu_tu", pseudo: "Chú Tư", avatarEmoji: "🛵", xp: 85, streak: 2, lessonsDone: 2, frame: null },
  { userId: "bot_be_na", pseudo: "Bé Na", avatarEmoji: "🌸", xp: 40, streak: 1, lessonsDone: 1, frame: null },
  { userId: "bot_anh_hai", pseudo: "Anh Hai", avatarEmoji: "🐯", xp: 15, streak: 0, lessonsDone: 1, frame: null },
];

const PARIS_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

/** Paris wall-clock "YYYY-MM-DDTHH:mm:ss" for an instant, plus ISO weekday (1 = Monday). */
function parisWall(d: Date): { wall: string; isoWeekday: number } {
  const p = Object.fromEntries(PARIS_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  const isoWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(String(p.weekday)) + 1;
  return { wall: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`, isoWeekday };
}

/** Start of the current Paris week (Monday 00:00 Paris) as a Paris wall-clock string. */
function weekStartWall(nowIso: string): string {
  const { wall, isoWeekday } = parisWall(new Date(nowIso));
  const day = new Date(`${wall.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (isoWeekday - 1));
  return `${day.toISOString().slice(0, 10)}T00:00:00`;
}

export class FakeLeaderboardRepository implements LeaderboardRepository {
  online = true;

  constructor(
    private readonly getMyEvents: () => Promise<AppEvent[]>,
    private readonly me: Me | (() => Promise<Me>),
    private readonly now: () => string = () => new Date().toISOString(),
    /** Frame item id the player has equipped (derived from the local journal by the composition root). */
    private readonly getMyFrame: () => Promise<string | null> = async () => null,
  ) {}

  async list(period: "week" | "all"): Promise<LeaderboardRow[]> {
    if (!this.online) throw new OfflineError();
    const events = await this.getMyEvents();
    const since = period === "week" ? weekStartWall(this.now()) : undefined;
    const mine = events.filter((e) => since === undefined || parisWall(new Date(e.createdAt)).wall >= since);
    const myXp = mine.reduce((sum, e) => sum + e.xp, 0);
    const lessonsDone = new Set(events.filter((e) => e.type === "lesson_completed").map((e) => e.refId)).size;
    const me = typeof this.me === "function" ? await this.me() : this.me;
    const meRow: LeaderboardRow = { ...me, xp: myXp, streak: 0, lessonsDone, frame: await this.getMyFrame(), isMe: true };
    return [...BOTS.map((b) => ({ ...b, isMe: false })), meRow].sort((a, b) => b.xp - a.xp);
  }

  async getPublicProfile(userId: string): Promise<PublicProfile> {
    if (!this.online) throw new OfflineError();
    const bot = BOTS.find((b) => b.userId === userId);
    if (!bot) throw new ContentNotFoundError(userId);
    return {
      userId: bot.userId,
      pseudo: bot.pseudo,
      avatarEmoji: bot.avatarEmoji,
      xpTotal: bot.xp,
      xpWeek: bot.xp,
      streak: bot.streak,
      lessonsDone: [],
      dialoguesDone: [],
      badges: [],
      examBest: null,
      frame: bot.frame,
      fx: null,
      look: {},
    };
  }
}
