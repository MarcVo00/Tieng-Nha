import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { EXAM_PASS } from "@/services/exam";
import { Icon, tap, useToast, duration, spring } from "@/ui";
import { bossArtUrl } from "@/features/home/bossArt";
import { PATH_WIDTH, type PathNode } from "@/features/home/pathLayout";

const SHAKE = [0, -6, 6, -4, 4, 0];

/** 1 to 3 gold stars under a completed lesson (3 = perfect); the missing ones stay as faint outlines. */
function Stars({ count }: { count: number }) {
  return (
    <span aria-hidden="true" data-stars={count} className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 gap-0.5">
      {[1, 2, 3].map((n) => (
        <Icon key={n} name="star" size={14} className={n <= count ? "text-gold" : "text-line"} {...(n <= count ? { fill: "currentColor" } : {})} />
      ))}
    </span>
  );
}

/** Hội An lantern milestone, drawn inline: red body, gold caps and tassel. Decorative. */
function Lantern({ dim, style }: { dim: boolean; style: { left: number } }) {
  return (
    <svg aria-hidden="true" focusable="false" data-milestone="lantern" viewBox="0 0 28 44" width={28} height={44} className={`absolute top-1/2 -mt-[26px] ${dim ? "opacity-50" : ""}`} style={style}>
      <path d="M14 2v5" className="stroke-ink" strokeWidth={2} strokeLinecap="round" fill="none" />
      <rect x="8" y="6" width="12" height="4" rx="1.5" className="fill-gold stroke-ink" strokeWidth={1.5} />
      <ellipse cx="14" cy="23" rx="12" ry="13" className="fill-primary stroke-ink" strokeWidth={1.5} />
      <path d="M14 10v26M7 12.5c-2 6-2 13 0 20M21 12.5c2 6 2 13 0 20" className="stroke-gold" strokeWidth={1} strokeLinecap="round" fill="none" opacity={0.7} />
      <rect x="8" y="35" width="12" height="4" rx="1.5" className="fill-gold stroke-ink" strokeWidth={1.5} />
      <path d="M14 39v4" className="stroke-gold" strokeWidth={2} strokeLinecap="round" fill="none" />
    </svg>
  );
}

type StopProps = { node: PathNode; nextRef: (el: HTMLElement | null) => void };

type Visual = { circle: string; icon: ReactNode; title: ReactNode; sub: ReactNode; chip: boolean; badge?: ReactNode; to: string | null; lockedToast: string; label: string };

function visualOf(node: PathNode): Visual {
  if (node.kind === "lesson") {
    const { lesson, state } = node;
    const lessonCircle =
      state === "available"
        ? "bg-primary text-primary-on border-b-4 border-primary-hover group-active:translate-y-[2px] group-active:border-b-2"
        : state === "done"
          ? "border-[3px] border-success bg-paper shadow-card"
          : "bg-surface-2 text-ink-muted";
    return {
      circle: lessonCircle,
      icon: state === "done" ? <span aria-hidden="true" className="text-title leading-none">{lesson.emoji}</span> : state === "locked" ? <Icon name="lock" size={24} /> : <span className="text-heading tabular-nums">{node.order}</span>,
      title: (
        <span className={`block text-body-strong ${state === "locked" ? "text-ink-muted" : "text-ink"}`}>
          {state === "done" ? null : <span aria-hidden="true" className="mr-1.5">{lesson.emoji}</span>}
          {lesson.title}
        </span>
      ),
      // One line: the short tagline (or, without one, the start of the description), ending with an ellipsis rather than mid-word chaos.
      sub: <span className="block max-w-full truncate text-caption text-ink-muted">{lesson.tagline ?? lesson.description}</span>,
      chip: node.next,
      to: state === "locked" ? null : `/lesson/${lesson.id}`,
      lockedToast: fr.home.lesson.lockedToast,
      label: fr.home.lesson.aria(node.order, lesson.title, state, node.perfect),
    };
  }
  if (node.kind === "dialogue") {
    return {
      circle: node.done ? "bg-paper border-2 border-success text-success shadow-card" : "bg-surface border-2 border-line text-primary shadow-card",
      icon: <Icon name={node.done ? "check" : "chat"} size={22} />,
      title: <span className="text-body-strong text-ink">{node.lesson.title}</span>,
      sub: <span className="text-caption text-ink-muted">{node.done ? `${fr.home.dialogue.kicker} · ${fr.home.dialogue.done}` : fr.home.dialogue.kicker}</span>,
      chip: false,
      to: `/dialogue/${node.lesson.dialogueId}`,
      lockedToast: "",
      label: fr.home.dialogue.aria(node.lesson.title),
    };
  }
  const art = bossArtUrl(node.boss.illustration);
  return {
    // The boss stands on the paper medallion like every character; locked = dimmed with a small lock badge.
    circle: `overflow-hidden border-2 border-gold bg-paper shadow-card ${node.locked ? "opacity-60" : "group-active:translate-y-[2px]"}`,
    icon: art ? <img src={art} alt="" className="h-full w-full object-contain p-1" /> : <Icon name="trophy" size={28} className="text-gold" />,
    badge: node.locked ? <Icon name="lock" size={14} /> : null,
    title: (
      <span lang="vi" className={`block text-body-strong ${node.locked ? "text-ink-muted" : "text-ink"}`}>
        {node.boss.name}
      </span>
    ),
    sub: <span className="text-caption text-ink-muted">{node.locked ? fr.home.exam.lockedHint : node.best !== null && node.best >= EXAM_PASS ? fr.home.exam.won : fr.home.exam.kicker}</span>,
    chip: node.next,
    to: node.locked ? null : "/exam",
    lockedToast: fr.home.exam.lockedToast,
    label: fr.home.exam.aria(node.boss.name, node.locked),
  };
}

export function PathStop({ node, nextRef }: StopProps) {
  const reduced = useReducedMotion();
  const controls = useAnimationControls();
  const toast = useToast();
  const v = visualOf(node);
  const isNext = node.kind !== "dialogue" && node.next;

  const left = PATH_WIDTH / 2 + node.offset - node.size / 2;
  const textOnRight = node.offset <= 0;
  // Text keeps a 16 px margin on the right edge of the path instead of touching it.
  const textStyle = textOnRight ? { left: left + node.size + 14, right: 16 } : { left: 0, width: left - 14 };
  const size = node.size === 64 ? "h-16 w-16" : "h-12 w-12";

  const body = (
    <>
      <span className={`absolute left-1/2 top-1/2 ${node.size === 48 ? "-ml-6 -mt-6" : "-ml-8 -mt-8"} ${size}`} style={{ transform: `translateX(${node.offset}px)` }}>
        {isNext && !reduced ? (
          // One-shot pulse when the stop appears (no loop; reduced motion shows none).
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-gold"
            initial={{ scale: 1.15, opacity: 0.5 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: duration.slow * 2, ease: "easeOut" }}
          />
        ) : null}
        <span className={`relative flex items-center justify-center rounded-full ${size} ${v.circle} ${isNext ? "scale-[1.15]" : ""}`}>{v.icon}</span>
        {v.badge ? (
          <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-ink-muted shadow-card">
            {v.badge}
          </span>
        ) : null}
        {node.kind === "lesson" && node.stars > 0 ? <Stars count={node.stars} /> : null}
      </span>
      {node.kind === "lesson" && node.milestone ? (
        <Lantern dim={node.state === "locked"} style={textOnRight ? { left: left - 38 } : { left: left + node.size + 12 }} />
      ) : null}
      <span className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-0.5 ${textOnRight ? "items-start text-left" : "items-end text-right"}`} style={textStyle}>
        {v.title}
        {v.sub}
        {v.chip ? <span className="mt-1 inline-block rounded-sm bg-primary px-2 py-0.5 text-caption text-primary-on">{fr.home.start}</span> : null}
      </span>
    </>
  );

  const onLockedTap = () => {
    toast.show({ title: v.lockedToast });
    if (!reduced) void controls.start({ x: SHAKE, transition: { duration: 0.3 } });
  };

  return (
    <motion.li
      ref={isNext ? nextRef : undefined}
      animate={controls}
      whileTap={tap}
      transition={spring.snappy}
      className="absolute inset-x-0"
      style={{ top: node.cy - node.height / 2, height: node.height }}
    >
      {v.to ? (
        <Link to={v.to} aria-label={v.label} className="group absolute inset-0 block rounded-md">
          {body}
        </Link>
      ) : (
        <button type="button" aria-label={v.label} aria-disabled="true" onClick={onLockedTap} className="group absolute inset-0 block w-full rounded-md">
          {body}
        </button>
      )}
    </motion.li>
  );
}
