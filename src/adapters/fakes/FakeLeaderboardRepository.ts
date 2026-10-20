import { ContentNotFoundError, OfflineError } from "@/domain/errors";
import type { AppEvent, LeaderboardRow, Look, PublicProfile } from "@/domain/types";
import type { LeaderboardRepository } from "@/ports";

type Me = { userId: string; pseudo: string; avatarEmoji: string };

const BOTS: Array<Omit<LeaderboardRow, "isMe">> = [
  // Each fake member wears a different hero (characters and cosmetics from the shop catalogue), so the demo shows variety.
  { userId: "bot_ba_ngoai", pseudo: "Bà Ngoại", avatarEmoji: "🐢", xp: 120, streak: 5, lessonsDone: 3, frame: "frame_jade", look: { character: "char_phap_su", accessory: "acc_thuan_thien" } },
  { userId: "bot_chu_tu", pseudo: "Chú Tư", avatarEmoji: "🛵", xp: 85, streak: 2, lessonsDone: 2, frame: null, look: { character: "char_kiem_khach", hat: "hat_tay_son", outfit: "outfit_hoi_vat" } },
  { userId: "bot_be_na", pseudo: "Bé Na", avatarEmoji: "🌸", xp: 40, streak: 1, lessonsDone: 1, frame: null, look: { hat: "hat_thuy_tinh", aura: "aura_waves" } },
  { userId: "bot_anh_hai", pseudo: "Anh Hai", avatarEmoji: "🐯", xp: 15, streak: 0, lessonsDone: 1, frame: null, look: { outfit: "outfit_son_tinh", accessory: "acc_con_vo" } },
];

/** Lessons/dialogues each fake member has done (consistent with `lessonsDone` above); duels use them as prerequisites. */
const MEMBER_PROGRESS: Record<string, { lessonsDone: string[]; dialoguesDone: string[] }> = {
  bot_ba_ngoai: { lessonsDone: ["l01", "l02", "l03"], dialoguesDone: ["d01", "d02", "d03"] },
  bot_chu_tu: { lessonsDone: ["l01", "l02"], dialoguesDone: ["d01", "d02"] },
  bot_be_na: { lessonsDone: ["l01"], dialoguesDone: ["d01"] },
  bot_anh_hai: { lessonsDone: ["l01"], dialoguesDone: ["d01"] },
};

export type FakeMember = { userId: string; pseudo: string; avatarEmoji: string; lessonsDone: string[]; dialoguesDone: string[] };

/** The fake group's members (excluding the player). */
export function fakeMembers(): FakeMember[] {
  return BOTS.map((b) => ({
    userId: b.userId,
    pseudo: b.pseudo,
    avatarEmoji: b.avatarEmoji,
    lessonsDone: [...(MEMBER_PROGRESS[b.userId]?.lessonsDone ?? [])],
    dialoguesDone: [...(MEMBER_PROGRESS[b.userId]?.dialoguesDone ?? [])],
  }));
}

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
    /** Hero look the player has equipped (derived from the local journal by the composition root). */
    private readonly getMyLook: () => Promise<Look> = async () => ({}),
  ) {}

  async list(period: "week" | "all"): Promise<LeaderboardRow[]> {
    if (!this.online) throw new OfflineError();
    const events = await this.getMyEvents();
    const since = period === "week" ? weekStartWall(this.now()) : undefined;
    const mine = events.filter((e) => since === undefined || parisWall(new Date(e.createdAt)).wall >= since);
    const myXp = mine.reduce((sum, e) => sum + e.xp, 0);
    const lessonsDone = new Set(events.filter((e) => e.type === "lesson_completed").map((e) => e.refId)).size;
    const me = typeof this.me === "function" ? await this.me() : this.me;
    const meRow: LeaderboardRow = { ...me, xp: myXp, streak: 0, lessonsDone, frame: await this.getMyFrame(), look: await this.getMyLook(), isMe: true };
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
      lessonsDone: [...(MEMBER_PROGRESS[bot.userId]?.lessonsDone ?? [])],
      dialoguesDone: [...(MEMBER_PROGRESS[bot.userId]?.dialoguesDone ?? [])],
      badges: [],
      examBest: null,
      frame: bot.frame,
      fx: null,
      look: { ...bot.look },
    };
  }
}
