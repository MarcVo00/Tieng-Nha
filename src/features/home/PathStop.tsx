import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon, tap, useToast, duration, spring } from "@/ui";
import { bossArtUrl } from "@/features/home/bossArt";
import { PATH_WIDTH, type PathNode } from "@/features/home/pathLayout";

const SHAKE = [0, -6, 6, -4, 4, 0];

type StopProps = { node: PathNode; nextRef: (el: HTMLElement | null) => void };

type Visual = { circle: string; icon: ReactNode; title: ReactNode; sub: ReactNode; chip: boolean; badge?: ReactNode; to: string | null; lockedToast: string; label: string };

function visualOf(node: PathNode): Visual {
  if (node.kind === "lesson") {
    const { lesson, state } = node;
    const lessonCircle =
      state === "available"
        ? "bg-primary text-primary-on border-b-4 border-primary-hover group-active:translate-y-[2px] group-active:border-b-2"
        : state === "done"
          ? "bg-success text-primary-on shadow-card"
          : "bg-surface-2 text-ink-muted";
    return {
      circle: lessonCircle,
      icon: state === "done" ? <Icon name="check" size={30} /> : state === "locked" ? <Icon name="lock" size={24} /> : <span className="text-heading tabular-nums">{node.order}</span>,
      title: (
        <span className={`block text-body-strong ${state === "locked" ? "text-ink-muted" : "text-ink"}`}>
          <span aria-hidden="true" className="mr-1.5">{lesson.emoji}</span>
          {lesson.title}
        </span>
      ),
      sub: <span className="line-clamp-2 text-caption text-ink-muted">{lesson.description}</span>,
      chip: node.next,
      to: state === "locked" ? null : `/lesson/${lesson.id}`,
      lockedToast: fr.home.lesson.lockedToast,
      label: fr.home.lesson.aria(node.order, lesson.title, state, node.perfect),
    };
  }
  if (node.kind === "dialogue") {
    return {
      circle: node.done ? "bg-success text-primary-on shadow-card" : "bg-surface border-2 border-line text-primary shadow-card",
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
    sub: <span className="text-caption text-ink-muted">{node.locked ? fr.home.exam.lockedHint : fr.home.exam.kicker}</span>,
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
  const textStyle = textOnRight ? { left: left + node.size + 14, right: 0 } : { left: 0, width: left - 14 };
  const size = node.size === 64 ? "h-16 w-16" : "h-12 w-12";

  const body = (
    <>
      <span className={`absolute left-1/2 top-1/2 ${node.size === 48 ? "-ml-6 -mt-6" : "-ml-8 -mt-8"} ${size}`} style={{ transform: `translateX(${node.offset}px)` }}>
        {isNext ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-gold"
            initial={{ scale: 1, opacity: 0.4 }}
            animate={reduced ? { scale: 1.2, opacity: 0.3 } : { scale: [1, 1.45], opacity: [0.45, 0] }}
            transition={reduced ? { duration: 0 } : { duration: duration.loop * 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        ) : null}
        <span className={`relative flex items-center justify-center rounded-full ${size} ${v.circle}`}>{v.icon}</span>
        {v.badge ? (
          <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-ink-muted shadow-card">
            {v.badge}
          </span>
        ) : null}
        {node.kind === "lesson" && node.perfect ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-ink shadow-card">
            <Icon name="star" size={14} fill="currentColor" />
          </span>
        ) : null}
      </span>
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
