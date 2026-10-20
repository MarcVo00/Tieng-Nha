import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import type { LeaderboardRow } from "@/domain/types";
import { Avatar, duration, ease, tap } from "@/ui";
import { profilePath } from "@/features/leaderboard/LeaderboardRow";

// Hero of the screen: 2nd - 1st - 3rd columns, heights 72/96/56 px, grown from the floor with scaleY.
const HEIGHT = { 1: 96, 2: 72, 3: 56 } as const;
type Place = keyof typeof HEIGHT;

function Column({ row, place, reduced }: { row: LeaderboardRow; place: Place; reduced: boolean }) {
  return (
    <li className="flex min-w-0 flex-1 flex-col">
      <motion.div whileTap={tap} className="flex flex-1 flex-col">
        <Link to={profilePath(row)} aria-label={`${fr.leaderboard.rankLabel(place)}\u202f: ${row.pseudo}, ${fr.leaderboard.xp(row.xp)}`} className="flex flex-1 flex-col items-center justify-end gap-1 px-1 text-center">
          <Avatar emoji={row.avatarEmoji} size={place === 1 ? "lg" : "md"} ring={place === 1 ? "gold" : "none"} frame={row.frame} />
          <span className="mt-1 w-full truncate text-body-strong text-ink">{row.pseudo}</span>
          {row.isMe ? <span className="text-caption text-primary">{fr.leaderboard.you}</span> : null}
          <span className="tabular text-caption text-gold-ink">{fr.leaderboard.xp(row.xp)}</span>
          <motion.span
            aria-hidden="true"
            style={{ height: HEIGHT[place], transformOrigin: "bottom" }}
            initial={{ scaleY: reduced ? 1 : 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: reduced ? 0 : duration.slow, ease: ease.out, delay: reduced ? 0 : place === 1 ? 0.1 : 0 }}
            className={`mt-1 flex w-full items-start justify-center rounded-sm bg-surface-2 pt-2 text-title leading-none ${row.isMe ? "border-t-4 border-primary" : ""}`}
          >
            {fr.leaderboard.medals[place]}
          </motion.span>
        </Link>
      </motion.div>
    </li>
  );
}

export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const reduced = useReducedMotion() ?? false;
  const [first, second, third] = rows;
  return (
    <ol aria-label={fr.leaderboard.podiumLabel} className="flex list-none items-end gap-2 pb-4 pt-2">
      {second ? <Column row={second} place={2} reduced={reduced} /> : null}
      {first ? <Column row={first} place={1} reduced={reduced} /> : null}
      {third ? <Column row={third} place={3} reduced={reduced} /> : null}
    </ol>
  );
}
