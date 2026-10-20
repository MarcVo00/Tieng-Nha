import { Link } from "react-router-dom";
import { motion, type Variants } from "motion/react";
import { fr } from "@/i18n/fr";
import type { LeaderboardRow as Row } from "@/domain/types";
import { Avatar, StreakFlame, spring, tap } from "@/ui";

type LeaderboardRowProps = {
  row: Row;
  rank: number;
  variants?: Variants;
  /** Sticky copy shown when my row scrolled out of view: decorative, not focusable. */
  pinned?: boolean;
  rowRef?: (el: HTMLLIElement | null) => void;
};

export const profilePath = (row: Row) => (row.isMe ? "/me" : `/u/${row.userId}`);

function Body({ row, rank }: { row: Row; rank: number }) {
  return (
    <>
      <span className="tabular w-7 shrink-0 text-center text-body-strong text-ink-muted">{rank}</span>
      <Avatar emoji={row.avatarEmoji} size="md" frame={row.frame} look={row.look} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-strong text-ink">{row.pseudo}</span>
        <span className="flex items-center gap-2 text-caption text-ink-muted">
          {row.isMe ? <span className="text-primary">{fr.leaderboard.you}</span> : null}
          <span className="tabular" aria-label={fr.leaderboard.lessonsLabel(row.lessonsDone)}>
            {fr.leaderboard.lessons(row.lessonsDone)}
          </span>
        </span>
      </span>
      {row.streak > 0 ? <StreakFlame days={row.streak} size="sm" /> : null}
      <span className="tabular min-w-14 text-right text-body-strong text-gold-ink">{fr.leaderboard.xp(row.xp)}</span>
    </>
  );
}

const SHELL = "flex min-h-14 items-center gap-3 border-l-4 py-2 pl-2 pr-1";

export function LeaderboardRow({ row, rank, variants, pinned = false, rowRef }: LeaderboardRowProps) {
  const tone = row.isMe ? "border-primary bg-surface-2" : "border-transparent";
  if (pinned) {
    return (
      <div aria-hidden="true" className={`${SHELL} rounded-md border-l-4 bg-surface-2 shadow-raised ${tone}`}>
        <Body row={row} rank={rank} />
      </div>
    );
  }
  return (
    <motion.li ref={rowRef} layout="position" {...(variants ? { variants } : {})} transition={spring.soft} className="border-b border-line">
      <motion.div whileTap={tap}>
        <Link to={profilePath(row)} className={`${SHELL} ${tone}`}>
          <Body row={row} rank={rank} />
        </Link>
      </motion.div>
    </motion.li>
  );
}
