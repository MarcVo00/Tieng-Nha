import type { Db } from "@/adapters/supabase/client";
import { mapError } from "@/adapters/supabase/errors";
import { ContentNotFoundError } from "@/domain/errors";
import { lookOf } from "@/services/look";
import type { ItemSlot, LeaderboardRow, Look, PublicProfile } from "@/domain/types";
import type { LeaderboardRepository } from "@/ports";
import { LANGUAGE_IDS, type LanguageId } from "@/domain/languages";

/** Equipped profile effect id from the `equipped` jsonb; any unexpected shape reads as none. */
function profileFx(equipped: unknown): string | null {
  if (typeof equipped !== "object" || equipped === null || Array.isArray(equipped)) return null;
  const fx = (equipped as Record<string, unknown>)["profile_fx"];
  return typeof fx === "string" ? fx : null;
}

/** Equipped hero look from the `equipped` jsonb; any unexpected shape reads as the default hero. */
function lookFrom(equipped: unknown): Look {
  if (typeof equipped !== "object" || equipped === null || Array.isArray(equipped)) return {};
  return lookOf(equipped as Partial<Record<ItemSlot, string>>);
}

/** Best boss score per language: `exam_best` is Vietnamese, `exam_bests` the others (`{"tl": 85}`); bad values are dropped. */
function examBestsFrom(examBest: number | null, examBests: unknown): Partial<Record<LanguageId, number>> {
  const out: Partial<Record<LanguageId, number>> = {};
  if (typeof examBests === "object" && examBests !== null && !Array.isArray(examBests)) {
    for (const id of LANGUAGE_IDS) {
      const v = (examBests as Record<string, unknown>)[id];
      if (typeof v === "number" && Number.isFinite(v)) out[id] = v;
    }
  }
  if (examBest !== null) out.vi = examBest;
  return out;
}

/** Best score per boss above level 1: the `exam_bests` keys that are boss ids. */
function bossBestsFrom(examBests: unknown): Record<string, number> {
  if (typeof examBests !== "object" || examBests === null || Array.isArray(examBests)) return {};
  return Object.fromEntries(Object.entries(examBests).filter((e): e is [string, number] => e[0].includes("boss_") && typeof e[1] === "number"));
}

export class SupabaseLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly db: Db) {}

  async list(period: "week" | "all"): Promise<LeaderboardRow[]> {
    const { data: userData } = await this.db.auth.getUser();
    const me = userData.user?.id;
    const col = period === "week" ? "xp_week" : "xp_total";
    const { data, error } = await this.db
      .from("leaderboard")
      .select("user_id,pseudo,avatar_emoji,xp_week,xp_total,streak,lessons_done_count,lessons_done,equipped_frame,equipped")
      .order(col, { ascending: false })
      .limit(100);
    if (error) throw mapError(error);
    const rows: LeaderboardRow[] = [];
    for (const r of data) {
      if (r.user_id === null) continue;
      rows.push({
        userId: r.user_id,
        pseudo: r.pseudo ?? "",
        avatarEmoji: r.avatar_emoji ?? "",
        xp: (period === "week" ? r.xp_week : r.xp_total) ?? 0,
        streak: r.streak ?? 0,
        lessonsDone: r.lessons_done_count ?? 0,
        lessonIds: r.lessons_done ?? [],
        frame: r.equipped_frame ?? null,
        look: lookFrom(r.equipped),
        isMe: r.user_id === me,
      });
    }
    return rows;
  }

  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const { data, error } = await this.db.from("leaderboard").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw mapError(error);
    if (!data || data.user_id === null) throw new ContentNotFoundError(userId);
    return {
      userId: data.user_id,
      pseudo: data.pseudo ?? "",
      avatarEmoji: data.avatar_emoji ?? "",
      xpTotal: data.xp_total ?? 0,
      xpWeek: data.xp_week ?? 0,
      streak: data.streak ?? 0,
      lessonsDone: data.lessons_done ?? [],
      dialoguesDone: data.dialogues_done ?? [],
      badges: data.badges ?? [],
      examBest: data.exam_best,
      examBests: examBestsFrom(data.exam_best, data.exam_bests),
      bossBests: bossBestsFrom(data.exam_bests),
      frame: data.equipped_frame ?? null,
      fx: profileFx(data.equipped),
      look: lookFrom(data.equipped),
    };
  }
}
