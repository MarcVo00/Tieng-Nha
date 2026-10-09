import type { LeaderboardRow, PublicProfile } from "@/domain/types";
export interface LeaderboardRepository {
  list(period: "week" | "all"): Promise<LeaderboardRow[]>; // sorted desc by xp; throws OfflineError
  getPublicProfile(userId: string): Promise<PublicProfile>; // throws OfflineError / ContentNotFoundError
}
